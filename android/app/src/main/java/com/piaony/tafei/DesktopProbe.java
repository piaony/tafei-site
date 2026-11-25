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

            if (!rootGranted) {
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

            List<String> packages = new ArrayList<>();
            add(packages, launcherPackage);
            String pmOut = RootBridge.run("pm list packages").output;
            for (String line : pmOut.split("\\r?\\n")) {
                if (!line.startsWith("package:")) continue;
                String pkg = line.substring("package:".length()).trim();
                String low = pkg.toLowerCase();
                if (low.contains("launcher") || low.contains("home")) add(packages, pkg);
                if (packages.size() >= 12) break;
            }
            add(packages, "com.oppo.launcher");
            add(packages, "com.coloros.launcher");
            add(packages, "com.oplus.launcher");
            add(packages, "com.android.launcher3");
            add(packages, "com.android.launcher");

            String dirsOut = findDatabasesDirs(packages);
            JSONObject selected = null;
            for (String dir : uniqueLines(dirsOut)) {
                JSONObject db = tryOpenLauncherDatabase(context, dir);
                if (db != null) {
                    selected = db;
                    break;
                }
            }

            if (selected == null) {
                out.put("dbError", "没有找到可读的 launcher.db / favorites 表；可能被加密或桌面包名不同");
                out.put("samples", new JSONArray());
                out.put("columns", new JSONArray());
                out.put("containers", new JSONObject());
                out.put("appShortcutCount", 0);
                out.put("totalRows", 0);
                out.put("dbPath", "");
                out.put("dbFile", "");
            } else {
                out.put("dbError", "");
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
                out.put("dbError", "探测异常：" + String.valueOf(t.getMessage()));
            } catch (Exception ignored) {
            }
        }
        return out.toString();
    }

    private static JSONObject tryOpenLauncherDatabase(Context context, String remoteDir) {
        List<String> names = new ArrayList<>();
        RootBridge.Result ls = RootBridge.run("ls -1 " + quote(remoteDir));
        for (String name : uniqueLines(ls.output)) {
            if (name.endsWith(".db") && (name.contains("launcher") || name.equals("launcher.db"))) {
                names.add(name);
            }
        }
        for (String name : names) {
            File cache = new File(context.getCacheDir(), "desktop_probe");
            deleteTree(cache);
            if (!cache.exists() && !cache.mkdirs()) continue;
            File localDb = new File(cache, "launcher_probe.db");
            String remotePath = remoteDir + "/" + name;
            if (!RootBridge.copyToFile(remotePath, localDb)) continue;
            // WAL 不能漏；只读打开时也要把 -wal/-shm 带上。
            RootBridge.copyToFile(remotePath + "-wal", new File(localDb.getAbsolutePath() + "-wal"));
            RootBridge.copyToFile(remotePath + "-shm", new File(localDb.getAbsolutePath() + "-shm"));

            SQLiteDatabase db = null;
            Cursor tables = null;
            Cursor columns = null;
            try {
                db = SQLiteDatabase.openDatabase(localDb.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
                tables = db.rawQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='favorites'", null);
                if (!tables.moveToFirst()) continue;
                tables.close();
                tables = null;

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
                if (!columnNames.contains("intent")) continue;

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
            } catch (Throwable ignored) {
                // 换下一个候选数据库
            } finally {
                if (columns != null) columns.close();
                if (tables != null) tables.close();
                if (db != null) db.close();
                deleteTree(cache);
            }
        }
        return null;
    }

    private static String findDatabasesDirs(List<String> packages) {
        StringBuilder list = new StringBuilder();
        for (String pkg : packages) {
            String safe = pkg.replaceAll("[^a-zA-Z0-9._-]", "");
            if (safe.isEmpty()) continue;
            if (list.length() > 0) list.append(' ');
            list.append(safe);
        }
        if (list.length() == 0) return "";
        String cmd = "for p in " + list + "; do "
            + "for d in /data/data/$p/databases /data/user/0/$p/databases /data/user_de/0/$p/databases; do "
            + "if [ -d \"$d\" ]; then echo \"$d\"; fi; done; done";
        return RootBridge.run(cmd).output;
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
