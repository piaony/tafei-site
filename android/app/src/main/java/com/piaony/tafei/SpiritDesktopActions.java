package com.piaony.tafei;

import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * 无障碍拖动版的桌面整理。
 *
 * 这条路径默认可用，不写 launcher.db；只有用户主动打开实验开关时，
 * MainActivity 才会把动作交给 LauncherDbOps。
 */
final class SpiritDesktopActions {

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static boolean running = false;

    private SpiritDesktopActions() {
    }

    static String start(SpiritAccessibilityService service, String action, String payload) {
        if (service == null || !SpiritAccessibilityService.isReady()) return "accessibility-off";
        if (running) return "busy";
        try {
            JSONObject root = new JSONObject(payload == null ? "{}" : payload);
            List<ActionItem> items = new ArrayList<>();
            JSONArray array = root.optJSONArray("items");
            if (array == null || array.length() == 0) return "no-items";
            for (int i = 0; i < array.length(); i++) {
                items.add(new ActionItem(array.getJSONObject(i)));
            }
            ActionTarget target = new ActionTarget();
            JSONObject targetJson = root.optJSONObject("target");
            if (targetJson != null) {
                target.screen = targetJson.optInt("screen", items.get(0).screen);
                target.row = targetJson.optInt("cellY", targetJson.optInt("row", 0));
                target.col = targetJson.optInt("cellX", targetJson.optInt("col", 0));
                target.folderId = targetJson.optInt("folderId", -1);
            }
            JSONArray empties = root.optJSONArray("emptyCells");
            if (empties != null) {
                for (int i = 0; i < empties.length(); i++) {
                    JSONObject cell = empties.getJSONObject(i);
                    target.emptyCells.add(new int[]{cell.optInt("row", -1), cell.optInt("col", -1)});
                }
            }
            target.cols = Math.max(2, root.optInt("cols", 4));
            target.rows = Math.max(2, root.optInt("rows", 6));
            running = true;
            final String type = action == null ? "move" : action;
            final String label = items.get(0).label;
            SpiritAccessibilityService.publishActionAt("running", label, "start", 0, 0, items.get(0).pkg);
            MAIN.postDelayed(new Runnable() {
                @Override
                public void run() {
                    try {
                        if ("move".equals(type)) runMove(service, items, target);
                        else if ("swap".equals(type)) runSwap(service, items, target);
                        else if ("folder".equals(type)) runFolder(service, items, target);
                        else fail(type, "", "access-unknown-action", 0, 0);
                    } catch (Throwable t) {
                        fail(type, label, "access-error:" + t.getMessage(), 0, 0);
                    }
                }
            }, 650L);
            return "started";
        } catch (Throwable t) {
            running = false;
            return "bad-payload";
        }
    }

    private static void finish(String type, String label, String detail, int x, int y, String pkg) {
        running = false;
        SpiritAccessibilityService.publishActionAt("success", label, detail, x, y, pkg);
    }

    private static void fail(String type, String label, String detail, int x, int y) {
        running = false;
        SpiritAccessibilityService.publishActionAt("failed", label, detail, x, y, "");
    }

    private static void runMove(SpiritAccessibilityService service, List<ActionItem> items, ActionTarget target) {
        if (items.size() != 1) {
            fail("move", "", "access-need-one", 0, 0);
            return;
        }
        ActionItem item = items.get(0);
        if (item.screen != target.screen) {
            fail("move", item.label, "cross-page-needs-db", 0, 0);
            return;
        }
        locate(service, item.label, new FindCallback() {
            @Override
            public void found(Rect bounds) {
                int[] to = cellCenter(service, target);
                drag(service, bounds.centerX(), bounds.centerY(), to[0], to[1], new DragCallback() {
                    @Override
                    public void done(boolean ok) {
                        if (ok) finish("move", item.label, "access-move", to[0], to[1], item.pkg);
                        else fail("move", item.label, "access-drag-failed", to[0], to[1]);
                    }
                });
            }

            @Override
            public void failed(String detail) {
                fail("move", item.label, detail, 0, 0);
            }
        });
    }

