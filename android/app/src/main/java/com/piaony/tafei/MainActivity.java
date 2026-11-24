package com.piaony.tafei;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor(BG)));

        WebView webView = (this.bridge != null) ? this.bridge.getWebView() : null;
        if (webView == null) return;

        webView.setBackgroundColor(Color.parseColor(BG));
        webView.addJavascriptInterface(new NativeBridge(this), "TafeiNative");

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
        /* 切回前台时再检查一次（内部有 12 小时节流，不会频繁请求） */
        if (firstCheckDone) UpdateChecker.maybeCheck(this);
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
