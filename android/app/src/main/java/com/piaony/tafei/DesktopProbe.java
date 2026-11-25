package com.piaony.tafei;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * ColorOS 桌面环境只读探测。
 * 不写 launcher.db，不删除/移动任何图标；只把包名、数据库和字段结构报给网页。
 */
public final class DesktopProbe {

    private static final Pattern COMPONENT = Pattern.compile("component=([^;]+)");

    private DesktopProbe() {}

    public static String probe(Context context) {
        JSONObject out = new JSONObject();
        JSONArray diag = new JSONArray();
        try {
            out.put("ok", true);
            out.put("readOnly", true);
            out.put("android", Build.VERSION.RELEASE);
            out.put("sdk", Build.VERSION.SDK_INT);
            out.put("display", Build.DISPLAY);
            out.put("model", (Build.MANUFACTURER + " " + Build.MODEL).trim());

            String colorOs = firstNonEmpty(
                getProp("ro.build.version.oplusrom"),
                getProp("ro.build.version.opporom"),
                getProp("ro.build.version.realmeui")
            );
            out.put("coloros", colorOs);

            String launcherPackage = null;
            String launcherVersion = "";
            String launcherLabel = "";
            try {
                Intent home = new Intent(Intent.ACTION_MAIN);
                home.addCategory(Intent.CATEGORY_HOME);
                ResolveInfo ri = context.getPackageManager().resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
                if (ri != null && ri.activityInfo != null) {
                    launcherPackage = ri.activityInfo.packageName;
                    launcherLabel = String.valueOf(ri.loadLabel(context.getPackageManager()));
                    try {
                        PackageInfo pi = context.getPackageManager().getPackageInfo(launcherPackage, 0);
                        launcherVersion = pi.versionName == null ? "" : pi.versionName;
                    } catch (Exception ignored) {
                    }
                }
            } catch (Exception ignored) {
            }
            out.put("launcherPackage", launcherPackage == null ? "" : launcherPackage);
            out.put("launcherVersion", launcherVersion);
            out.put("launcherLabel", launcherLabel);

            boolean accessibilityEnabled = isAccessibilityEnabled(context);
            out.put("accessibility", accessibilityEnabled ? "on" : "off");
            out.put("accessibilityService", new ComponentName(context, SpiritAccessibilityService.class).flattenToString());

            RootBridge.Result root = RootBridge.run("id");
            boolean rootGranted = root.attempted && root.output != null && root.output.contains("uid=0");
            out.put("root", rootGranted ? "granted" : (root.attempted ? "denied" : "no-su"));
            out.put("rootOutput", trim(root.output, 120));

            addDiag(diag, "su：exit=" + root.exitCode + "，" + trim(root.output, 120));

            if (!rootGranted) {
                out.put("diag", diag);
                out.put("dbError", "需要先在 KernelSU 里给挞飞授予超级用户权限");
                out.put("samples", new JSONArray());
                out.put("columns", new JSONArray());
                out.put("containers", new JSONObject());
                out.put("appShortcutCount", 0);
                out.put("totalRows", 0);
                out.put("dbPath", "");
                out.put("dbFile", "");
                out.put("desktopMode", "unknown");
                return out.toString();
            }

            diagCmd(diag, "data 列表", "ls -la /data", 320);
            diagCmd(diag, "data/user/0 列表", "ls -la /data/user/0", 460);
            diagCmd(diag, "data/user_de/0 列表", "ls -la /data/user_de/0", 460);
            diagCmd(diag, "data/user 列表", "ls -la /data/user", 480);
            diagCmd(diag, "当前用户", "am get-current-user", 100);
            diagCmd(diag, "用户列表", "pm list users", 480);
            diagCmd(diag, "user10 数据目录", "ls -la /data/user/10/com.android.launcher", 560);
            diagCmd(diag, "user10 databases", "ls -la /data/user/10/com.android.launcher/databases", 520);
            diagCmd(diag, "user10 db 查找", "find -L /data/user/10/com.android.launcher -maxdepth 4 -name '*.db'", 640);
            diagCmd(diag, "user_de/10 数据目录", "ls -la /data/user_de/10/com.android.launcher", 560);
            diagCmd(diag, "user_de/10 db 查找", "find -L /data/user_de/10/com.android.launcher -maxdepth 4 -name '*.db'", 640);
            diagCmd(diag, "user10 根目录", "ls -la /data/user/10", 460);
            diagCmd(diag, "user_de/10 根目录", "ls -la /data/user_de/10", 460);
            diagCmd(diag, "launcher pid", "pidof com.android.launcher", 120);
            diagCmd(diag, "launcher root 数据目录", "ls -la /proc/$(pidof com.android.launcher)/root/data/user_de/0/com.android.launcher", 600);
            diagCmd(diag, "launcher root databases", "ls -la /proc/$(pidof com.android.launcher)/root/data/user_de/0/com.android.launcher/databases", 760);
            diagCmd(diag, "launcher root db 查找", "find -L /proc/$(pidof com.android.launcher)/root/data/user_de/0/com.android.launcher -maxdepth 3 -name '*.db'", 780);
            diagCmd(diag, "launcher root files", "ls -la /proc/$(pidof com.android.launcher)/root/data/user_de/0/com.android.launcher/files", 600);
            diagCmd(diag, "launcher 打开的 db", "ls -l /proc/$(pidof com.android.launcher)/fd | grep -Ei 'db|launcher|favorite'", 820);
            diagCmd(diag, "launcher.db 全局查找", "find -L /data/user /data/user_de /data/data /data/system /data/oppo -maxdepth 5 -name launcher.db", 720);
            diagCmd(diag, "boot 数据目录", "ls -la /data/user_de/0/com.android.launcher", 560);
            diagCmd(diag, "boot databases", "ls -la /data/user_de/0/com.android.launcher/databases", 520);
            diagCmd(diag, "boot db 查找", "find -L /data/user_de/0/com.android.launcher -maxdepth 4 -name '*.db'", 640);
            diagCmd(diag, "包数据目录", "ls -la /data/data/com.android.launcher", 360);
            diagCmd(diag, "包 databases", "ls -la /data/data/com.android.launcher/databases", 360);
            diagCmd(diag, "launcher.db 全盘查找", "find /data/data /data/user/0 /data/user_de/0 -maxdepth 3 -name launcher.db", 420);
            addDataDirDiag(diag, "com.android.launcher");

            List<String> packages = new ArrayList<>();
            add(packages, launcherPackage);
            String pmOut = RootBridge.run("pm list packages").output;
            for (String line : pmOut.split("\\r?\\n")) {
                if (!line.startsWith("package:")) continue;
                String pkg = line.substring("package:".length()).trim();
                String low = pkg.toLowerCase();
                if (low.contains("launcher") || low.contains("home")) add(packages, pkg);
                if (packages.size() >= 6) break;
            }
            add(packages, "com.oppo.launcher");
            add(packages, "com.coloros.launcher");
            add(packages, "com.oplus.launcher");
            add(packages, "com.android.launcher3");
            add(packages, "com.android.launcher");
            addDiag(diag, "候选包：" + trim(join(packages), 300));

            String launcherPid = firstToken(RootBridge.run("pidof com.android.launcher").output);
            String procDatabases = launcherPid.isEmpty() ? "" : "/proc/" + launcherPid + "/root/data/user_de/0/com.android.launcher/databases";
            JSONObject selected = null;
            if (!procDatabases.isEmpty()) {
                addDiag(diag, "proc databases：" + procDatabases);
                diagCmd(diag, "proc db 文件名", "ls -1 " + procDatabases, 900);
                selected = tryOpenLauncherDatabase(context, procDatabases, diag);
            }

            String dirsOut = findDatabasesDirs(packages);
            addDiag(diag, "候选目录数：" + uniqueLines(dirsOut).size());
            if (selected == null) {
                for (String dir : uniqueLines(dirsOut)) {
                    JSONObject db = tryOpenLauncherDatabase(context, dir, diag);
                    if (db != null) {
                        selected = db;
                        break;
                    }
                }
            }

            if (selected == null) {
                out.put("dbError", "没有找到可读的 launcher.db / favorites 表；可能被加密或桌面包名不同");
                out.put("diag", diag);
                out.put("desktopMode", "unknown");
                out.put("samples", new JSONArray());
                out.put("columns", new JSONArray());
                out.put("containers", new JSONObject());
                out.put("appShortcutCount", 0);
                out.put("totalRows", 0);
                out.put("dbPath", "");
                out.put("dbFile", "");
            } else {
                out.put("dbError", "");
                out.put("diag", diag);
                out.put("dbPath", selected.optString("path"));
                out.put("dbFile", selected.optString("file"));
                out.put("columns", selected.optJSONArray("columns"));
                out.put("containers", selected.optJSONObject("containers"));
                out.put("appShortcutCount", selected.optInt("appShortcutCount"));
                out.put("totalRows", selected.optInt("totalRows"));
                out.put("samples", selected.optJSONArray("samples"));
                out.put("desktopMode", "unknown");
            }
        } catch (Throwable t) {
            try {
                out.put("ok", false);
                out.put("diag", diag);
                out.put("dbError", "探测异常：" + String.valueOf(t.getMessage()));
            } catch (Exception ignored) {
            }
        }
        return out.toString();
    }

