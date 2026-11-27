package com.piaony.thermal;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Root-backed, best-effort thermal tuning for ColorOS / MediaTek devices.
 * Only passive trip points are touched; critical/hot protection is never modified.
 */
public final class ThermalController {

    public static final String MODE_DEFAULT = "default";
    public static final String MODE_GAME = "game";
    public static final String MODE_EXTREME = "extreme";

    public static final int GAME_TEMP = 95000;
    public static final int EXTREME_TEMP = 100000;

    private static final String PREFS = "thermal_prefs_v1";
    private static final String KEY_MODE = "selected_mode";
    private static final String KEY_PROPS_BACKED_UP = "props_backed_up";
    private static final String KEY_ORIG_LEVEL = "orig_level";
    private static final String KEY_ORIG_POWERCTL = "orig_powerctl";
    private static final String KEY_ORIG_GAME = "orig_game";

    private final Context context;
    private final SharedPreferences prefs;

    public ThermalController(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static final class Zone {
        public final String path;
        public final String type;
        public final int tempMilli;
        public final String passiveTrip;
        public final int passiveTemp;

        Zone(String path, String type, int tempMilli, String passiveTrip, int passiveTemp) {
            this.path = path;
            this.type = type;
            this.tempMilli = tempMilli;
            this.passiveTrip = passiveTrip;
            this.passiveTemp = passiveTemp;
        }
    }

    public static final class Snapshot {
        public final Double cpu;
        public final Double gpu;
        public final Double shell;
        public final int zoneCount;
        public final int passiveCount;

        Snapshot(Double cpu, Double gpu, Double shell, int zoneCount, int passiveCount) {
            this.cpu = cpu;
            this.gpu = gpu;
            this.shell = shell;
            this.zoneCount = zoneCount;
            this.passiveCount = passiveCount;
        }
    }

    public static final class ApplyResult {
        public final int changed;
        public final int skipped;
        public final int failed;
        public final boolean propsOk;
        public final String detail;
        public final String mode;

        ApplyResult(String mode, int changed, int skipped, int failed, boolean propsOk, String detail) {
            this.mode = mode;
            this.changed = changed;
            this.skipped = skipped;
            this.failed = failed;
            this.propsOk = propsOk;
            this.detail = detail;
        }
    }

    public static final class RootResult {
        public final boolean ok;
        public final String output;
        public final int exitCode;

        RootResult(boolean ok, String output, int exitCode) {
            this.ok = ok;
            this.output = output;
            this.exitCode = exitCode;
        }
    }

    public boolean hasRoot() {
        RootResult result = runSu("id");
        return result.ok && result.output.contains("uid=0");
    }

    public RootResult runSu(String script) {
        Process process = null;
        try {
            process = new ProcessBuilder("su", "-c", script)
                    .redirectErrorStream(true)
                    .start();
            boolean finished = process.waitFor(20, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new RootResult(false, "root command timeout", -1);
            }
            StringBuilder out = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    out.append(line).append('\n');
                }
            }
            int code = process.exitValue();
            String text = out.toString().trim();
            boolean ok = code == 0 && !text.contains("Permission denied")
                    && !text.contains("Read-only file system") && !text.contains("Operation not permitted");
            return new RootResult(ok, text, code);
        } catch (Exception e) {
            if (process != null) process.destroyForcibly();
            return new RootResult(false, e.getClass().getSimpleName() + ": " + e.getMessage(), -1);
        }
    }

    public List<Zone> readZones() {
        List<Zone> zones = new ArrayList<>();
        File base = new File("/sys/class/thermal");
        File[] dirs = base.listFiles();
        if (dirs == null) return zones;
        for (File dir : dirs) {
            if (dir == null || !dir.isDirectory() || !dir.getName().startsWith("thermal_zone")) {
                continue;
            }
            String type = readFile(new File(dir, "type")).trim();
            if (type.isEmpty()) continue;
            int temp = parseInt(readFile(new File(dir, "temp")).trim(), 0);
            String passiveTrip = "";
            int passiveTemp = 0;
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    String name = f.getName();
                    if (!name.startsWith("trip_point_") || !name.endsWith("_type")) continue;
                    String trip = name.substring(0, name.length() - 5);
                    String tripType = readFile(f).trim().toLowerCase(Locale.US);
                    if (!tripType.contains("passive")) continue;
                    int value = parseInt(readFile(new File(dir, trip + "_temp")).trim(), 0);
                    if (value <= 0) continue;
                    if (passiveTrip.isEmpty() || value < passiveTemp) {
                        passiveTrip = trip;
                        passiveTemp = value;
                    }
                }
            }
            zones.add(new Zone(dir.getAbsolutePath(), type, temp, passiveTrip, passiveTemp));
        }
        return zones;
    }

    public Snapshot snapshot() {
        List<Zone> zones = readZones();
        Double cpu = maxByType(zones, "cpu");
        Double gpu = maxByType(zones, "gpu");
        Double shell = shellTemp(zones);
        int passive = 0;
        for (Zone z : zones) {
            if (!z.passiveTrip.isEmpty()) passive++;
        }
        return new Snapshot(cpu, gpu, shell, zones.size(), passive);
    }

    private Double maxByType(List<Zone> zones, String kind) {
        Double max = null;
        for (Zone z : zones) {
            String t = z.type.toLowerCase(Locale.US);
            boolean match;
            if (kind.equals("cpu")) {
                match = t.startsWith("cpuss") || t.startsWith("cpu-") || t.equals("cpu");
            } else {
                match = t.startsWith("gpuss") || t.startsWith("gpu-") || t.equals("gpu");
            }
            if (!match || z.tempMilli <= 0) continue;
            double value = z.tempMilli / 1000.0;
            if (max == null || value > max) max = value;
        }
        return max;
    }

    private Double shellTemp(List<Zone> zones) {
        Double fallback = null;
        for (Zone z : zones) {
            String t = z.type.toLowerCase(Locale.US);
            if (z.tempMilli <= 0) continue;
            if (t.equals("shell_back")) return z.tempMilli / 1000.0;
            if (t.startsWith("shell_") || t.equals("skin-msm-therm")) {
                double v = z.tempMilli / 1000.0;
                if (fallback == null || v < fallback) fallback = v;
            }
        }
        return fallback;
    }

    public ApplyResult applyMode(String mode) {
        if (MODE_DEFAULT.equals(mode)) {
            return restoreDefault();
        }
        int target = MODE_EXTREME.equals(mode) ? EXTREME_TEMP : GAME_TEMP;
        List<Zone> zones = readZones();
        int changed = 0;
        int skipped = 0;
        int failed = 0;
        StringBuilder detail = new StringBuilder();
        backupProperties();

        for (Zone z : zones) {
            if (!isPerformanceZone(z.type) || z.passiveTrip.isEmpty()) continue;
            if (z.passiveTemp >= target) {
                skipped++;
                detail.append("skip ").append(z.type).append(" (already >= ")
                        .append(formatTemp(z.passiveTemp)).append(")\n");
                continue;
            }
            String key = originalKey(z);
            if (!prefs.contains(key)) {
                prefs.edit().putInt(key, z.passiveTemp).apply();
            }
            RootResult wr = runSu("echo " + target + " > " + z.path + "/" + z.passiveTrip + "_temp");
            if (wr.ok) {
                changed++;
                detail.append("set ").append(z.type).append(" ")
                        .append(z.passiveTrip).append(" -> ").append(formatTemp(target)).append("\n");
            } else {
                failed++;
                detail.append("FAIL ").append(z.type).append(": ").append(wr.output).append("\n");
            }
        }

        String level = "0";
        String power = "false";
        String game = "false";
        RootResult props = runSu(
                "setprop persist.sys.thermal.level " + level + "\n" +
                "setprop persist.thermal.powerctl.enable " + power + "\n" +
                "setprop persist.game.thermal.enable " + game);
        boolean propsOk = props.ok;
        prefs.edit().putString(KEY_MODE, mode).apply();
        return new ApplyResult(mode, changed, skipped, failed, propsOk, detail.toString().trim());
    }

    private ApplyResult restoreDefault() {
        List<Zone> zones = readZones();
        int restored = 0;
        int failed = 0;
        StringBuilder detail = new StringBuilder();
        for (Zone z : zones) {
            if (!isPerformanceZone(z.type) || z.passiveTrip.isEmpty()) continue;
            String key = originalKey(z);
            int original = prefs.getInt(key, -1);
            if (original <= 0) continue;
            RootResult wr = runSu("echo " + original + " > " + z.path + "/" + z.passiveTrip + "_temp");
            if (wr.ok) {
                restored++;
                detail.append("restore ").append(z.type).append(" -> ")
                        .append(formatTemp(original)).append("\n");
            } else {
                failed++;
                detail.append("FAIL ").append(z.type).append(": ").append(wr.output).append("\n");
            }
        }
        RootResult props = restoreProperties();
        prefs.edit().putString(KEY_MODE, MODE_DEFAULT).apply();
        return new ApplyResult(MODE_DEFAULT, restored, 0, failed, props.ok, detail.toString().trim());
    }

    private void backupProperties() {
        if (prefs.getBoolean(KEY_PROPS_BACKED_UP, false)) return;
        RootResult r = runSu(
                "echo L=$(getprop persist.sys.thermal.level)\n" +
                "echo P=$(getprop persist.thermal.powerctl.enable)\n" +
                "echo G=$(getprop persist.game.thermal.enable)");
        String level = "1";
        String power = "true";
        String game = "true";
        for (String line : r.output.split("\n")) {
            if (line.startsWith("L=")) level = emptyFallback(line.substring(2), level);
            if (line.startsWith("P=")) power = emptyFallback(line.substring(2), power);
            if (line.startsWith("G=")) game = emptyFallback(line.substring(2), game);
        }
        prefs.edit()
                .putString(KEY_ORIG_LEVEL, level)
                .putString(KEY_ORIG_POWERCTL, power)
                .putString(KEY_ORIG_GAME, game)
                .putBoolean(KEY_PROPS_BACKED_UP, true)
                .apply();
    }

    private RootResult restoreProperties() {
        String level = prefs.getString(KEY_ORIG_LEVEL, "1");
        String power = prefs.getString(KEY_ORIG_POWERCTL, "true");
        String game = prefs.getString(KEY_ORIG_GAME, "true");
        return runSu(
                "setprop persist.sys.thermal.level " + safeValue(level, "1") + "\n" +
                "setprop persist.thermal.powerctl.enable " + safeValue(power, "true") + "\n" +
                "setprop persist.game.thermal.enable " + safeValue(game, "true"));
    }

    /** Called by BootReceiver to undo persist.* properties after a reboot. */
    public void restorePersistedPropertiesOnBoot() {
        if (!prefs.getBoolean(KEY_PROPS_BACKED_UP, false)) return;
        restoreProperties();
        prefs.edit().putString(KEY_MODE, MODE_DEFAULT).apply();
    }

    public String getSelectedMode() {
        return prefs.getString(KEY_MODE, MODE_DEFAULT);
    }

    public boolean hasTripBackup() {
        for (String key : prefs.getAll().keySet()) {
            if (key.startsWith("orig_") && key.contains("trip_point_")) return true;
        }
        return false;
    }

    public String describeCurrentSetup() {
        List<Zone> zones = readZones();
        int passive = 0;
        for (Zone z : zones) {
            if (isPerformanceZone(z.type) && !z.passiveTrip.isEmpty()) passive++;
        }
        return "识别 " + zones.size() + " 个温控区 · " + passive + " 个可调被动阈值";
    }

    private String originalKey(Zone z) {
        return "orig_" + z.path.replace('/', '_') + "_" + z.passiveTrip;
    }

    private boolean isPerformanceZone(String type) {
        String t = type.toLowerCase(Locale.US);
        return t.startsWith("cpuss") || t.startsWith("gpuss")
                || t.startsWith("cpu-") || t.startsWith("gpu-")
                || t.equals("cpu") || t.equals("gpu");
    }

    private String formatTemp(int milli) {
        return String.format(Locale.US, "%.1f℃", milli / 1000.0);
    }

    private String safeValue(String value, String fallback) {
        if (value == null || value.trim().isEmpty() || value.contains(" ")) return fallback;
        return value.trim();
    }

    private String emptyFallback(String value, String fallback) {
        if (value == null || value.trim().isEmpty()) return fallback;
        return value.trim();
    }

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(value.trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static String readFile(File file) {
        try (BufferedReader reader = new BufferedReader(new java.io.FileReader(file))) {
            String line = reader.readLine();
            return line == null ? "" : line;
        } catch (Exception ignored) {
            return "";
        }
    }
}
