package com.piaony.tafei;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
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
 */
public class MainActivity extends BridgeActivity {

    private static final String BG = "#080D1B";
    private long lastBackAt = 0L;
    private long lastBackCallAt = 0L;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor(BG)));

        WebView webView = (this.bridge != null) ? this.bridge.getWebView() : null;
        if (webView == null) return;

        webView.setBackgroundColor(Color.parseColor(BG));

        ViewCompat.setOnApplyWindowInsetsListener(webView, new OnApplyWindowInsetsListener() {
            @Override
            public WindowInsetsCompat onApplyWindowInsets(View v, WindowInsetsCompat insets) {
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            }
        });
        ViewCompat.requestApplyInsets(webView);
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
}