    private static JSONObject tryOpenLauncherDatabase(Context context, String remoteDir, JSONArray diag) {
        List<String> names = new ArrayList<>();
        addDiag(diag, "目录：" + remoteDir);
        RootBridge.Result ls = RootBridge.run("ls -la " + quote(remoteDir));
        addDiag(diag, "目录项：" + trim(ls.output, 900));
        for (String line : uniqueLines(ls.output)) {
            String[] fields = line.trim().split(" ");
            String name = fields.length == 0 ? "" : fields[fields.length - 1];
            if (name.endsWith(".db") && !name.endsWith("-wal") && !name.endsWith("-shm")) {
                names.add(name);
            }
        }
        for (String name : names) {
            File cache = new File(context.getCacheDir(), "desktop_probe");
            deleteTree(cache);
            if (!cache.exists() && !cache.mkdirs()) continue;
            File localDb = new File(cache, "launcher_probe.db");
            String remotePath = remoteDir + "/" + name;
            if (!RootBridge.copyToFile(remotePath, localDb)) {
                addDiag(diag, "跳过 " + name + "：cat 读取失败（文件权限或路径问题）");
                continue;
            }
            // WAL 不能漏；只读打开时也要把 -wal/-shm 带上。
            RootBridge.copyToFile(remotePath + "-wal", new File(localDb.getAbsolutePath() + "-wal"));
            RootBridge.copyToFile(remotePath + "-shm", new File(localDb.getAbsolutePath() + "-shm"));

            SQLiteDatabase db = null;
            Cursor tables = null;
            Cursor columns = null;
            try {
                db = SQLiteDatabase.openDatabase(localDb.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
                tables = db.rawQuery("SELECT name FROM sqlite_master WHERE type='table'", null);
                List<String> tableNames = new ArrayList<>();
                while (tables.moveToNext()) {
                    String table = tables.getString(tables.getColumnIndex("name"));
                    if (table != null && !table.startsWith("sqlite_")) tableNames.add(table);
                }
                tables.close();
                tables = null;
                if (!tableNames.contains("favorites")) {
                    addDiag(diag, name + "：没有 favorites 表；表=" + trim(join(tableNames), 420));
                    if (name.equals("launcher.db")) dumpTables(db, name, diag);
                    continue;
                }

                JSONObject result = new JSONObject();
                JSONArray columnArray = new JSONArray();
                Set<String> columnNames = new LinkedHashSet<>();
                columns = db.rawQuery("PRAGMA table_info(favorites)", null);
                while (columns.moveToNext()) {
                    String col = columns.getString(columns.getColumnIndex("name"));
                    columnNames.add(col);
                    columnArray.put(col);
                }
                columns.close();
                columns = null;
                if (!columnNames.contains("intent")) {
                    addDiag(diag, name + "：favorites 缺少 intent 字段");
                    continue;
                }

                JSONObject containers = new JSONObject();
                JSONArray samples = new JSONArray();
                int appShortcutCount = 0;
                int totalRows = 0;

                Cursor rows = null;
                try {
                    String order = columnNames.contains("screen") && columnNames.contains("cellY") && columnNames.contains("cellX")
                        ? "screen, cellY, cellX" : null;
                    rows = db.rawQuery("SELECT * FROM favorites" + (order == null ? "" : " ORDER BY " + order), null);
                    while (rows.moveToNext()) {
                        totalRows++;
                        int itemType = intValue(rows, "itemType", -1);
                        String container = stringValue(rows, "container");
                        if (container != null) {
                            int count = containers.optInt(container, 0) + 1;
                            containers.put(container, count);
                        }
                        if (itemType != 0) continue;
                        appShortcutCount++;
                        if (samples.length() >= 12) continue;
                        String intent = stringValue(rows, "intent");
                        String component = componentOf(intent);
                        String pkg = component == null ? "" : component.split("/")[0];
                        String title = stringValue(rows, "title");
                        String label = resolveLabel(context, pkg, title);
                        JSONObject item = new JSONObject();
                        item.put("label", label == null ? "" : label);
                        item.put("package", pkg);
                        item.put("component", component == null ? "" : component);
                        item.put("screen", intValue(rows, "screen", -1));
                        item.put("cellX", intValue(rows, "cellX", -1));
                        item.put("cellY", intValue(rows, "cellY", -1));
                        samples.put(item);
                    }
                } finally {
                    if (rows != null) rows.close();
                }

                result.put("path", remotePath);
                result.put("file", name);
                result.put("columns", columnArray);
                result.put("containers", containers);
                result.put("appShortcutCount", appShortcutCount);
                result.put("totalRows", totalRows);
                result.put("samples", samples);
                return result;
            } catch (Throwable t) {
                addDiag(diag, name + "：打开失败 " + String.valueOf(t.getMessage()));
            } finally {
                if (columns != null) columns.close();
                if (tables != null) tables.close();
                if (db != null) db.close();
                deleteTree(cache);
            }
        }
        return null;
    }

    private static void diagCmd(JSONArray diag, String label, String command, int max) {
        RootBridge.Result result = RootBridge.run(command);
        String output = result.output == null ? "" : result.output.trim();
        addDiag(diag, label + " [exit=" + result.exitCode + "] " + (output.isEmpty() ? "(空)" : trim(output, max)));
    }

    private static void addDataDirDiag(JSONArray diag, String pkg) {
        RootBridge.Result result = RootBridge.run("dumpsys package " + pkg);
        String output = result.output == null ? "" : result.output;
        boolean found = false;
        for (String line : output.split("\\r?\\n")) {
            String value = line.trim();
            if (value.contains("dataDir=") || value.contains("codePath=")) {
                addDiag(diag, "package：" + value);
                found = true;
            }
        }
        if (!found) addDiag(diag, "package：dumpsys 没有 dataDir（exit=" + result.exitCode + "）");
    }

    private static String findDatabasesDirs(List<String> packages) {
        // 不再依赖 shell 的 for/if，直接枚举所有候选路径；目录不存在也会在 diag 里留下 ls 错误。
        StringBuilder result = new StringBuilder();
        for (String pkg : packages) {
            String safe = pkg.replaceAll("[^a-zA-Z0-9._-]", "");
            if (safe.isEmpty()) continue;
            result.append("/data/user/0/").append(safe).append("/databases\n");
            result.append("/data/user_de/0/").append(safe).append("/databases\n");
        }
        return result.toString();
    }

    private static String resolveLabel(Context context, String pkg, String title) {
        if (title != null && !title.isEmpty()) return title;
        if (pkg == null || pkg.isEmpty()) return "";
        try {
            ApplicationInfo ai = context.getPackageManager().getApplicationInfo(pkg, 0);
            return String.valueOf(ai.loadLabel(context.getPackageManager()));
        } catch (Exception ignored) {
            return pkg;
        }
    }

    private static boolean isAccessibilityEnabled(Context context) {
        try {
            int enabled = Settings.Secure.getInt(context.getContentResolver(), Settings.Secure.ACCESSIBILITY_ENABLED, 0);
            if (enabled != 1) return false;
            String services = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (services == null) return false;
            String pkg = context.getPackageName();
            String cls = SpiritAccessibilityService.class.getName();
            String shortName = pkg + "/." + SpiritAccessibilityService.class.getSimpleName();
            return services.contains(pkg + "/" + cls)
                || services.contains(shortName)
                || services.contains(new ComponentName(context, SpiritAccessibilityService.class).flattenToString());
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String getProp(String key) {
        Process process = null;
        try {
            process = new ProcessBuilder("getprop", key).redirectErrorStream(true).start();
            InputStream in = process.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[512];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            process.waitFor();
            return new String(out.toByteArray(), StandardCharsets.UTF_8).trim();
        } catch (Exception ignored) {
            return "";
        } finally {
            if (process != null) process.destroy();
        }
    }

    private static String componentOf(String intent) {
        if (intent == null) return null;
        Matcher m = COMPONENT.matcher(intent);
        return m.find() ? m.group(1) : null;
    }

    private static String stringValue(Cursor cursor, String column) {
        int index = cursor.getColumnIndex(column);
        return index < 0 || cursor.isNull(index) ? null : cursor.getString(index);
    }

    private static int intValue(Cursor cursor, String column, int fallback) {
        int index = cursor.getColumnIndex(column);
        return index < 0 || cursor.isNull(index) ? fallback : cursor.getInt(index);
    }

    private static void add(List<String> list, String value) {
        if (value != null && !value.isEmpty() && !list.contains(value)) list.add(value);
    }

    private static List<String> uniqueLines(String text) {
        List<String> lines = new ArrayList<>();
        if (text == null) return lines;
        for (String line : text.split("\\r?\\n")) {
            String value = line.trim();
            if (!value.isEmpty() && !lines.contains(value)) lines.add(value);
        }
        return lines;
    }

    private static String join(List<String> values) {
        StringBuilder out = new StringBuilder();
        for (String value : values) {
            if (out.length() > 0) out.append(' ');
            out.append(value);
        }
        return out.toString();
    }

    private static void dumpTables(SQLiteDatabase db, String label, JSONArray diag) {
        Cursor tables = null;
        try {
            tables = db.rawQuery("SELECT name FROM sqlite_master WHERE type='table'", null);
            List<String> names = new ArrayList<>();
            while (tables.moveToNext()) {
                String table = tables.getString(tables.getColumnIndex("name"));
                if (table != null && !table.startsWith("sqlite_")) names.add(table);
            }
            addDiag(diag, label + " 表清单（" + names.size() + "）：" + trim(join(names), 600));
            for (String table : names) {
                Cursor columns = null;
                try {
                    columns = db.rawQuery("PRAGMA table_info(" + table + ")", null);
                    List<String> cols = new ArrayList<>();
                    while (columns.moveToNext()) {
                        String col = columns.getString(columns.getColumnIndex("name"));
                        if (col != null) cols.add(col);
                    }
                    addDiag(diag, "  " + table + "：" + trim(join(cols), 300));
                } catch (Throwable ignored) {
                } finally {
                    if (columns != null) columns.close();
                }
            }
        } catch (Throwable t) {
            addDiag(diag, label + " 表清单失败：" + String.valueOf(t.getMessage()));
        } finally {
            if (tables != null) tables.close();
        }
    }

    private static String firstToken(String value) {
        if (value == null) return "";
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return "";
        String[] parts = trimmed.split(" ");
        return parts.length == 0 ? "" : parts[0];
    }

    private static String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.isEmpty()) return value;
        }
        return "";
    }

    private static String trim(String value, int max) {
        if (value == null) return "";
        String oneLine = value.replace('\n', ' ').trim();
        return oneLine.length() <= max ? oneLine : oneLine.substring(0, max) + "…";
    }

    private static void addDiag(JSONArray diag, String text) {
        try {
            diag.put(text);
        } catch (Exception ignored) {
        }
    }

    private static String quote(String value) {
        return "'" + value.replace("'", "'\\''") + "'";
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
