package com.piaony.tafei;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.SystemClock;
import android.util.DisplayMetrics;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.LinkedHashSet;

/**
 * 实验性 launcher.db 写入。
 * 默认关闭；每次写入前把 launcher.db / -wal / -shm 完整备份，
 * 先改本地副本，再写回并重启桌面校验；失败自动回滚。
 */
public final class LauncherDbOps {

    private static final String PREF = "tafei_app";
    private static final String KEY_DB_WRITE = "launcher_db_write";
    private static final Object LOCK = new Object();
    private static volatile boolean running = false;
    private static String lastBackupDir = "";

    private LauncherDbOps() {}

    public static boolean isEnabled(Context context) {
        return context.getSharedPreferences(PREF, 0).getBoolean(KEY_DB_WRITE, false);
    }

    public static void setEnabled(Context context, boolean enabled) {
        context.getSharedPreferences(PREF, 0).edit().putBoolean(KEY_DB_WRITE, enabled).apply();
    }

    /**
     * 开启写入前先做一次完整快照；快照失败就不允许开启。
     */
    public static String setEnabledWithBackup(Context context, boolean enabled) {
        if (!enabled) {
            setEnabled(context, false);
            return "0";
        }
        if (!backupSnapshot(context)) return "backup-failed";
        setEnabled(context, true);
        return "1";
    }

    private static boolean backupSnapshot(Context context) {
        String remote = currentDbPath();
        if (remote == null || remote.isEmpty()) return false;
        File backupDir = new File(context.getFilesDir(), "launcher_backup/"
            + System.currentTimeMillis());
        if (!backupDir.mkdirs() && !backupDir.exists()) return false;
        File backupDb = new File(backupDir, "launcher.db");
        if (!RootBridge.copyToFile(remote, backupDb)) return false;
        RootBridge.copyToFile(remote + "-wal", new File(backupDb.getAbsolutePath() + "-wal"));
        RootBridge.copyToFile(remote + "-shm", new File(backupDb.getAbsolutePath() + "-shm"));
        lastBackupDir = backupDir.getAbsolutePath();
        return true;
    }

