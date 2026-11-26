package com.piaony.tafei;

import android.content.Context;
import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.Toast;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 桌面互动用的无障碍服务。
 * 当前版本只做一件事：长按桌面图标，点击 ColorOS 官方「移除」。
 * 不写 launcher.db，应用仍保留在抽屉。
 */
public class SpiritAccessibilityService extends AccessibilityService {

    private static SpiritAccessibilityService instance;
    private static String lastResult = "idle|";
    private static volatile String lastEventPhase = "idle";
    private static volatile String lastEventLabel = "";
    private static volatile String lastEventDetail = "";
    private static volatile String lastEventPackage = "";
    private static volatile int lastEventX = 0;
    private static volatile int lastEventY = 0;
    private static volatile long lastEventId = 0L;

    public static String lastResult() {
        return lastResult;
    }

    /** 给桌面悬浮层轮询：phase|label|detail|x|y|package|eventId */
    public static String lastEvent() {
        return lastEventPhase + "|" + lastEventLabel + "|" + lastEventDetail + "|"
            + lastEventX + "|" + lastEventY + "|" + lastEventPackage + "|" + lastEventId;
    }

    public static long lastEventId() {
        return lastEventId;
    }

    private static void report(String state, String label, String detail) {
        String safeLabel = label == null ? "" : label.replace("|", " ");
        String safeDetail = detail == null ? "" : detail.replace("|", " ");
        lastResult = state + "|" + safeLabel + "|" + safeDetail;
        lastEventLabel = safeLabel;
        lastEventDetail = safeDetail;
        lastEventPhase = phaseOf(state, safeDetail);
        lastEventId++;
    }

    public static void publishAction(String state, String label, String detail) {
        report(state, label, detail);
    }

    public static void publishActionAt(String state, String label, String detail,
                                       int x, int y, String pkg) {
        lastEventX = x;
        lastEventY = y;
        lastEventPackage = pkg == null ? "" : pkg.replace("|", " ");
        report(state, label, detail);
    }