    private static void runSwap(SpiritAccessibilityService service, List<ActionItem> items, ActionTarget target) {
        if (items.size() != 2) {
            fail("swap", "", "access-need-two", 0, 0);
            return;
        }
        final ActionItem a = items.get(0);
        final ActionItem b = items.get(1);
        if (a.screen != b.screen) {
            fail("swap", a.label + " / " + b.label, "cross-page-needs-db", 0, 0);
            return;
        }
        locate(service, a.label, new FindCallback() {
            @Override
            public void found(Rect bounds) {
                AccessibilityNodeInfo root = service.getRootInActiveWindow();
                AccessibilityNodeInfo other = findLabel(root, b.label);
                if (other == null) {
                    fail("swap", a.label + " / " + b.label, "second-not-on-page", 0, 0);
                    return;
                }
                Rect otherBounds = new Rect();
                other.getBoundsInScreen(otherBounds);
                if (otherBounds.width() < 20 || otherBounds.height() < 20) {
                    fail("swap", a.label + " / " + b.label, "second-bounds", 0, 0);
                    return;
                }
                int[] temp = emptyCell(a, b, target);
                if (temp == null) {
                    fail("swap", a.label + " / " + b.label, "no-empty-cell", 0, 0);
                    return;
                }
                final int[] tempPoint = cellCenter(service, target, temp[0], temp[1]);
                final int ax = bounds.centerX();
                final int ay = bounds.centerY();
                final int bx = otherBounds.centerX();
                final int by = otherBounds.centerY();
                drag(service, ax, ay, tempPoint[0], tempPoint[1], new DragCallback() {
                    @Override
                    public void done(boolean ok) {
                        if (!ok) {
                            fail("swap", a.label + " / " + b.label, "first-drag-failed", ax, ay);
                            return;
                        }
                        MAIN.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                dragBToA(service, a, b, ax, ay, bx, by);
                            }
                        }, 950L);
                    }
                });
            }