    public static String start(Context context, String action, String payload) {
        if (!isEnabled(context)) return "db-off";
        if (!running) {
            synchronized (LOCK) {
                if (!running) running = true;
            }
        } else {
            return "busy";
        }
        try {
            final JSONObject json = new JSONObject(payload == null ? "{}" : payload);
            final Context app = context.getApplicationContext();
            final String act = action == null ? "move" : action;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        execute(app, act, json);
                    } catch (Throwable t) {
                        SpiritAccessibilityService.publishAction("failed", "", "db-error:" + t.getMessage());
                    } finally {
                        running = false;
                    }
                }
            }, "tafei-launcher-db").start();
            return "started";
        } catch (Exception e) {
            running = false;
            return "bad-payload";
        }
    }

    private static void execute(Context context, String action, JSONObject payload) throws Exception {
        String remote = currentDbPath();
        if (remote == null || remote.isEmpty()) {
            SpiritAccessibilityService.publishAction("failed", "", "db-no-path");
            return;
        }
        JSONArray items = payload.optJSONArray("items");
        JSONObject target = payload.optJSONObject("target");
        if (items == null || items.length() == 0) {
            SpiritAccessibilityService.publishAction("failed", "", "db-no-items");
            return;
        }
        if (target == null && !"swap".equals(action)) {
            SpiritAccessibilityService.publishAction("failed", "", "db-no-target");
            return;
        }
        String label = items.optJSONObject(0).optString("label", "");
        String firstPkg = items.optJSONObject(0).optString("package", "");
        int[] pixel = targetPixel(context, action, items, target);
        SpiritAccessibilityService.publishActionAt("running", label, "db-backup",
            pixel[0], pixel[1], firstPkg);

        File workDir = new File(context.getCacheDir(), "launcher_write");
        deleteTree(workDir);
        if (!workDir.mkdirs() && !workDir.exists()) {
            SpiritAccessibilityService.publishAction("failed", label, "db-work-dir");
            return;
        }
        File workDb = new File(workDir, "launcher.db");
        File backupDir = new File(context.getFilesDir(), "launcher_backup/"
            + System.currentTimeMillis());
        if (!backupDir.mkdirs() && !backupDir.exists()) {
            SpiritAccessibilityService.publishActionAt("failed", label, "db-backup-dir",
                pixel[0], pixel[1], firstPkg);
            return;
        }
        lastBackupDir = backupDir.getAbsolutePath();
        if (!backupAll(remote, workDb, backupDir)) {
            SpiritAccessibilityService.publishActionAt("failed", label, "db-backup-failed",
                pixel[0], pixel[1], firstPkg);
            return;
        }

        SQLiteDatabase db = null;
        JSONObject expected = null;
        try {
            db = SQLiteDatabase.openDatabase(
                workDb.getAbsolutePath(), null, SQLiteDatabase.OPEN_READWRITE);
            try {
                db.rawQuery("PRAGMA journal_mode=DELETE", null).close();
            } catch (Exception ignored) {
            }
            db.beginTransaction();
            if ("move".equals(action)) {
                expected = applyMove(db, items, target);
            } else if ("swap".equals(action)) {
                expected = applySwap(db, items);
            } else if ("folder".equals(action)) {
                expected = applyFolder(db, items, target);
            } else {
                throw new IllegalArgumentException("unknown-action");
            }
            db.setTransactionSuccessful();
            db.endTransaction();
            db.close();
            db = null;
        } catch (Throwable t) {
            if (db != null) {
                try {
                    if (db.inTransaction()) db.endTransaction();
                } catch (Exception ignored) {
                }
                db.close();
            }
            deleteTree(workDir);
            SpiritAccessibilityService.publishActionAt("failed", label, "db-edit-failed:" + t.getMessage(),
                pixel[0], pixel[1], firstPkg);
            return;
        }

        // 写回前保留原文件；写回后再重启桌面，让 Launcher 重新读取。
        if (!writeBack(workDb, remote)) {
            rollback(remote, backupDir, label, "db-write-failed");
            return;
        }
        restartLauncher();
        SystemClock.sleep(2500L);

        if (expected == null || !verify(context, expected, label)) {
            rollback(remote, backupDir, label, "db-verify-failed");
            return;
        }
        SpiritAccessibilityService.publishActionAt("success", label, "db-" + action,
            pixel[0], pixel[1], firstPkg);
    }

    private static boolean backupAll(String remote, File workDb, File backupDir) {
        File backupDb = new File(backupDir, "launcher.db");
        if (!RootBridge.copyToFile(remote, backupDb)) return false;
        if (!RootBridge.copyToFile(remote, workDb)) return false;
        RootBridge.copyToFile(remote + "-wal", new File(workDb.getAbsolutePath() + "-wal"));
        RootBridge.copyToFile(remote + "-shm", new File(workDb.getAbsolutePath() + "-shm"));
        RootBridge.copyToFile(remote + "-wal", new File(backupDb.getAbsolutePath() + "-wal"));
        RootBridge.copyToFile(remote + "-shm", new File(backupDb.getAbsolutePath() + "-shm"));
        return true;
    }

    private static JSONObject applyMove(SQLiteDatabase db, JSONArray items, JSONObject target)
        throws Exception {
        JSONObject item = items.getJSONObject(0);
        long rowId = item.optLong("rowId", -1L);
        if (rowId < 0) throw new IllegalArgumentException("row-id");
        int screen = target.optInt("screen", -1);
        int cellX = target.optInt("cellX", -1);
        int cellY = target.optInt("cellY", -1);
        if (screen < 0 || cellX < 0 || cellY < 0) throw new IllegalArgumentException("target-cell");
        JSONObject occupied = findRowAt(db, screen, cellX, cellY);
        if (occupied != null) throw new IllegalArgumentException("target-occupied");
        ContentValues cv = new ContentValues();
        cv.put("screen", screen);
        cv.put("cellX", cellX);
        cv.put("cellY", cellY);
        cv.put("container", -100);
        db.update(table(), cv, "_id=?", new String[]{String.valueOf(rowId)});
        JSONObject exp = new JSONObject();
        exp.put("kind", "move");
        exp.put("rowId", rowId);
        exp.put("screen", screen);
        exp.put("cellX", cellX);
        exp.put("cellY", cellY);
        return exp;
    }

    private static JSONObject applySwap(SQLiteDatabase db, JSONArray items) throws Exception {
        if (items.length() < 2) throw new IllegalArgumentException("swap-needs-two");
        JSONObject a = items.getJSONObject(0);
        JSONObject b = items.getJSONObject(1);
        long idA = a.optLong("rowId", -1L);
        long idB = b.optLong("rowId", -1L);
        if (idA < 0 || idB < 0) throw new IllegalArgumentException("row-id");
        int as = a.optInt("screen", -1);
        int ax = a.optInt("cellX", -1);
        int ay = a.optInt("cellY", -1);
        int bs = b.optInt("screen", -1);
        int bx = b.optInt("cellX", -1);
        int by = b.optInt("cellY", -1);
        ContentValues cv = new ContentValues();
        cv.put("screen", bs);
        cv.put("cellX", bx);
        cv.put("cellY", by);
        db.update(table(), cv, "_id=?", new String[]{String.valueOf(idA)});
        cv.clear();
        cv.put("screen", as);
        cv.put("cellX", ax);
        cv.put("cellY", ay);
        db.update(table(), cv, "_id=?", new String[]{String.valueOf(idB)});
        JSONObject exp = new JSONObject();
        exp.put("kind", "swap");
        JSONArray arr = new JSONArray();
        arr.put(pos(idA, bs, bx, by));
        arr.put(pos(idB, as, ax, ay));
        exp.put("positions", arr);
        return exp;
    }

    private static JSONObject applyFolder(SQLiteDatabase db, JSONArray items, JSONObject target)
        throws Exception {
        int screen = target.optInt("screen", -1);
        int cellX = target.optInt("cellX", -1);
        int cellY = target.optInt("cellY", -1);
        if (screen < 0 || cellX < 0 || cellY < 0) throw new IllegalArgumentException("target-cell");

        long folderId = target.optLong("folderId", -1L);
        if (folderId > 0) {
            if (!isFolder(db, folderId)) throw new IllegalArgumentException("not-folder");
        } else {
            JSONObject occupied = findRowAt(db, screen, cellX, cellY);
            if (occupied != null) {
                long id = occupied.optLong("_id", -1L);
                int type = occupied.optInt("itemType", -1);
                if (type == 2 && id > 0) {
                    folderId = id;
                } else {
                    throw new IllegalArgumentException("target-occupied-app");
                }
            } else {
                folderId = createFolder(db, screen, cellX, cellY, target.optString("name", ""));
            }
        }

        int rank = maxRank(db, folderId) + 1;
        JSONArray ids = new JSONArray();
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i);
            long rowId = item.optLong("rowId", -1L);
            int type = item.optInt("itemType", 0);
            if (rowId < 0) continue;
            if (type != 0) throw new IllegalArgumentException("folder-item-is-folder");
            ContentValues cv = new ContentValues();
            cv.put("container", folderId);
            cv.put("screen", 0);
            cv.put("cellX", 0);
            cv.put("cellY", 0);
            cv.put("rank", rank++);
            db.update(table(), cv, "_id=?", new String[]{String.valueOf(rowId)});
            ids.put(rowId);
        }
        if (ids.length() == 0) throw new IllegalArgumentException("folder-empty");

        JSONObject exp = new JSONObject();
        exp.put("kind", "folder");
        exp.put("folderId", folderId);
        exp.put("screen", screen);
        exp.put("cellX", cellX);
        exp.put("cellY", cellY);
        exp.put("rows", ids);
        return exp;
    }

    private static long createFolder(SQLiteDatabase db, int screen, int cellX, int cellY, String name) {
        Set<String> cols = columns(db, table());
        ContentValues cv = new ContentValues();
        put(cv, cols, "title", name == null || name.trim().isEmpty() ? "文件夹" : name.trim());
        put(cv, cols, "container", -100);
        put(cv, cols, "screen", screen);
        put(cv, cols, "cellX", cellX);
        put(cv, cols, "cellY", cellY);
        put(cv, cols, "spanX", 1);
        put(cv, cols, "spanY", 1);
        put(cv, cols, "itemType", 2);
        put(cv, cols, "rank", 0);
        put(cv, cols, "profileId", 0);
        put(cv, cols, "user_id", 0);
        put(cv, cols, "modified", System.currentTimeMillis());
        put(cv, cols, "restored", 0);
        put(cv, cols, "iconType", 0);
        put(cv, cols, "card_type", 0);
        return db.insertOrThrow(table(), null, cv);
    }

    private static JSONObject findRowAt(SQLiteDatabase db, int screen, int cellX, int cellY)
        throws Exception {
        Cursor c = null;
        try {
            c = db.rawQuery("SELECT * FROM " + table()
                + " WHERE container=-100 AND screen=? AND cellX=? AND cellY=?"
                + " ORDER BY itemType DESC LIMIT 1",
                new String[]{String.valueOf(screen), String.valueOf(cellX), String.valueOf(cellY)});
            if (!c.moveToFirst()) return null;
            JSONObject o = new JSONObject();
            o.put("_id", c.getLong(c.getColumnIndex("_id")));
            o.put("itemType", c.getInt(c.getColumnIndex("itemType")));
            return o;
        } finally {
            if (c != null) c.close();
        }
    }

    private static boolean isFolder(SQLiteDatabase db, long folderId) {
        Cursor c = null;
        try {
            c = db.rawQuery("SELECT itemType FROM " + table() + " WHERE _id=?",
                new String[]{String.valueOf(folderId)});
            return c.moveToFirst() && c.getInt(0) == 2;
        } finally {
            if (c != null) c.close();
        }
    }

    private static int maxRank(SQLiteDatabase db, long folderId) {
        Cursor c = null;
        try {
            c = db.rawQuery("SELECT MAX(rank) FROM " + table() + " WHERE container=?",
                new String[]{String.valueOf(folderId)});
            return c.moveToFirst() ? c.getInt(0) : 0;
        } finally {
            if (c != null) c.close();
        }
    }

    private static boolean verify(Context context, JSONObject expected, String label) {
        File verifyDir = new File(context.getCacheDir(), "launcher_verify");
        deleteTree(verifyDir);
        if (!verifyDir.mkdirs() && !verifyDir.exists()) return false;
        File local = new File(verifyDir, "launcher.db");
        String remote = null;
        for (int i = 0; i < 8; i++) {
            remote = currentDbPath();
            if (remote != null && !remote.isEmpty()) break;
            SystemClock.sleep(400L);
        }
        if (remote == null || remote.isEmpty()) return false;
        if (!RootBridge.copyToFile(remote, local)) return false;
        SQLiteDatabase db = null;
        try {
            db = SQLiteDatabase.openDatabase(local.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
            String kind = expected.optString("kind");
            if ("folder".equals(kind)) {
                long folderId = expected.optLong("folderId");
                if (!isFolder(db, folderId)) return false;
                JSONArray rows = expected.optJSONArray("rows");
                for (int i = 0; i < rows.length(); i++) {
                    if (!rowContainer(db, rows.optLong(i), folderId)) return false;
                }
                return true;
            }
            JSONArray positions = expected.optJSONArray("positions");
            if (positions == null) {
                positions = new JSONArray();
                positions.put(pos(expected.optLong("rowId"),
                    expected.optInt("screen"), expected.optInt("cellX"), expected.optInt("cellY")));
            }
            for (int i = 0; i < positions.length(); i++) {
                JSONObject p = positions.getJSONObject(i);
                if (!rowAt(db, p.optLong("rowId"), p.optInt("screen"),
                    p.optInt("cellX"), p.optInt("cellY"))) return false;
            }
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            if (db != null) db.close();
            deleteTree(verifyDir);
        }
    }

    private static boolean rowAt(SQLiteDatabase db, long rowId, int screen, int cellX, int cellY) {
        Cursor c = null;
        try {
            c = db.rawQuery("SELECT screen,cellX,cellY FROM " + table() + " WHERE _id=?",
                new String[]{String.valueOf(rowId)});
            return c.moveToFirst()
                && c.getInt(0) == screen && c.getInt(1) == cellX && c.getInt(2) == cellY;
        } finally {
            if (c != null) c.close();
        }
    }

    private static boolean rowContainer(SQLiteDatabase db, long rowId, long folderId) {
        Cursor c = null;
        try {
            c = db.rawQuery("SELECT container FROM " + table() + " WHERE _id=?",
                new String[]{String.valueOf(rowId)});
            return c.moveToFirst() && c.getLong(0) == folderId;
        } finally {
            if (c != null) c.close();
        }
    }

    private static JSONObject pos(long rowId, int screen, int cellX, int cellY) throws Exception {
        JSONObject p = new JSONObject();
        p.put("rowId", rowId);
        p.put("screen", screen);
        p.put("cellX", cellX);
        p.put("cellY", cellY);
        return p;
    }

    private static void rollback(String remote, File backupDir, String label, String reason) {
        File backupDb = new File(backupDir, "launcher.db");
        if (backupDb.exists() && RootBridge.copyFromFile(backupDb, remote)) {
            RootBridge.copyFromFile(new File(backupDb.getAbsolutePath() + "-wal"), remote + "-wal");
            RootBridge.copyFromFile(new File(backupDb.getAbsolutePath() + "-shm"), remote + "-shm");
            restartLauncher();
            SpiritAccessibilityService.publishAction("failed", label, reason + "-rolled-back");
        } else {
            SpiritAccessibilityService.publishAction("failed", label, reason + "-rollback-failed");
        }
    }

    private static boolean writeBack(File local, String remote) {
        if (!RootBridge.copyFromFile(local, remote)) return false;
        RootBridge.run("rm -f " + quote(remote + "-wal") + " " + quote(remote + "-shm"));
        return true;
    }

    private static void restartLauncher() {
        RootBridge.run("am force-stop com.android.launcher", 15000L);
        SystemClock.sleep(450L);
        RootBridge.run("am start -a android.intent.action.MAIN -c android.intent.category.HOME -f 0x10200000", 15000L);
        SystemClock.sleep(1200L);
    }

    private static int[] targetPixel(Context context, String action, JSONArray items, JSONObject target) {
        JSONObject where = target;
        if ("swap".equals(action) && items != null && items.length() > 1) {
            where = items.optJSONObject(1);
        }
        if (where == null) return new int[]{0, 0};
        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        int w = Math.max(1, dm.widthPixels);
        int h = Math.max(1, dm.heightPixels);
        int cols = 4;
        int rows = 6;
        int cx = where.optInt("cellX", 0);
        int cy = where.optInt("cellY", 0);
        int x = (int) (w * ((Math.max(0, cx) + 0.5f) / cols));
        int y = (int) (h * (0.19f + (Math.max(0, cy) + 0.5f) / rows * 0.70f));
        return new int[]{Math.max(1, Math.min(w - 1, x)), Math.max(1, Math.min(h - 1, y))};
    }

    private static String currentDbPath() {
        String old = DesktopProbe.launcherDbPath();
        if (old == null || old.isEmpty()) return "";
        String pid = firstToken(RootBridge.run("pidof com.android.launcher").output);
        if (pid.isEmpty()) return old;
        int slash = old.indexOf("/root/");
        if (slash < 0) return old;
        return "/proc/" + pid + old.substring(slash);
    }

    private static String firstToken(String text) {
        if (text == null) return "";
        String t = text.trim();
        int i = t.indexOf(' ');
        return i < 0 ? t : t.substring(0, i).trim();
    }

    private static String table() {
        String t = DesktopProbe.launcherTable();
        return t == null || t.isEmpty() ? "singledesktopitems" : t;
    }

    private static Set<String> columns(SQLiteDatabase db, String table) {
        Set<String> set = new LinkedHashSet<>();
        Cursor c = null;
        try {
            c = db.rawQuery("PRAGMA table_info(" + table + ")", null);
            while (c.moveToNext()) {
                String name = c.getString(c.getColumnIndex("name"));
                if (name != null) set.add(name);
            }
        } finally {
            if (c != null) c.close();
        }
        return set;
    }

    private static void put(ContentValues cv, Set<String> cols, String key, Object value) {
        if (cols.contains(key)) cv.put(key, String.valueOf(value));
    }

    private static void put(ContentValues cv, Set<String> cols, String key, long value) {
        if (cols.contains(key)) cv.put(key, value);
    }

    private static String quote(String s) {
        return "'" + s.replace("'", "'\\''") + "'";
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteTree(child);
        }
        file.delete();
    }
}
