package com.piaony.tafei;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.util.Base64;
import android.net.Uri;
import android.os.Build;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;

import androidx.core.graphics.Insets;
import androidx.core.view.OnApplyWindowInsetsListener;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * 挞飞 App 外壳：
 * 1) 系统栏安全区适配（顶部状态栏 / 底部手势区不再压住内容）
 * 2) 返回键分级处理：先关弹层 → 再退上一页 → 最后“再按一次退出”
 * 3) 启动 / 回到前台时检查新版本（12 小时内最多一次），「我的」页可手动触发
 * 4) 给网页暴露 TafeiNative 桥，用于读版本号 / 手动检查更新
 */
public class MainActivity extends BridgeActivity {

    private static final String BG = "#080D1B";
    private long lastBackAt = 0L;
    private long lastBackCallAt = 0L;
    private boolean firstCheckDone = false;
    private String pendingPage = null;
    private boolean pageHandled = false;
    private long lastA11yTryAt = 0L;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor(BG)));

        WebView webView = (this.bridge != null) ? this.bridge.getWebView() : null;
        if (webView == null) return;

        webView.setBackgroundColor(Color.parseColor(BG));
        webView.addJavascriptInterface(new NativeBridge(this), "TafeiNative");
        NotificationHelper.ensureChannel(this);
        readPageIntent(getIntent());

        ViewCompat.setOnApplyWindowInsetsListener(webView, new OnApplyWindowInsetsListener() {
            @Override
            public WindowInsetsCompat onApplyWindowInsets(View v, WindowInsetsCompat insets) {
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            }
        });
        ViewCompat.requestApplyInsets(webView);

        /* 启动后稍等一会儿再检查更新，避免和启动图、首屏加载抢资源 */
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                if (isFinishing()) return;
                firstCheckDone = true;
                UpdateChecker.maybeCheck(MainActivity.this);
            }
        }, 1600L);
    }

    @Override
    public void onResume() {
        super.onResume();
        maybeEnableRootA11y();
        SpiritOverlayService.onAppState(this, true);
        /* 切回前台时再检查一次（内部有 12 小时节流，不会频繁请求） */
        if (firstCheckDone) UpdateChecker.maybeCheck(this);
        openPendingPage();
    }

    private void maybeEnableRootA11y() {
        if (!getSharedPreferences("tafei_app", 0).getBoolean("overlay_root_global", false)) return;
        if (SpiritAccessibilityService.isReady()) return;
        long now = System.currentTimeMillis();
        if (now - lastA11yTryAt < 20000L) return;
        lastA11yTryAt = now;
        new Thread(new Runnable() {
            @Override
            public void run() {
                if (!RootBridge.isGranted()) return;
                SpiritAccessibilityService.enableViaRoot(MainActivity.this);
                try {
                    Thread.sleep(1200L);
                } catch (InterruptedException ignored) {
                }
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        SpiritOverlayService.updatePrefs(MainActivity.this);
                    }
                });
            }
        }, "tafei-root-a11y").start();
    }

    @Override
    public void onPause() {
        SpiritOverlayService.onAppState(this, false);
        super.onPause();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readPageIntent(intent);
        openPendingPage();
    }

    private void readPageIntent(Intent intent) {
        if (intent == null) return;
        String page = intent.getStringExtra("tafei_page");
        if (page != null && !page.isEmpty()) {
            pendingPage = page;
            pageHandled = false;
        }
    }

    /** 从通知点进来后，等网页加载好再切到社区页。 */
    private void openPendingPage() {
        if (pendingPage == null || pageHandled) return;
        pageHandled = true;
        final String page = pendingPage;
        pendingPage = null;
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                WebView webView = (MainActivity.this.bridge != null) ? MainActivity.this.bridge.getWebView() : null;
                if (webView == null) return;
                String js = "(function(){try{if(window.TAFEIViews&&TAFEIViews.showPage){TAFEIViews.showPage('"
                        + page.replace("'", "") + "');}return 1;}catch(e){return 0;}})()";
                webView.evaluateJavascript(js, null);
            }
        }, 900L);
    }

    @Override
    public void onBackPressed() {
        long now = SystemClock.elapsedRealtime();
        if (now - lastBackCallAt < 300L) return;
        lastBackCallAt = now;

        WebView webView = (this.bridge != null) ? this.bridge.getWebView() : null;
        if (webView == null) {
            super.onBackPressed();
            return;
        }

        webView.evaluateJavascript(
            "(function(){try{return (window.__tafeiBack && window.__tafeiBack()==='1')?'1':'pass';}catch(e){return 'pass';}})()",
            value -> handleBack(webView, value));
    }

    private void handleBack(WebView webView, String value) {
        String v = (value == null) ? "" : value.replace("\"", "").trim();
        if (v.equals("1")) return; // 弹层已关闭，本次返回消费掉
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        long now = SystemClock.elapsedRealtime();
        if (now - lastBackAt < 2000L) {
            finish();
            return;
        }
        lastBackAt = now;
        Toast.makeText(getApplicationContext(), "再按一次退出挞飞", Toast.LENGTH_SHORT).show();
    }

    /* 供「我的」页调用：读版本号、手动检查更新 */
    public static class NativeBridge {
        private final MainActivity act;
        private final Map<String, String> iconCache = new HashMap<>();

        NativeBridge(MainActivity a) {
            this.act = a;
        }

        @JavascriptInterface
        public String appVersion() {
            return UpdateChecker.versionNameOf(act);
        }

        @JavascriptInterface
        public int appCode() {
            return UpdateChecker.currentVersionCode(act);
        }

        @JavascriptInterface
        public void checkUpdate() {
            act.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    act.getSharedPreferences("tafei_app", 0).edit().remove("last_check_at").apply();
                    UpdateChecker.maybeCheck(act);
                }
            });
        }

        @JavascriptInterface
        public void notifyMessage(String title, String body, String page) {
            NotificationHelper.show(act, title, body, page);
        }

        @JavascriptInterface
        public void requestNotifyPermission() {
            act.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    NotificationHelper.requestPermission(act);
                }
            });
        }

        @JavascriptInterface
        public String notificationsAllowed() {
            return NotificationHelper.hasPermission(act) ? "1" : "0";
        }

        @JavascriptInterface
        public String desktopProbeSupported() {
            return "1";
        }

        @JavascriptInterface
        public String desktopProbe() {
            return DesktopProbe.probe(act);
        }

        @JavascriptInterface
        public String accessibilityReady() {
            return SpiritAccessibilityService.isReady() ? "1" : "0";
        }

        @JavascriptInterface
        public void openAccessibility() {
            act.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        act.startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
                    } catch (Exception ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public String desktopEatStatus() {
            return SpiritAccessibilityService.lastResult();
        }

        @JavascriptInterface
        public String desktopEatEvent() {
            return SpiritAccessibilityService.lastEvent();
        }

        @JavascriptInterface
        public String desktopActionStatus() {
            return SpiritAccessibilityService.lastResult();
        }

        @JavascriptInterface
        public String desktopActionEvent() {
            return SpiritAccessibilityService.lastEvent();
        }

        @JavascriptInterface
        public String desktopAppIcon(String pkg) {
            if (pkg == null || pkg.trim().isEmpty()) return "";
            String cached = iconCache.get(pkg);
            if (cached != null) return cached;
            try {
                Drawable drawable = act.getPackageManager().getApplicationIcon(pkg);
                int size = Math.round(56 * act.getResources().getDisplayMetrics().density);
                Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bitmap);
                drawable.setBounds(0, 0, size, size);
                drawable.draw(canvas);
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.PNG, 90, out);
                String data = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                iconCache.put(pkg, data);
                return data;
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String launcherDbWriteEnabled() {
            return LauncherDbOps.isEnabled(act) ? "1" : "0";
        }

        @JavascriptInterface
        public String setLauncherDbWriteEnabled(String enabled) {
            return LauncherDbOps.setEnabledWithBackup(act, "1".equals(enabled) || "true".equals(enabled));
        }

        @JavascriptInterface
        public String desktopAction(String action, String payload) {
            if (LauncherDbOps.isEnabled(act)) {
                return LauncherDbOps.start(act, action, payload);
            }
            if (!SpiritAccessibilityService.isReady()) {
                openAccessibility();
                return "accessibility-off";
            }
            final String actionArg = action;
            final String payloadArg = payload;
            act.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent home = new Intent(Intent.ACTION_MAIN);
                        home.addCategory(Intent.CATEGORY_HOME);
                        home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        act.startActivity(home);
                    } catch (Throwable ignored) {
                    }
                    new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            SpiritAccessibilityService.startDesktopAction(actionArg, payloadArg);
                        }
                    }, 900L);
                }
            });
            return "started";
        }

        @JavascriptInterface
        public String eatDesktopIcon(String label, String pkg, int screen, int cellX, int cellY) {
            if (!SpiritAccessibilityService.isReady()) {
                openAccessibility();
                return "accessibility-off";
            }
            if (label == null || label.trim().isEmpty()) return "no-icon";
            act.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent home = new Intent(Intent.ACTION_MAIN);
                    home.addCategory(Intent.CATEGORY_HOME);
                    home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try {
                        act.startActivity(home);
                    } catch (Exception e) {
                        Toast.makeText(act, "无法回到桌面", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    Toast.makeText(act, "正在长按「" + label + "」…", Toast.LENGTH_SHORT).show();
                    SpiritAccessibilityService.eatIcon(label, pkg, screen, cellX, cellY);
                }
            });
            return "started";
        }

        @JavascriptInterface
        public String overlaySupported() {
            return Build.VERSION.SDK_INT >= 23 ? "1" : "0";
        }

        @JavascriptInterface
        public String overlayStatus() {
            if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(act)) return "denied";
            boolean on = act.getSharedPreferences("tafei_app", 0)
                .getBoolean("overlay_enabled", false);
            return on ? "on" : "off";
        }

        @JavascriptInterface
        public void requestOverlayPermission() {
            act.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + act.getPackageName()));
                        act.startActivity(intent);
                    } catch (Exception e) {
                        try {
                            act.startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION));
                        } catch (Exception ignored) {
                        }
                    }
                }
            });
        }

        @JavascriptInterface
        public String startOverlay() {
            if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(act)) return "denied";
            act.getSharedPreferences("tafei_app", 0).edit().putBoolean("overlay_enabled", true).apply();
            if (Build.VERSION.SDK_INT >= 33
                && act.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                act.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        act.requestPermissions(
                            new String[]{Manifest.permission.POST_NOTIFICATIONS}, 9201);
                    }
                });
            }
            try {
                SpiritOverlayService.start(act);
                return "on";
            } catch (Exception e) {
                return "off";
            }
        }

        @JavascriptInterface
        public String stopOverlay() {
            act.getSharedPreferences("tafei_app", 0).edit().putBoolean("overlay_enabled", false).apply();
            SpiritOverlayService.stop(act);
            return "off";
        }

        @JavascriptInterface
        public int overlaySize() {
            return act.getSharedPreferences("tafei_app", 0).getInt("overlay_size", 100);
        }

        @JavascriptInterface
        public int overlayOpacity() {
            return act.getSharedPreferences("tafei_app", 0).getInt("overlay_opacity", 100);
        }

        @JavascriptInterface
        public void setOverlaySize(int percent) {
            int value = Math.max(70, Math.min(130, percent));
            act.getSharedPreferences("tafei_app", 0).edit().putInt("overlay_size", value).apply();
            SpiritOverlayService.updatePrefs(act);
        }

        @JavascriptInterface
        public void setOverlayOpacity(int percent) {
            int value = Math.max(40, Math.min(100, percent));
            act.getSharedPreferences("tafei_app", 0).edit().putInt("overlay_opacity", value).apply();
            SpiritOverlayService.updatePrefs(act);
        }

        @JavascriptInterface
        public String overlayAutonomy() {
            return act.getSharedPreferences("tafei_app", 0)
                .getBoolean("overlay_autonomy", true) ? "1" : "0";
        }

        @JavascriptInterface
        public String overlayDoodle() {
            return act.getSharedPreferences("tafei_app", 0)
                .getBoolean("overlay_doodle", true) ? "1" : "0";
        }

        @JavascriptInterface
        public void setOverlayAutonomy(int on) {
            act.getSharedPreferences("tafei_app", 0).edit()
                .putBoolean("overlay_autonomy", on != 0).apply();
            SpiritOverlayService.updatePrefs(act);
        }

        @JavascriptInterface
        public void setOverlayDoodle(int on) {
            act.getSharedPreferences("tafei_app", 0).edit()
                .putBoolean("overlay_doodle", on != 0).apply();
            SpiritOverlayService.updatePrefs(act);
        }
        @JavascriptInterface
        public String overlayAvoidIcons() {
            return act.getSharedPreferences("tafei_app", 0)
                .getBoolean("overlay_avoid_icons", true) ? "1" : "0";
        }

        @JavascriptInterface
        public void setOverlayAvoidIcons(int on) {
            act.getSharedPreferences("tafei_app", 0).edit()
                .putBoolean("overlay_avoid_icons", on != 0).apply();
            SpiritOverlayService.updatePrefs(act);
        }

        @JavascriptInterface
        public String overlayPickup() {
            return act.getSharedPreferences("tafei_app", 0)
                .getBoolean("overlay_pickup", false) ? "1" : "0";
        }

        @JavascriptInterface
        public void setOverlayPickup(int on) {
            act.getSharedPreferences("tafei_app", 0).edit()
                .putBoolean("overlay_pickup", on != 0).apply();
            SpiritOverlayService.updatePrefs(act);
        }

        @JavascriptInterface
        public String overlayRootGlobal() {
            return act.getSharedPreferences("tafei_app", 0)
                .getBoolean("overlay_root_global", false) ? "1" : "0";
        }

        @JavascriptInterface
        public String setOverlayRootGlobal(int on) {
            if (on != 0 && !RootBridge.isGranted()) return "no-root";
            act.getSharedPreferences("tafei_app", 0).edit()
                .putBoolean("overlay_root_global", on != 0).apply();
            SpiritOverlayService.updatePrefs(act);
            if (on != 0) act.maybeEnableRootA11y();
            return "1";
        }

        @JavascriptInterface
        public String overlayRootModeStatus() {
            return SpiritOverlayService.rootModeStatus();
        }
        @JavascriptInterface
        public String overlayDebug() {
            SharedPreferences sp = act.getSharedPreferences("tafei_app", 0);
            boolean root = RootBridge.isGranted();
            boolean a11y = SpiritAccessibilityService.isReady();
            String layer = SpiritOverlayService.rootModeStatus();
            return "root=" + (root ? "1" : "0")
                + " a11y=" + (a11y ? "1" : "0")
                + " layer=" + layer
                + " avoid=" + (sp.getBoolean("overlay_avoid_icons", true) ? "1" : "0")
                + " pickup=" + (sp.getBoolean("overlay_pickup", false) ? "1" : "0");
        }

        @JavascriptInterface
        public void setOverlaySpirit(String id) {
            String safe = (id == null) ? "xiaota" : id.replaceAll("[^a-zA-Z0-9_-]", "");
            if (safe.isEmpty()) safe = "xiaota";
            act.getSharedPreferences("tafei_app", 0).edit().putString("overlay_spirit", safe).apply();
            SpiritOverlayService.updateSpirit(act);
        }

        @JavascriptInterface
        public void toast(String msg) {
            final String m = msg;
            act.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(act, m, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
