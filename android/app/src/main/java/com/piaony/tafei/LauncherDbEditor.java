package com.piaony.tafei;

import android.content.Context;

import java.util.List;

/**
 * 实验性的 launcher.db 坐标写入。
 * 默认关闭；只有在用户手动打开、且无障碍拖动失败时才会被调用。
 * 写入前备份数据库，事务失败时尝试恢复。
 */
public final class LauncherDbEditor {

    public static final class Update {
        public final int id;
        public final int screen;
        public final int cellX;
        public final int cellY;

        public Update(int id, int screen, int cellX, int cellY) {
            this.id = id;
            this.screen = screen;
            this.cellX = cellX;
            this.cellY = cellY;
        }
    }

    private LauncherDbEditor() {}

    public static String dbPath(Context context) {
        String cached = DesktopProbe.lastLauncherDbPath();
        if (cached != null && !cached.isEmpty()) return cached;
        RootBridge.Result pid = RootBridge.run("pidof com.android.launcher");
        String value = pid.output == null ? "" : pid.output.trim();
        if (value.isEmpty()) return "";
        String first = value.split("\\s+")[0];
        if (!first.matches("\\d+")) return "";
        return "/proc/" + first + "/root/data/user_de/0/com.android.launcher/databases/launcher.db";
    }

    public static boolean available(Context context) {
        String db = dbPath(context);
        if (db.isEmpty()) return false;
        RootBridge.Result r = RootBridge.run(
            "test -f " + q(db) + " && (command -v sqlite3 >/dev/null 2>&1 || which sqlite3 >/dev/null 2>&1) && echo YES"
        );
        return r.output != null && r.output.contains("YES");
    }

    public static boolean writePositions(Context context, List<Update> updates) {
        if (updates == null || updates.isEmpty()) return false;
        String db = dbPath(context);
        if (db.isEmpty()) return false;
        String backup = "/data/local/tmp/tafei_db_backup/launcher_" + System.currentTimeMillis() + ".db";
        RootBridge.Result backupResult = RootBridge.run(
            "mkdir -p /data/local/tmp/tafei_db_backup && cp -f " + q(db) + " " + q(backup)
                + " && (test -f " + q(db + "-wal") + " && cp -f " + q(db + "-wal") + " " + q(backup + "-wal") + " || true)"
                + " && (test -f " + q(db + "-shm") + " && cp -f " + q(db + "-shm") + " " + q(backup + "-shm") + " || true)"
        );
        if (!(backupResult.output != null && backupResult.exitCode == 0)) return false;

        StringBuilder sql = new StringBuilder("BEGIN IMMEDIATE;");
        for (Update update : updates) {
            if (update == null || update.id <= 0) continue;
            sql.append("UPDATE singledesktopitems SET screen=")
                .append(update.screen).append(",cellX=").append(update.cellX)
                .append(",cellY=").append(update.cellY)
                .append(" WHERE _id=").append(update.id)
                .append(" AND container=-100 AND itemType=0;");
        }
        sql.append("COMMIT;");
        RootBridge.Result result = RootBridge.run(
            "sqlite3 " + q(db) + " " + q(sql.toString()), 15000L);
        boolean ok = result.output != null && result.exitCode == 0;
        if (!ok) {
            RootBridge.run("cp -f " + q(backup) + " " + q(db)
                + " && (test -f " + q(backup + "-wal") + " && cp -f " + q(backup + "-wal") + " " + q(db + "-wal") + " || true)"
                + " && (test -f " + q(backup + "-shm") + " && cp -f " + q(backup + "-shm") + " " + q(db + "-shm") + " || true)");
            return false;
        }
        RootBridge.run("am force-stop com.android.launcher; input keyevent 3", 8000L);
        return true;
    }

    private static String q(String value) {
        return "'" + (value == null ? "" : value.replace("'", "'\\''")) + "'";
    }
}
