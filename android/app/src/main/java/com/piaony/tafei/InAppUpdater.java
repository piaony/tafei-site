package com.piaony.tafei;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;

/**
 * App 内更新：DownloadManager 后台下载 APK → FileProvider 交给系统安装器
 * 下载期间可在通知栏看进度，App 可继续使用；未授权「安装未知应用」时先引导设置，返回后自动续装
 */
public class InAppUpdater {

    private static final String TAG = "TafeiUpdater";
    private static final String PREFS = "tafei_app";
    private static final String K_APK = "pending_apk_path";
    private static final String APK_URL = "https://github.com/Piaony/tafei-site/releases/latest/download/app-release.apk";

    private static File apkFile(Activity act) {
        File dir = null;
        try { dir = act.getExternalFilesDir(null); } catch (Throwable ignored) {}
        if (dir == null) dir = act.getFilesDir();
        return new File(dir, "tafei-update.apk");
    }

    private static void toast(final Activity act, final String msg) {
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override public void run() {
                try { Toast.makeText(act, msg, Toast.LENGTH_SHORT).show(); } catch (Throwable ignored) {}
            }
        });
    }

    public static void start(final Activity act) {
        if (act == null) return;
        final File out = apkFile(act);
        try { if (out.exists()) out.delete(); } catch (Throwable ignored) {}

        DownloadManager dm = null;
        try { dm = (DownloadManager) act.getSystemService(Context.DOWNLOAD_SERVICE); } catch (Throwable ignored) {}

        if (dm == null) {
            toast(act, "当前系统不支持应用内下载，已打开浏览器");
            openInBrowser(act);
            return;
        }

        try {
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(APK_URL));
            req.setTitle("挞飞 新版本");
            req.setDescription("正在后台下载安装包，完成后自动提示安装");
            req.setMimeType("application/vnd.android.package-archive");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationUri(Uri.fromFile(out));

            long id = dm.enqueue(req);
            act.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(K_APK, out.getAbsolutePath()).apply();

            toast(act, "已在后台下载更新，可继续使用");
            watch(act, dm, id, out);
        } catch (Throwable t) {
            Log.w(TAG, "enqueue failed: " + t);
            toast(act, "应用内下载失败，已打开浏览器");
            openInBrowser(act);
        }
    }

    private static void watch(final Activity act, final DownloadManager dm, final long id, final File out) {
        new Thread(new Runnable() {
            @Override public void run() {
                int last = -1;
                for (int i = 0; i < 900; i++) {
                    try { Thread.sleep(1000L); } catch (InterruptedException e) { return; }
                    Cursor c = null;
                    try {
                        c = dm.query(new DownloadManager.Query().setFilterById(id));
                        if (c == null || !c.moveToFirst()) continue;
                        int status = c.getInt(c.getColumnIndex(DownloadManager.COLUMN_STATUS));
                        long done = c.getLong(c.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                        long total = c.getLong(c.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));

                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            new Handler(Looper.getMainLooper()).post(new Runnable() {
                                @Override public void run() { install(act, out); }
                            });
                            return;
                        }
                        if (status == DownloadManager.STATUS_FAILED) {
                            int reason = c.getInt(c.getColumnIndex(DownloadManager.COLUMN_REASON));
                            Log.w(TAG, "download failed reason=" + reason);
                            toast(act, "下载失败，请稍后到「我的 · 检查更新」重试");
                            return;
                        }
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct >= last + 25) { last = pct; Log.i(TAG, "download " + pct + "%"); }
                        }
                    } catch (Throwable t) {
                        Log.w(TAG, "watch failed: " + t);
                    } finally {
                        if (c != null) c.close();
                    }
                }
            }
        }, "tafei-update-watch").start();
    }

    public static void install(Activity act, File file) {
        if (act == null || file == null || !file.exists()) return;

        if (Build.VERSION.SDK_INT >= 26) {
            try {
                if (!act.getPackageManager().canRequestPackageInstalls()) {
                    toast(act, "请允许挞飞安装应用，返回后会自动继续");
                    openUnknownSources(act);
                    return;
                }
            } catch (Throwable ignored) {}
        }

        try {
            Uri uri = FileProvider.getUriForFile(act, act.getPackageName() + ".fileprovider", file);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            act.startActivity(i);
        } catch (Throwable t) {
            Log.w(TAG, "install failed: " + t);
            toast(act, "安装界面没打开，请到「我的 · 检查更新」再点一次");
        }
    }

    /* 权限页返回后自动续装 */
    public static void installPending(Activity act) {
        if (act == null) return;
        SharedPreferences sp = act.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String path = sp.getString(K_APK, "");
        if (path == null || path.isEmpty()) return;

        File f = new File(path);
        if (!f.exists()) { sp.edit().remove(K_APK).apply(); return; }

        if (Build.VERSION.SDK_INT >= 26) {
            try {
                if (!act.getPackageManager().canRequestPackageInstalls()) return;
            } catch (Throwable ignored) { return; }
        }
        sp.edit().remove(K_APK).apply();
        install(act, f);
    }

    private static void openUnknownSources(Activity act) {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            act.startActivity(i);
        } catch (Throwable t) {
            Log.w(TAG, "settings failed: " + t);
        }
    }

    private static void openInBrowser(Activity act) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(APK_URL));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            act.startActivity(i);
        } catch (Throwable t) {
            Log.w(TAG, "browser failed: " + t);
        }
    }
}
