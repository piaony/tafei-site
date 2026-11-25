package com.piaony.tafei;

import android.accessibilityservice.GestureDescription;
import android.content.Intent;
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
                target.folderTitle = targetJson.optString("title", "");
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
            launchHome(service);
            MAIN.postDelayed(new Runnable() {
                @Override
                public void run() {
                    waitForLauncher(service, type, label, items, target, 0);
                }
            }, 650L);
            return "started";
        } catch (Throwable t) {
            running = false;
            return "bad-payload";
        }
    }

    private static void launchHome(SpiritAccessibilityService service) {
        try {
            Intent home = new Intent(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            service.startActivity(home);
        } catch (Throwable ignored) {
        }
    }

    private static void waitForLauncher(SpiritAccessibilityService service, String type, String label,
                                        List<ActionItem> items, ActionTarget target, int attempt) {
        AccessibilityNodeInfo root = service.getRootInActiveWindow();
        String pkg = root == null || root.getPackageName() == null ? "" : root.getPackageName().toString();
        if (pkg.contains("launcher") || pkg.contains("coloros")) {
            try {
                if ("move".equals(type)) runMove(service, items, target);
                else if ("swap".equals(type)) runSwap(service, items, target);
                else if ("folder".equals(type)) runFolder(service, items, target);
                else fail(type, "", "access-unknown-action", 0, 0);
            } catch (Throwable t) {
                fail(type, label, "access-error:" + t.getMessage(), 0, 0);
            }
            return;
        }
        if (attempt >= 3) {
            fail(type, label, "access-not-launcher", 0, 0);
            return;
        }
        launchHome(service);
        MAIN.postDelayed(new Runnable() {
            @Override
            public void run() {
                waitForLauncher(service, type, label, items, target, attempt + 1);
            }
        }, 550L);
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
                Rect icon = bounds;
                final int[] to = cellPoint(service, target, icon, item.cellX, item.cellY, target.row, target.col);
                final int sx = icon.centerX();
                final int sy = icon.centerY();
                drag(service, sx, sy, to[0], to[1], 1200, new DragCallback() {
                    @Override
                    public void done(boolean ok) {
                        if (!ok) {
                            fail("move", item.label, "access-drag-failed", to[0], to[1]);
                            return;
                        }
                        MAIN.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                verifyAt(service, item.label, to, "access-move-not-visible",
                                    new Runnable() {
                                        @Override
                                        public void run() {
                                            finish("move", item.label, "access-move", to[0], to[1], item.pkg);
                                        }
                                    },
                                    new Runnable() {
                                        @Override
                                        public void run() {
                                            // 第一次没动：换更长的按住时间再试一次。
                                            drag(service, sx, sy, to[0], to[1], 1800, new DragCallback() {
                                                @Override
                                                public void done(boolean retryOk) {
                                                    if (!retryOk) {
                                                        fail("move", item.label, "access-drag-failed", to[0], to[1]);
                                                        return;
                                                    }
                                                    MAIN.postDelayed(new Runnable() {
                                                        @Override
                                                        public void run() {
                                                            verifyAt(service, item.label, to, "access-move-not-visible",
                                                                new Runnable() {
                                                                    @Override
                                                                    public void run() {
                                                                        finish("move", item.label, "access-move", to[0], to[1], item.pkg);
                                                                    }
                                                                },
                                                                new Runnable() {
                                                                    @Override
                                                                    public void run() {
                                                                        fail("move", item.label, "access-wrong-cell", to[0], to[1]);
                                                                    }
                                                                });
                                                        }
                                                    }, 1000L);
                                                }
                                            });
                                        }
                                    });
                            }
                        }, 1000L);
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
                Rect otherBounds = iconRect(service, other);
                if (otherBounds.width() < 20 || otherBounds.height() < 20) {
                    fail("swap", a.label + " / " + b.label, "second-bounds", 0, 0);
                    return;
                }
                int[] temp = emptyCell(a, b, target);
                if (temp == null) {
                    fail("swap", a.label + " / " + b.label, "no-empty-cell", 0, 0);
                    return;
                }
                AccessibilityNodeInfo anchorNode = findLabel(service.getRootInActiveWindow(), a.label);
                Rect iconA = anchorNode == null ? null : iconRect(service, anchorNode);
                // A 的可视 bounds 已经拿到；用 A 的实际图标位置校准目标格。
                Rect anchor = iconA != null && iconA.width() > 20 ? iconA : bounds;
                final int[] tempPoint = cellPoint(service, target, anchor, a.cellX, a.cellY, temp[0], temp[1]);
                final int ax = anchor.centerX();
                final int ay = anchor.centerY();
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
                                verifyAt(service, a.label, tempPoint, "access-swap-first-not-moved",
                                    new Runnable() {
                                        @Override
                                        public void run() {
                                            dragBToA(service, a, b, ax, ay, bx, by);
                                        }
                                    },
                                    new Runnable() {
                                        @Override
                                        public void run() {
                                            fail("swap", a.label + " / " + b.label,
                                                "access-swap-first-not-moved", ax, ay);
                                        }
                                    });
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
        Rect bounds = iconRect(service, nodeB);
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
                        verifyAt(service, b.label, new int[]{ax, ay}, "access-swap-second-not-moved",
                            new Runnable() {
                                @Override
                                public void run() {
                                    AccessibilityNodeInfo root2 = service.getRootInActiveWindow();
                                    AccessibilityNodeInfo nodeA = findLabel(root2, a.label);
                                    if (nodeA == null) {
                                        fail("swap", a.label + " / " + b.label, "first-disappeared", bx, by);
                                        return;
                                    }
                                    Rect aBounds = iconRect(service, nodeA);
                                    drag(service, aBounds.centerX(), aBounds.centerY(), bx, by, 1200,
                                        new DragCallback() {
                                            @Override
                                            public void done(boolean ok2) {
                                                if (!ok2) {
                                                    fail("swap", a.label + " / " + b.label, "third-drag-failed", bx, by);
                                                    return;
                                                }
                                                MAIN.postDelayed(new Runnable() {
                                                    @Override
                                                    public void run() {
                                                        verifyAt(service, a.label, new int[]{bx, by},
                                                            "access-swap-wrong-cell",
                                                            new Runnable() {
                                                                @Override
                                                                public void run() {
                                                                    finish("swap", a.label + " / " + b.label,
                                                                        "access-swap", bx, by, a.pkg);
                                                                }
                                                            },
                                                            new Runnable() {
                                                                @Override
                                                                public void run() {
                                                                    fail("swap", a.label + " / " + b.label,
                                                                        "access-swap-wrong-cell", bx, by);
                                                                }
                                                            });
                                                    }
                                                }, 1000L);
                                            }
                                        });
                                }
                            },
                            new Runnable() {
                                @Override
                                public void run() {
                                    fail("swap", a.label + " / " + b.label,
                                        "access-swap-second-not-moved", ax, ay);
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
        final ActionItem host = items.get(0);
        locate(service, host.label, new FindCallback() {
            @Override
            public void found(Rect bounds) {
                Rect icon = iconRect(service, bounds);
                final int[] to = cellPoint(service, target, icon, host.cellX, host.cellY,
                    target.row, target.col);
                dragFolderStep(service, items, 0, to[0], to[1]);
            }

            @Override
            public void failed(String detail) {
                fail("folder", host.label, detail, 0, 0);
            }
        });
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
                Rect icon = iconRect(service, bounds);
                drag(service, icon.centerX(), icon.centerY(), tx, ty, new DragCallback() {
                    @Override
                    public void done(boolean ok) {
                        if (!ok) {
                            fail("folder", item.label, "access-folder-drag-failed", tx, ty);
                            return;
                        }
                        MAIN.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                if (index == 0 && items.size() > 1) {
                                    verifyFolder(service, items, target, tx, ty);
                                } else {
                                    dragFolderStep(service, items, index + 1, tx, ty);
                                }
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

    private static void verifyFolder(SpiritAccessibilityService service, List<ActionItem> items,
                                     ActionTarget target, int tx, int ty) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                boolean found = false;
                try {
                    JSONObject probe = new JSONObject(DesktopProbe.probe(service));
                    JSONArray folders = probe.optJSONArray("folders");
                    if (folders != null) {
                        for (int i = 0; i < folders.length(); i++) {
                            JSONObject folder = folders.getJSONObject(i);
                            if (folder.optInt("screen", -1) == target.screen
                                && folder.optInt("cellX", -1) == target.col
                                && folder.optInt("cellY", -1) == target.row) {
                                found = true;
                                break;
                            }
                        }
                    }
                } catch (Throwable ignored) {
                }
                final boolean ok = found;
                MAIN.post(new Runnable() {
                    @Override
                    public void run() {
                        if (ok) dragFolderStep(service, items, 1, tx, ty);
                        else fail("folder", items.get(0).label, "access-folder-not-created", tx, ty);
                    }
                });
            }
        }).start();
    }

    private static int[] emptyCell(ActionItem a, ActionItem b, ActionTarget target) {
        for (int[] cell : target.emptyCells) {
            if (cell == null || cell.length < 2) continue;
            if (cell[0] == a.cellY && cell[1] == a.cellX) continue;
            if (cell[0] == b.cellY && cell[1] == b.cellX) continue;
            if (cell[0] == target.row && cell[1] == target.col) continue;
            return cell;
        }
        return null;
    }

    private static int[] cellPoint(SpiritAccessibilityService service, ActionTarget target,
                                   Rect source, int sourceRow, int sourceCol, int row, int col) {
        int w = service.getResources().getDisplayMetrics().widthPixels;
        int h = service.getResources().getDisplayMetrics().heightPixels;
        int top = dp(service, 52);
        int bottom = h - dp(service, 94);
        int usable = Math.max(dp(service, 180), bottom - top);
        int cw = Math.max(dp(service, 40), w / Math.max(1, target.cols));
        int ch = Math.max(dp(service, 40), usable / Math.max(1, target.rows));
        if (source == null || sourceRow < 0 || sourceCol < 0) {
            return cellCenter(service, target, row, col);
        }
        int x = source.centerX() + (col - sourceCol) * cw;
        int y = source.centerY() + (row - sourceRow) * ch;
        return new int[]{Math.max(0, Math.min(w - 1, x)), Math.max(0, Math.min(h - 1, y))};
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

    private static void verifyAt(SpiritAccessibilityService service, String label, int[] point,
                                 String missingDetail, Runnable ok, Runnable notMoved) {
        AccessibilityNodeInfo root = service.getRootInActiveWindow();
        AccessibilityNodeInfo node = findLabel(root, label);
        if (node == null) {
            if (notMoved != null) notMoved.run();
            return;
        }
        Rect bounds = iconRect(service, node);
        int tolerance = dp(service, 75);
        if (Math.abs(bounds.centerX() - point[0]) <= tolerance
            && Math.abs(bounds.centerY() - point[1]) <= tolerance) {
            ok.run();
        } else if (notMoved != null) {
            notMoved.run();
        }
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
            Rect bounds = iconRect(service, target);
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

    private static Rect iconRect(SpiritAccessibilityService service, AccessibilityNodeInfo node) {
        Rect rect = new Rect();
        node.getBoundsInScreen(rect);
        AccessibilityNodeInfo parent = node.getParent();
        for (int i = 0; i < 2 && parent != null; i++) {
            Rect p = new Rect();
            parent.getBoundsInScreen(p);
            int w = service.getResources().getDisplayMetrics().widthPixels;
            int h = service.getResources().getDisplayMetrics().heightPixels;
            if (p.width() > rect.width() && p.height() > rect.height()
                && p.width() < w * 0.65f && p.height() < h * 0.32f) {
                rect = p;
            }
            parent = parent.getParent();
        }
        return rect;
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
        drag(service, x1, y1, x2, y2, 1200, callback);
    }

    private static void drag(SpiritAccessibilityService service,
                             int x1, int y1, int x2, int y2, int duration, DragCallback callback) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                boolean ok = false;
                try {
                    RootBridge.Result result = RootBridge.run(
                        "input draganddrop " + x1 + " " + y1 + " " + x2 + " " + y2 + " " + duration, 15000L);
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
                            }, duration + 500L);
                            return;
                        }
                        boolean queued = dispatchDrag(service, x1, y1, x2, y2, duration);
                        MAIN.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                callback.done(queued);
                            }
                        }, duration + 700L);
                    }
                });
            }
        }).start();
    }

    private static boolean dispatchDrag(SpiritAccessibilityService service, int x1, int y1, int x2, int y2, int duration) {
        Path path = new Path();
        path.moveTo(x1, y1);
        path.lineTo(x2, y2);
        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0L, duration);
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
        String folderTitle = "";
        int cols = 4;
        int rows = 6;
        final List<int[]> emptyCells = new ArrayList<>();
    }
}