    private static String phaseOf(String state, String detail) {
        if ("success".equals(state)) return "success";
        if ("failed".equals(state)) return "failed";
        if ("found".equals(detail)) return "found";
        if (detail != null && detail.startsWith("scan-")) return "scan";
        if (detail != null && (detail.startsWith("long-press")
            || detail.startsWith("remove") || detail.startsWith("root-tap"))) return "removing";
        if ("start".equals(detail)) return "start";
        return "running";
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private int scanLimit = 6;
    private int scanLeft = 0;
    private int scanRight = 0;
    private int navOffset = 0;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        SpiritOverlayService.updatePrefs(this);
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

    public static SpiritAccessibilityService instance() {
        return instance;
    }

    /** 无障碍层可以添加 TYPE_ACCESSIBILITY_OVERLAY，用来尝试覆盖系统界面。 */
    public static WindowManager overlayWindowManager() {
        SpiritAccessibilityService svc = instance;
        if (svc == null) return null;
        try {
            return (WindowManager) svc.getSystemService(WINDOW_SERVICE);
        } catch (Throwable t) {
            return null;
        }
    }

    /** Root 兜底：把本服务写进系统无障碍列表，省掉 ColorOS 的受限设置入口。 */
    public static boolean enableViaRoot(Context context) {
        if (isReady() || context == null) return isReady();
        String component = context.getPackageName() + "/" + SpiritAccessibilityService.class.getName();
        String cmd = "cur=$(/system/bin/settings --user 0 get secure enabled_accessibility_services 2>/dev/null); "
            + "if [ \"$cur\" = \"null\" ]; then cur=\"\"; fi; "
            + "case \",$cur,\" in *\"," + component + ",\"*) ;; *) cur=\"${cur:+$cur:}" + component + "\";; esac; "
            + "/system/bin/settings --user 0 put secure enabled_accessibility_services \"$cur\"; "
            + "/system/bin/settings --user 0 put secure accessibility_enabled 1; "
            + "/system/bin/settings --user 0 get secure enabled_accessibility_services";
        RootBridge.Result result = RootBridge.run(cmd, 5000L);
        return result.exitCode == 0 && result.output.contains(component);
    }

    public static String startDesktopAction(String action, String payload) {
        return SpiritDesktopActions.start(instance, action, payload);
    }

    public static String eatIcon(String label, String pkg, int screen, int cellX, int cellY) {
        SpiritAccessibilityService service = instance;
        if (service == null) return "no-service";
        final String safeLabel = (label == null) ? "" : label;
        lastEventPackage = (pkg == null) ? "" : pkg.replace("|", " ");
        lastEventX = 0;
        lastEventY = 0;
        report("running", safeLabel, "start");
        service.handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                service.doEat(safeLabel, screen);
            }
        }, 800L);
        return "started";
    }

    private void doEat(String label, int screen) {
        scanLimit = Math.max(6, Math.min(9, screen + 2));
        scanLeft = 0;
        scanRight = 0;
        navOffset = 0;
        scanForTarget(label, screen);
    }

    private void scanForTarget(String label, int screen) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            report("failed", label, "no-root");
            toast("桌面还没准备好");
            return;
        }
        CharSequence pkg = root.getPackageName();
        if (pkg == null || !"com.android.launcher".contentEquals(pkg)) {
            report("failed", label, "not-launcher");
            toast("请先回到桌面再试吃");
            return;
        }
        AccessibilityNodeInfo target = findLabel(root, label, 0);
        if (target == null && scanLeft < scanLimit) {
            if (swipeLeft()) {
                scanLeft++;
                navOffset++;
                report("running", label, "scan-left-" + scanLeft);
                toast("向左找「" + label + "」· 第" + scanLeft + "页");
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        scanForTarget(label, screen);
                    }
                }, 520L);
                return;
            }
        }
        if (target == null && scanRight < scanLimit * 2) {
            if (swipeRight()) {
                scanRight++;
                navOffset--;
                report("running", label, "scan-right-" + scanRight);
                toast("向右找「" + label + "」· 第" + scanRight + "页");
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        scanForTarget(label, screen);
                    }
                }, 520L);
                return;
            }
        }
        if (target == null) {
            report("failed", label, "not-found-" + screen);
            returnAfter(1000L);
            toast("没扫到「" + label + "」，目标约在屏" + screen + "；请手动滑到该屏再试");
            return;
        }
        Rect bounds = new Rect();
        target.getBoundsInScreen(bounds);
        if (bounds.width() < 20 || bounds.height() < 20) {
            report("failed", label, "invalid-bounds");
            toast("图标坐标无效");
            return;
        }
        lastEventX = bounds.centerX();
        lastEventY = bounds.centerY();
        report("running", label, "found");
        boolean ok = longPress(lastEventX, lastEventY);
        if (!ok) {
            report("failed", label, "long-press-failed");
            returnAfter(900L);
            toast("长按手势发送失败");
            return;
        }
        report("running", label, "long-press");
        toast("长按「" + label + "」…");
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                clickRemove(label, 0);
            }
        }, 1400L);
    }

    private boolean swipeLeft() {
        return swipeHorizontal(true);
    }

    private boolean swipeRight() {
        return swipeHorizontal(false);
    }

    private boolean swipeHorizontal(boolean left) {
        int w = getResources().getDisplayMetrics().widthPixels;
        int h = getResources().getDisplayMetrics().heightPixels;
        Path path = new Path();
        path.moveTo(w * (left ? 0.82f : 0.18f), h * 0.58f);
        path.lineTo(w * (left ? 0.18f : 0.82f), h * 0.58f);
        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0L, 320L);
        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(stroke)
            .build();
        return dispatchGesture(gesture, null, null);
    }

    private void returnAfter(long delayMs) {
        if (navOffset == 0) return;
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                returnToOrigin();
            }
        }, delayMs);
    }

    private void returnToOrigin() {
        if (navOffset > 0) {
            if (swipeRight()) {
                navOffset--;
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        returnToOrigin();
                    }
                }, 460L);
            } else {
                navOffset = 0;
            }
        } else if (navOffset < 0) {
            if (swipeLeft()) {
                navOffset++;
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        returnToOrigin();
                    }
                }, 460L);
            } else {
                navOffset = 0;
            }
        }
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
        final AccessibilityNodeInfo remove = findRemoveNode();
        if (remove == null) {
            if (attempt < 2) {
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        clickRemove(label, attempt + 1);
                    }
                }, 450L);
            } else {
                toast("无障碍没找到「移除」，改用 root 坐标");
                rootTapRemove(label);
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
        final int next = attempt + 1;
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (findRemoveNode() == null) {
                    report("success", label, "accessibility");
                    returnAfter(1000L);
                    toast("已移除「" + label + "」，应用还在抽屉里");
                } else if (next < 3) {
                    clickRemove(label, next);
                } else {
                    toast("无障碍点击无效，改用 root 坐标");
                    rootTapRemove(label);
                }
            }
        }, 700L);
    }

    private void rootTapRemove(final String label) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                RootBridge.run("rm -f /data/local/tmp/tafei_ui.xml; uiautomator dump --compressed /data/local/tmp/tafei_ui.xml", 20000L);
                RootBridge.Result cat = RootBridge.run("cat /data/local/tmp/tafei_ui.xml", 5000L);
                String xml = cat.output == null ? "" : cat.output;
                int[] point = findRemoveBounds(xml, "移除");
                if (point == null) point = findRemoveBounds(xml, "从桌面移除");
                if (point == null) {
                    android.util.DisplayMetrics dm = getResources().getDisplayMetrics();
                    point = new int[]{(int) (dm.widthPixels * 0.72f), (int) (dm.heightPixels * 0.855f)};
                    toast("没读到按钮，按固定位置点「移除」");
                }
                boolean ok = tap(point[0], point[1]);
                report(ok ? "running" : "failed", label, ok ? "root-tap" : "root-tap-failed");
                toast(ok ? "root 坐标已点「移除」" : "root 点击失败");
                if (ok) {
                    handler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            if (findRemoveNode() == null) {
                                report("success", label, "root");
                                returnAfter(1000L);
                                toast("已移除「" + label + "」");
                            } else {
                                report("failed", label, "root-still-open");
                                returnAfter(900L);
                            }
                        }
                    }, 1000L);
                }
            }
        }).start();
    }

    private int[] findRemoveBounds(String xml, String needle) {
        if (xml == null || xml.isEmpty()) return null;
        Pattern pattern = Pattern.compile("bounds=\"\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]\"");
        int start = 0;
        while ((start = xml.indexOf("<node", start)) >= 0) {
            int end = xml.indexOf(">", start);
            if (end < 0) break;
            String node = xml.substring(start, end);
            boolean match = node.contains("text=\"" + needle + "\"")
                || node.contains("content-desc=\"" + needle + "\"");
            if (match) {
                Matcher matcher = pattern.matcher(node);
                if (matcher.find()) {
                    int x1 = Integer.parseInt(matcher.group(1));
                    int y1 = Integer.parseInt(matcher.group(2));
                    int x2 = Integer.parseInt(matcher.group(3));
                    int y2 = Integer.parseInt(matcher.group(4));
                    return new int[]{(x1 + x2) / 2, (y1 + y2) / 2};
                }
            }
            start = end + 1;
        }
        return null;
    }

    private AccessibilityNodeInfo findRemoveNode() {
        String[] labels = {"移除", "从桌面移除", "删除"};
        List<AccessibilityWindowInfo> windows = getWindows();
        for (AccessibilityWindowInfo window : windows) {
            AccessibilityNodeInfo root = window.getRoot();
            if (root == null) continue;
            for (String label : labels) {
                AccessibilityNodeInfo node = findTextExact(root, label, 0);
                if (node != null) return node;
            }
        }
        AccessibilityNodeInfo active = getRootInActiveWindow();
        if (active != null) {
            for (String label : labels) {
                AccessibilityNodeInfo node = findTextExact(active, label, 0);
                if (node != null) return node;
            }
        }
        return null;
    }

    private AccessibilityNodeInfo findTextExact(AccessibilityNodeInfo node, String needle, int depth) {
        if (node == null || depth > 14) return null;
        if (equalsLabel(node.getText(), needle) || equalsLabel(node.getContentDescription(), needle)) {
            return node;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo found = findTextExact(node.getChild(i), needle, depth + 1);
            if (found != null) return found;
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
