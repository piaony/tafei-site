package com.piaony.tafei;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** 极简 Root shell 封装：只走 KernelSU/Magisk 的 su，不把 root 逻辑放进主进程。 */
public final class RootBridge {

    public static final class Result {
        public final boolean attempted;
        public final boolean granted;
        public final int exitCode;
        public final String output;

        Result(boolean attempted, boolean granted, int exitCode, String output) {
            this.attempted = attempted;
            this.granted = granted;
            this.exitCode = exitCode;
            this.output = output == null ? "" : output;
        }
    }

    private static final String[] SU_CANDIDATES = new String[]{
        "/system/bin/su", "/system/xbin/su", "/sbin/su", "/debug_ramdisk/su", "su"
    };

    private RootBridge() {}

    public static Result run(String command) {
        String su = findSu();
        if (su == null) return new Result(false, false, -1, "no su binary");
        Process process = null;
        try {
            ProcessBuilder pb = new ProcessBuilder(su, "-c", command);
            pb.redirectErrorStream(true);
            process = pb.start();
            final Process p = process;
            Thread watchdog = new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Thread.sleep(7000L);
                    } catch (InterruptedException ignored) {
                    }
                    if (p.isAlive()) p.destroy();
                }
            });
            watchdog.setDaemon(true);
            watchdog.start();
            String output = readText(process.getInputStream());
            int code = process.waitFor();
            boolean granted = output.contains("uid=0");
            return new Result(true, granted, code, output);
        } catch (Exception e) {
            if (process != null) process.destroy();
            return new Result(true, false, -1, "su failed: " + e.getMessage());
        }
    }

    public static boolean isGranted() {
        Result r = run("id");
        return r.attempted && r.granted && r.output.contains("uid=0");
    }

    public static boolean fileExists(String path) {
        if (path == null || path.contains("\n")) return false;
        Result r = run("test -f " + quote(path) + " && echo yes");
        return r.exitCode == 0 && r.output.contains("yes");
    }

    public static byte[] readBytes(String path) {
        if (path == null || path.contains("\n")) return null;
        String su = findSu();
        if (su == null) return null;
        Process process = null;
        try {
            ProcessBuilder pb = new ProcessBuilder(su, "-c", "cat " + quote(path));
            pb.redirectErrorStream(true);
            process = pb.start();
            final Process p = process;
            Thread watchdog = new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Thread.sleep(7000L);
                    } catch (InterruptedException ignored) {
                    }
                    if (p.isAlive()) p.destroy();
                }
            });
            watchdog.setDaemon(true);
            watchdog.start();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            InputStream in = process.getInputStream();
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            int code = process.waitFor();
            if (code != 0) return null;
            return out.toByteArray();
        } catch (Exception e) {
            if (process != null) process.destroy();
            return null;
        }
    }

    public static boolean copyToFile(String remotePath, File localFile) {
        byte[] data = readBytes(remotePath);
        if (data == null || data.length == 0) return false;
        FileOutputStream out = null;
        try {
            File parent = localFile.getParentFile();
            if (parent != null && !parent.exists()) parent.mkdirs();
            out = new FileOutputStream(localFile);
            out.write(data);
            out.flush();
            return true;
        } catch (IOException e) {
            return false;
        } finally {
            if (out != null) {
                try {
                    out.close();
                } catch (IOException ignored) {
                }
            }
        }
    }

    private static String findSu() {
        for (String path : SU_CANDIDATES) {
            if (path.equals("su") || new File(path).exists()) return path;
        }
        return "su";
    }

    private static String readText(InputStream in) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int n;
        try {
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
        } catch (IOException ignored) {
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    private static String quote(String value) {
        return "'" + value.replace("'", "'\\''") + "'";
    }
}
