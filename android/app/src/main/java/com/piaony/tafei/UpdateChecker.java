package com.piaony.tafei;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.appcompat.app.AlertDialog;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 版本更新检查：
 * 1) 主数据源：raw.githubusercontent 上的 version.json
 * 2) 备用：站点上的 version.json（Pages）
 *    raw 与 Pages 都有 CDN 缓存，可能短暂返回旧版本号，因此两源都请求、取 code 较大的那个
 * 3) 兜底：GitHub 最新 Release（tag android-vN，N 即 versionCode）
 * 12 小时内最多检查一次；用户可以「忽略此版本」。
 */
public class UpdateChecker {

    private static final String TAG = "TafeiUpdate";
    private static final String PREFS = "tafei_app";
    private static final String K_LAST = "last_check_at";
    private static final String K_SKIP = "skipped_code";

    private static final long CHECK_INTERVAL_MS = 12L * 60L * 60L * 1000L;

    private static final String PAGES_URL = "https://piaony.github.io/tafei-site/version.json";
    private static final String RAW_URL = "https://raw.githubusercontent.com/Piaony/tafei-site/main/version.json";
    private static final String API_URL = "https://api.github.com/repos/Piaony/tafei-site/releases/latest";
    private static final String APK_URL = "https://github.com/Piaony/tafei-site/releases/latest/download/app-release.apk";

    private static boolean running = false;

    private static class Remote {
        int code;
        String name;
        String notes;
    }

    public static void maybeCheck(Activity activity) {
        if (activity == null || running) return;
        final SharedPreferences sp = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (System.currentTimeMillis() - sp.getLong(K_LAST, 0L) < CHECK_INTERVAL_MS) return;

        running = true;
        final Activity act = activity;
        new Thread(new Runnable() {
            @Override
            public void run() {
                Remote remote = null;

                /* raw 与 Pages 各有一层 CDN 缓存，可能短暂返回旧版本号，
                   因此两源都取，取 code 更大的那个；两源都失败才走 API 兜底 */
                try {
                    remote = fetchFromVersionJson(RAW_URL + "?t=" + System.currentTimeMillis());
                } catch (Throwable t) {
                    Log.w(TAG, "raw json failed: " + t);
                }
                try {
                    Remote pages = fetchFromVersionJson(PAGES_URL + "?t=" + System.currentTimeMillis());
                    if (pages != null && (remote == null || pages.code > remote.code)) remote = pages;
                } catch (Throwable t) {
                    Log.w(TAG, "pages json failed: " + t);
                }
                if (remote == null) {
                    try {
                        remote = fetchFromApi();
                    } catch (Throwable t) {
                        Log.w(TAG, "api failed: " + t);
                    }
                }
                running = false;

                if (remote == null || remote.code <= 0) return;
                sp.edit().putLong(K_LAST, System.currentTimeMillis()).apply();

                int current = currentVersionCode(act);
                if (remote.code <= current) return;
                if (remote.code == sp.getInt(K_SKIP, 0)) return;

                final Remote r = remote;
                final SharedPreferences spf = sp;
                new Handler(Looper.getMainLooper()).post(new Runnable() {
                    @Override
                    public void run() {
                        showDialog(act, r, spf);
                    }
                });
            }
        }, "tafei-update-check").start();
    }

    private static void showDialog(final Activity act, final Remote r, final SharedPreferences sp) {
        if (act.isFinishing()) return;
        if (Build.VERSION.SDK_INT >= 17 && act.isDestroyed()) return;

        StringBuilder msg = new StringBuilder();
        msg.append("当前版本 v").append(versionNameOf(act)).append("，最新 v").append(r.name).append("\n\n");
        String notes = (r.notes == null) ? "" : r.notes.trim();
        if (notes.length() > 0) {
            if (notes.length() > 480) notes = notes.substring(0, 480) + "…";
            msg.append("更新内容\n").append(notes).append("\n\n");
        }
        msg.append("下载后直接覆盖安装即可，桌面图标和数据都不会丢。");

        try {
            new AlertDialog.Builder(act, R.style.TafeiDialog)
                .setTitle("发现新版本 v" + r.name)
                .setMessage(msg.toString())
                .setPositiveButton("立即更新", (dialog, which) -> openDownload(act))
                .setNegativeButton("稍后再说", null)
                .setNeutralButton("忽略此版本", (dialog, which) -> sp.edit().putInt(K_SKIP, r.code).apply())
                .show();
        } catch (Throwable t) {
            Log.w(TAG, "dialog failed: " + t);
        }
    }

    private static void openDownload(Activity act) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(APK_URL));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            act.startActivity(i);
        } catch (Throwable t) {
            Log.w(TAG, "open download failed: " + t);
        }
    }

    public static int currentVersionCode(Context c) {
        try {
            PackageInfo pi = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return (int) pi.getLongVersionCode();
            return pi.versionCode;
        } catch (Throwable t) {
            return 0;
        }
    }

    public static String versionNameOf(Context c) {
        try {
            PackageInfo pi = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return pi.versionName == null ? "?" : pi.versionName;
        } catch (Throwable t) {
            return "?";
        }
    }

    /* ---------- 数据源 ---------- */

    private static Remote fetchFromVersionJson(String url) throws Exception {
        String body = httpGet(url);
        if (body == null) return null;
        Matcher m = Pattern.compile("\"code\"\\s*:\\s*(\\d+)").matcher(body);
        if (!m.find()) return null;
        Remote r = new Remote();
        r.code = Integer.parseInt(m.group(1));
        r.name = "1.0." + r.code;
        Matcher name = Pattern.compile("\"name\"\\s*:\\s*\"([^\"]*)\"").matcher(body);
        if (name.find() && name.group(1).length() > 0) r.name = name.group(1);
        Matcher notes = Pattern.compile("\"notes\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(body);
        if (notes.find()) r.notes = unescape(notes.group(1));
        return r;
    }

    private static Remote fetchFromApi() throws Exception {
        String body = httpGet(API_URL);
        if (body == null) return null;
        Matcher tag = Pattern.compile("\"tag_name\"\\s*:\\s*\"([^\"]+)\"").matcher(body);
        if (!tag.find()) return null;
        Matcher num = Pattern.compile("android-v(\\d+)").matcher(tag.group(1));
        if (!num.find()) return null;
        Remote r = new Remote();
        r.code = Integer.parseInt(num.group(1));
        r.name = "1.0." + r.code;
        Matcher note = Pattern.compile("\"body\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(body);
        if (note.find()) r.notes = unescape(note.group(1));
        return r;
    }

    private static String httpGet(String url) throws Exception {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestProperty("User-Agent", "TAFEI-App");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Cache-Control", "no-cache");
            conn.setInstanceFollowRedirects(true);
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                Log.w(TAG, "http " + code + " for " + url);
                return null;
            }
            InputStream in = conn.getInputStream();
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) != -1) bos.write(buf, 0, n);
            in.close();
            return new String(bos.toByteArray(), "UTF-8");
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String unescape(String s) {
        return s.replace("\\n", "\n")
                .replace("\\r", "")
                .replace("\\\"", "\"")
                .replace("\\\\", "\\")
                .replace("\\t", " ");
    }
}
