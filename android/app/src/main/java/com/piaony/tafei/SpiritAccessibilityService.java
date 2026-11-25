package com.piaony.tafei;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.Toast;

import java.util.List;

/**
 * 桌面互动用的无障碍服务。
 * 当前版本只做一件事：长按桌面图标，点击 ColorOS 官方「移除」。
 * 不写 launcher.db，应用仍保留在抽屉。
 */
public class SpiritAccessibilityService extends AccessibilityService {

    private static SpiritAccessibilityService instance;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
    }

    @Override
    public void onInterrupt() {
    }

    public static boolean isReady() {
        return instance != null;
    }

    public static String eatIcon(String label, String pkg, int screen, int cellX, int cellY) {
        SpiritAccessibilityService service = instance;
        if (service == null) return "no-service";
        final String safeLabel = (label == null) ? "" : label;
        service.handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                service.doEat(safeLabel);
            }
        }, 800L);
        return "started";
    }

    private void doEat(String label) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            toast("桌面还没准备好");
            return;
        }
        CharSequence pkg = root.getPackageName();
        if (pkg == null || !"com.android.launcher".contentEquals(pkg)) {
            toast("请先回到桌面再试吃");
            return;
        }
        AccessibilityNodeInfo target = findLabel(root, label, 0);
        if (target == null) {
            toast("桌面上没有找到「" + label + "」");
            return;
        }
        Rect bounds = new Rect();
        target.getBoundsInScreen(bounds);
        if (bounds.width() < 20 || bounds.height() < 20) {
            toast("图标坐标无效");
            return;
        }
        boolean ok = longPress(bounds.centerX(), bounds.centerY());
        if (!ok) {
            toast("长按手势发送失败");
            return;
        }
        toast("长按「" + label + "」…");
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                clickRemove(label, 0);
            }
        }, 1400L);
    }

    private boolean longPress(int x, int y) {
        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0L, 650L);
        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(stroke)
            .build();
        return dispatchGesture(gesture, null, null);
    }

    private void clickRemove(final String label, final int attempt) {
        AccessibilityNodeInfo remove = findRemoveNode();
        if (remove == null) {
            if (attempt < 3) {
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        clickRemove(label, attempt + 1);
                    }
                }, 450L);
            } else {
                toast("菜单里没有找到「移除」，请手动点一下");
            }
            return;
        }
        Rect bounds = new Rect();
        remove.getBoundsInScreen(bounds);
        if (bounds.width() < 10 || bounds.height() < 10) {
            toast("「移除」按钮坐标无效");
            return;
        }
        boolean ok = tap(bounds.centerX(), bounds.centerY());
        if (!ok) {
            AccessibilityNodeInfo clickable = remove;
            for (int i = 0; i < 6 && clickable != null; i++) {
                if (clickable.isClickable()) break;
                clickable = clickable.getParent();
            }
            ok = clickable != null && clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }
        toast(ok ? "正在自动点「移除」…" : "自动点击失败，请手动点一下");
    }

    private AccessibilityNodeInfo findRemoveNode() {
        String[] labels = {"从桌面移除", "移除", "删除"};
        List<AccessibilityWindowInfo> windows = getWindows();
        for (AccessibilityWindowInfo window : windows) {
            AccessibilityNodeInfo root = window.getRoot();
            if (root == null) continue;
            for (String label : labels) {
                AccessibilityNodeInfo node = findText(root, label, 0);
                if (node != null) return node;
            }
        }
        AccessibilityNodeInfo active = getRootInActiveWindow();
        if (active != null) {
            for (String label : labels) {
                AccessibilityNodeInfo node = findText(active, label, 0);
                if (node != null) return node;
            }
        }
        return null;
    }

    private boolean tap(int x, int y) {
        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0L, 70L);
        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(stroke)
            .build();
        return dispatchGesture(gesture, null, null);
    }

    private AccessibilityNodeInfo findLabel(AccessibilityNodeInfo node, String label, int depth) {
        if (node == null || depth > 12) return null;
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        if (equalsLabel(text, label) || equalsLabel(desc, label)) {
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            if (bounds.width() > 20 && bounds.height() > 20) return node;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo found = findLabel(node.getChild(i), label, depth + 1);
            if (found != null) return found;
        }
        return null;
    }

    private AccessibilityNodeInfo findText(AccessibilityNodeInfo node, String needle, int depth) {
        if (node == null || depth > 12) return null;
        if (contains(node.getText(), needle) || contains(node.getContentDescription(), needle)) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo found = findText(node.getChild(i), needle, depth + 1);
            if (found != null) return found;
        }
        return null;
    }

    private boolean equalsLabel(CharSequence value, String label) {
        return value != null && label != null && label.contentEquals(value.toString().trim());
    }

    private boolean contains(CharSequence value, String needle) {
        return value != null && value.toString().contains(needle);
    }

    private void toast(String msg) {
        Toast.makeText(getApplicationContext(), msg, Toast.LENGTH_SHORT).show();
    }
}