            @Override
            public void failed(String detail) {
                fail("swap", a.label + " / " + b.label, detail, 0, 0);
            }
        });
    }

    private static void dragBToA(SpiritAccessibilityService service, ActionItem a, ActionItem b,
                                 int ax, int ay, int bx, int by) {
        AccessibilityNodeInfo root = service.getRootInActiveWindow();
        AccessibilityNodeInfo nodeB = findLabel(root, b.label);
        if (nodeB == null) {
            fail("swap", a.label + " / " + b.label, "second-disappeared", ax, ay);
            return;
        }
        Rect bounds = new Rect();
        nodeB.getBoundsInScreen(bounds);
        drag(service, bounds.centerX(), bounds.centerY(), ax, ay, new DragCallback() {
            @Override
            public void done(boolean ok) {
                if (!ok) {
                    fail("swap", a.label + " / " + b.label, "second-drag-failed", ax, ay);
                    return;
                }
                MAIN.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        AccessibilityNodeInfo root2 = service.getRootInActiveWindow();
                        AccessibilityNodeInfo nodeA = findLabel(root2, a.label);
                        if (nodeA == null) {
                            fail("swap", a.label + " / " + b.label, "first-disappeared", bx, by);
                            return;
                        }
                        Rect aBounds = new Rect();
                        nodeA.getBoundsInScreen(aBounds);
                        drag(service, aBounds.centerX(), aBounds.centerY(), bx, by, new DragCallback() {
                            @Override
                            public void done(boolean ok2) {
                                if (ok2) finish("swap", a.label + " / " + b.label, "access-swap", bx, by, a.pkg);
                                else fail("swap", a.label + " / " + b.label, "third-drag-failed", bx, by);
                            }
                        });
                    }
                }, 950L);
            }
        });
    }

    private static void runFolder(SpiritAccessibilityService service, List<ActionItem> items, ActionTarget target) {
        if (items.size() < 2) {
            fail("folder", "", "access-need-two", 0, 0);
            return;
        }
        for (ActionItem item : items) {
            if (item.screen != target.screen) {
                fail("folder", item.label, "cross-page-needs-db", 0, 0);
                return;
            }
        }
        final int[] to = cellCenter(service, target);
        dragFolderStep(service, items, 0, to[0], to[1]);
    }

    private static void dragFolderStep(SpiritAccessibilityService service, List<ActionItem> items,
                                       int index, int tx, int ty) {
        if (index >= items.size()) {
            finish("folder", items.get(0).label, "access-folder", tx, ty, items.get(0).pkg);
            return;
        }
        final ActionItem item = items.get(index);
        locate(service, item.label, new FindCallback() {
            @Override
            public void found(Rect bounds) {
                drag(service, bounds.centerX(), bounds.centerY(), tx, ty, new DragCallback() {
                    @Override
                    public void done(boolean ok) {
                        if (!ok) {
                            fail("folder", item.label, "access-folder-drag-failed", tx, ty);
                            return;
                        }
                        MAIN.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                dragFolderStep(service, items, index + 1, tx, ty);
                            }
                        }, 1150L);
                    }
                });
            }

            @Override
            public void failed(String detail) {
                fail("folder", item.label, detail, tx, ty);
            }
        });
    }

    private static int[] emptyCell(ActionItem a, ActionItem b, ActionTarget target) {
        for (int[] cell : target.emptyCells) {
            if (cell == null || cell.length < 2) continue;
            if (cell[0] == a.cellY && cell[1] == a.cellX) continue;
            if (cell[0] == b.cellY && cell[1] == b.cellX) continue;
            if (cell[0] == target.row && cell[1] == target.col) continue;
            return cell;
        }
        for (int row = 0; row < target.rows; row++) {
            for (int col = 0; col < target.cols; col++) {
                if (row == a.cellY && col == a.cellX) continue;
                if (row == b.cellY && col == b.cellX) continue;
                boolean used = false;
                for (int[] cell : target.emptyCells) {
                    if (cell[0] == row && cell[1] == col) used = true;
                }
                if (!used) return new int[]{row, col};
            }
        }
        return null;
    }

    private static int[] cellCenter(SpiritAccessibilityService service, ActionTarget target) {
        return cellCenter(service, target, target.row, target.col);
    }

    private static int[] cellCenter(SpiritAccessibilityService service, ActionTarget target, int row, int col) {
        int w = service.getResources().getDisplayMetrics().widthPixels;
        int h = service.getResources().getDisplayMetrics().heightPixels;
        int x = (int) ((col + 0.5f) * w / Math.max(1, target.cols));
        int top = dp(service, 52);
        int bottom = h - dp(service, 94);
        int usable = Math.max(dp(service, 180), bottom - top);
        int y = top + (int) ((row + 0.5f) * usable / Math.max(1, target.rows));
        return new int[]{Math.max(0, Math.min(w - 1, x)), Math.max(0, Math.min(h - 1, y))};
    }

    private static void locate(SpiritAccessibilityService service, String label, FindCallback callback) {
        scanLabel(service, label, 0, 0, callback);
    }

    private static void scanLabel(SpiritAccessibilityService service, String label,
                                  int leftCount, int rightCount, FindCallback callback) {
        AccessibilityNodeInfo root = service.getRootInActiveWindow();
        if (root == null) {
            callback.failed("access-no-root");
            return;
        }
        CharSequence pkg = root.getPackageName();
        String packageName = pkg == null ? "" : pkg.toString();
        if (!packageName.contains("launcher") && !packageName.contains("coloros")) {
            callback.failed("access-not-launcher");
            return;
        }
        AccessibilityNodeInfo target = findLabel(root, label);
        if (target != null) {
            Rect bounds = new Rect();
            target.getBoundsInScreen(bounds);
            if (bounds.width() > 20 && bounds.height() > 20) {
                callback.found(bounds);
                return;
            }
        }
        if (leftCount < 6) {
            swipe(service, true);
            MAIN.postDelayed(new Runnable() {
                @Override
                public void run() {
                    scanLabel(service, label, leftCount + 1, rightCount, callback);
                }
            }, 520L);
            return;
        }
        if (rightCount < 12) {
            swipe(service, false);
            MAIN.postDelayed(new Runnable() {
                @Override
                public void run() {
                    scanLabel(service, label, leftCount, rightCount + 1, callback);
                }
            }, 520L);
            return;
        }
        callback.failed("access-not-found");
    }

    private static void swipe(SpiritAccessibilityService service, boolean left) {
        int w = service.getResources().getDisplayMetrics().widthPixels;
        int h = service.getResources().getDisplayMetrics().heightPixels;
        int y = (int) (h * 0.56f);
        int from = left ? (int) (w * 0.74f) : (int) (w * 0.26f);
        int to = left ? (int) (w * 0.26f) : (int) (w * 0.74f);
        Path path = new Path();
        path.moveTo(from, y);
        path.lineTo(to, y);
        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0L, 230L);
        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(stroke)
            .build();
        service.dispatchGesture(gesture, null, null);
    }

    private static AccessibilityNodeInfo findLabel(AccessibilityNodeInfo node, String label) {
        if (node == null || label == null || label.isEmpty()) return null;
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        if ((text != null && text.toString().contains(label))
            || (desc != null && desc.toString().contains(label))) {
            return node;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child == null) continue;
            AccessibilityNodeInfo found = findLabel(child, label);
            if (found != null) return found;
        }
        return null;
    }

    private static void drag(SpiritAccessibilityService service,
                             int x1, int y1, int x2, int y2, DragCallback callback) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                boolean ok = false;
                try {
                    RootBridge.Result result = RootBridge.run(
                        "input draganddrop " + x1 + " " + y1 + " " + x2 + " " + y2 + " 1200", 12000L);
                    String output = result.output == null ? "" : result.output.toLowerCase();
                    ok = result.exitCode == 0
                        && !output.contains("unknown")
                        && !output.contains("error")
                        && !output.contains("usage");
                } catch (Throwable ignored) {
                }
                final boolean rootOk = ok;
                MAIN.post(new Runnable() {
                    @Override
                    public void run() {
                        if (rootOk) {
                            MAIN.postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    callback.done(true);
                                }
                            }, 950L);
                            return;
                        }
                        boolean queued = dispatchDrag(service, x1, y1, x2, y2);
                        MAIN.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                callback.done(queued);
                            }
                        }, 1350L);
                    }
                });
            }
        }).start();
    }

    private static boolean dispatchDrag(SpiritAccessibilityService service, int x1, int y1, int x2, int y2) {
        Path path = new Path();
        path.moveTo(x1, y1);
        path.lineTo(x2, y2);
        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0L, 1200L);
        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(stroke)
            .build();
        return service.dispatchGesture(gesture, null, null);
    }

    private static int dp(SpiritAccessibilityService service, float value) {
        return Math.round(value * service.getResources().getDisplayMetrics().density);
    }

    private interface FindCallback {
        void found(Rect bounds);

        void failed(String detail);
    }

    private interface DragCallback {
        void done(boolean ok);
    }

    private static final class ActionItem {
        int rowId;
        String label;
        String pkg;
        int screen;
        int cellX;
        int cellY;
        int itemType;

        ActionItem(JSONObject json) {
            rowId = json.optInt("rowId", -1);
            label = json.optString("label", "");
            pkg = json.optString("package", "");
            screen = json.optInt("screen", 0);
            cellX = json.optInt("cellX", 0);
            cellY = json.optInt("cellY", 0);
            itemType = json.optInt("itemType", 0);
        }
    }

    private static final class ActionTarget {
        int screen;
        int row;
        int col;
        int folderId = -1;
        int cols = 4;
        int rows = 6;
        final List<int[]> emptyCells = new ArrayList<>();
    }
}
