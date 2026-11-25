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

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
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
    private static volatile String lastActionState = "idle";
    private static volatile String lastActionType = "";
    private static volatile String lastActionDetail = "";
    private static volatile long lastActionId = 0L;
    private static volatile boolean actionRunning = false;

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

    public static String lastAction() {
        return lastActionState + "|" + lastActionType + "|" + lastActionDetail + "|" + lastActionId;
    }

    public static long lastActionId() {
        return lastActionId;
    }

    private static void reportAction(String state, String type, String detail) {
        lastActionState = state;
        lastActionType = type == null ? "" : type.replace("|", " ");
        lastActionDetail = detail == null ? "" : detail.replace("|", " ");
        lastActionId++;
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
    private int actionCols = 4;
    private int actionRows = 6;
    private int actionScanLimit = 6;
    private int actionScanLeft = 0;
    private int actionScanRight = 0;

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

    private static final class ActionItem {
        final int id;
        final String label;
        final String pkg;
        final int screen;
        final int cellX;
        final int cellY;

        ActionItem(JSONObject json) {
            this(json.optInt("id", -1), json.optString("label", ""), json.optString("package", ""),
                json.optInt("screen", 0), json.optInt("cellX", 0), json.optInt("cellY", 0));
        }

        ActionItem(int id, String label, String pkg, int screen, int cellX, int cellY) {
            this.id = id;
            this.label = label == null ? "" : label;
            this.pkg = pkg == null ? "" : pkg;
            this.screen = screen;
            this.cellX = cellX;
            this.cellY = cellY;
        }
    }

    private static final class ActionTarget {
        int screen = 0;
        int row = 0;
        int col = 0;
        String folderTitle = "";
        String folderName = "";
        final List<int[]> emptyCells = new ArrayList<>();
    }

    private interface ScanCallback {
        void found(Rect bounds);
        void failed(String detail);
    }

    private interface DragCallback {
        void done(boolean ok);
    }

    public static String startDesktopAction(String type, String payload, boolean dbEnabled) {
        SpiritAccessibilityService service = instance;
        if (service == null) return "no-service";
        if (actionRunning) return "busy";
        try {
            JSONObject root = new JSONObject(payload == null ? "{}" : payload);
            JSONArray array = root.optJSONArray("items");
            if (array == null || array.length() == 0) return "no-items";
            List<ActionItem> items = new ArrayList<>();
            for (int i = 0; i < array.length(); i++) items.add(new ActionItem(array.getJSONObject(i)));
            ActionTarget target = new ActionTarget();
            JSONObject targetJson = root.optJSONObject("target");
            if (targetJson != null) {
                target.screen = targetJson.optInt("screen", items.get(0).screen);
                target.row = targetJson.optInt("row", 0);
                target.col = targetJson.optInt("col", 0);
            }
            JSONObject folder = root.optJSONObject("targetFolder");
            if (folder != null) {
                target.folderTitle = folder.optString("title", "");
            }
            target.folderName = root.optString("folderName", "");
            JSONArray empties = root.optJSONArray("emptyCells");
            if (empties != null) {
                for (int i = 0; i < empties.length(); i++) {
                    JSONObject cell = empties.getJSONObject(i);
                    target.emptyCells.add(new int[]{cell.optInt("row", -1), cell.optInt("col", -1)});
                }
            }
            service.actionCols = Math.max(2, root.optInt("cols", 4));
            service.actionRows = Math.max(2, root.optInt("rows", 6));
            actionRunning = true;
            reportAction("running", type, "start");
            final String actionType = type;
            final List<ActionItem> actionItems = items;
            final ActionTarget actionTarget = target;
            final boolean database = dbEnabled;
            service.handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    try {
                        if ("move".equals(actionType)) service.runMove(actionItems, actionTarget, database);
                        else if ("swap".equals(actionType)) service.runSwap(actionItems, actionTarget, database);
                        else if ("folder".equals(actionType)) service.runFolder(actionItems, actionTarget, database);
                        else finishAction(false, actionType, "unknown-action");
                    } catch (Throwable t) {
                        finishAction(false, actionType, "exception:" + t.getMessage());
                    }
                }
            }, 800L);
            return "started";
        } catch (Throwable t) {
            actionRunning = false;
            reportAction("failed", type, "bad-payload");
            return "bad-payload";
        }
    }

    private void finishAction(boolean success, String type, String detail) {
        actionRunning = false;
        reportAction(success ? "success" : "failed", type, detail);
        try {
            toast(success ? "桌面管家：完成" : "桌面管家：" + detail);
        } catch (Throwable ignored) {
        }
    }

    private void runMove(List<ActionItem> items, ActionTarget target, boolean database) {
        if (items.size() != 1) {
            finishAction(false, "move", "need-one-item");
            return;
        }
        ActionItem item = items.get(0);
        if (item.screen == target.screen) {
            locateItem(item, new ScanCallback() {
                @Override
                public void found(Rect bounds) {
                    int[] to = cellCenter(target.row, target.col);
                    dragAsync(bounds.centerX(), bounds.centerY(), to[0], to[1], new DragCallback() {
                        @Override
                        public void done(boolean ok) {
                            if (!ok) {
                                if (database) dbMove(item, target, "move-db");
                                else finishAction(false, "move", "drag-failed");
                                return;
                            }
                            handler.postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    verifyMove(item, target);
                                }
                            }, 1100L);
                        }
                    });
                }

                @Override
                public void failed(String detail) {
                    if (database) dbMove(item, target, "move-db");
                    else finishAction(false, "move", detail);
                }
            });
            return;
        }
        if (database) {
            dbMove(item, target, "move-db");
        } else {
            finishAction(false, "move", "cross-page-needs-db");
        }
    }

    private void dbMove(ActionItem item, ActionTarget target, String detail) {
        if (item.id <= 0) {
            finishAction(false, "move", "missing-id");
            return;
        }
        List<LauncherDbEditor.Update> updates = new ArrayList<>();
        updates.add(new LauncherDbEditor.Update(item.id, target.screen, target.col, target.row));
        new Thread(new Runnable() {
            @Override
            public void run() {
                boolean ok = LauncherDbEditor.writePositions(getApplicationContext(), updates);
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        finishAction(ok, "move", ok ? detail : "db-write-failed");
                    }
                });
            }
        }).start();
    }

    private void verifyMove(ActionItem item, ActionTarget target) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        AccessibilityNodeInfo node = findLabel(root, item.label, 0);
        if (node == null) {
            finishAction(false, "move", "move-not-visible");
            return;
        }
        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        int[] to = cellCenter(target.row, target.col);
        int dx = Math.abs(bounds.centerX() - to[0]);
        int dy = Math.abs(bounds.centerY() - to[1]);
        finishAction(dx < dp(90) && dy < dp(90), "move", dx < dp(90) && dy < dp(90) ? "done" : "wrong-cell");
    }

    private void locateItem(ActionItem item, ScanCallback callback) {
        actionScanLeft = 0;
        actionScanRight = 0;
        actionScanLimit = Math.max(6, Math.min(9, item.screen + 2));
        scanLabel(item.label, callback);
    }

    private void locateLabel(String label, int expectedScreen, ScanCallback callback) {
        actionScanLeft = 0;
        actionScanRight = 0;
        actionScanLimit = Math.max(6, Math.min(9, Math.max(0, expectedScreen) + 2));
        scanLabel(label, callback);
    }

    private void scanLabel(String label, ScanCallback callback) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            callback.failed("no-root");
            return;
        }
        CharSequence pkg = root.getPackageName();
        if (pkg == null || !"com.android.launcher".contentEquals(pkg)) {
            callback.failed("not-launcher");
            return;
        }
        AccessibilityNodeInfo target = findLabel(root, label, 0);
        if (target != null) {
            Rect bounds = new Rect();
            target.getBoundsInScreen(bounds);
            if (bounds.width() > 20 && bounds.height() > 20) {
                callback.found(bounds);
            } else {
                callback.failed("invalid-bounds");
            }
            return;
        }
        if (actionScanLeft < actionScanLimit) {
            if (swipeLeft()) {
                actionScanLeft++;
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        scanLabel(label, callback);
                    }
                }, 520L);
                return;
            }
        }
        if (actionScanRight < actionScanLimit * 2) {
            if (swipeRight()) {
                actionScanRight++;
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        scanLabel(label, callback);
                    }
                }, 520L);
                return;
            }
        }
        callback.failed("not-found");
    }

    private int[] cellCenter(int row, int col) {
        int w = getResources().getDisplayMetrics().widthPixels;
        int h = getResources().getDisplayMetrics().heightPixels;
        int x = (int) ((col + 0.5f) * w / Math.max(1, actionCols));
        int y = (int) ((row + 0.5f) * h / Math.max(1, actionRows));
        return new int[]{Math.max(0, Math.min(w - 1, x)), Math.max(0, Math.min(h - 1, y))};
    }

    private void dragAsync(int x1, int y1, int x2, int y2, DragCallback callback) {
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
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        if (rootOk) {
                            handler.postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    callback.done(true);
                                }
                            }, 1100L);
                            return;
                        }
                        boolean queued = dispatchDrag(x1, y1, x2, y2);
                        handler.postDelayed(new Runnable() {
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

    private boolean dispatchDrag(int x1, int y1, int x2, int y2) {
        Path path = new Path();
        path.moveTo(x1, y1);
        path.lineTo(x2, y2);
        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0L, 1200L);
        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(stroke)
            .build();
        return dispatchGesture(gesture, null, null);
    }

    private void runSwap(List<ActionItem> items, ActionTarget target, boolean database) {
        if (items.size() != 2) {
            finishAction(false, "swap", "need-two-items");
            return;
        }
        ActionItem a = items.get(0);
        ActionItem b = items.get(1);
        if (a.screen != b.screen) {
            if (database) {
                dbSwap(a, b);
            } else {
                finishAction(false, "swap", "cross-page-needs-db");
            }
            return;
        }
        locateItem(a, new ScanCallback() {
            @Override
            public void found(Rect bounds) {
                AccessibilityNodeInfo root = getRootInActiveWindow();
                AccessibilityNodeInfo other = findLabel(root, b.label, 0);
                if (other == null) {
                    finishAction(false, "swap", "second-not-on-page");
                    return;
                }
                Rect otherBounds = new Rect();
                other.getBoundsInScreen(otherBounds);
                if (otherBounds.width() < 20 || otherBounds.height() < 20) {
                    finishAction(false, "swap", "second-bounds");
                    return;
                }
                int[] temp = emptyCell(a.cellX, a.cellY, b.cellX, b.cellY, target.emptyCells);
                if (temp == null) {
                    finishAction(false, "swap", "no-empty-cell");
                    return;
                }
                int[] tempPoint = cellCenter(temp[0], temp[1]);
                int ax = bounds.centerX();
                int ay = bounds.centerY();
                int bx = otherBounds.centerX();
                int by = otherBounds.centerY();
                dragAsync(ax, ay, tempPoint[0], tempPoint[1], new DragCallback() {
                    @Override
                    public void done(boolean ok) {
                        if (!ok) {
                            if (database) dbSwap(a, b);
                            else finishAction(false, "swap", "first-drag-failed");
                            return;
                        }
                        handler.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                dragSecondAndFinish(a, b, ax, ay, bx, by, target, database);
                            }
                        }, 1000L);
                    }
                });
            }

            @Override
            public void failed(String detail) {
                if (database) dbSwap(a, b);
                else finishAction(false, "swap", detail);
            }
        });
    }

    private void dragSecondAndFinish(ActionItem a, ActionItem b, int ax, int ay, int bx, int by, ActionTarget target, boolean database) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        AccessibilityNodeInfo nodeB = findLabel(root, b.label, 0);
        if (nodeB == null) {
            if (database) dbSwap(a, b);
            else finishAction(false, "swap", "second-disappeared");
            return;
        }
        Rect bBounds = new Rect();
        nodeB.getBoundsInScreen(bBounds);
        dragAsync(bBounds.centerX(), bBounds.centerY(), ax, ay, new DragCallback() {
            @Override
            public void done(boolean ok) {
                if (!ok) {
                    if (database) dbSwap(a, b);
                    else finishAction(false, "swap", "second-drag-failed");
                    return;
                }
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        AccessibilityNodeInfo root2 = getRootInActiveWindow();
                        AccessibilityNodeInfo nodeA = findLabel(root2, a.label, 0);
                        if (nodeA == null) {
                            if (database) dbSwap(a, b);
                            else finishAction(false, "swap", "first-disappeared");
                            return;
                        }
                        Rect aBounds = new Rect();
                        nodeA.getBoundsInScreen(aBounds);
                        dragAsync(aBounds.centerX(), aBounds.centerY(), bx, by, new DragCallback() {
                            @Override
                            public void done(boolean ok2) {
                                if (!ok2) {
                                    if (database) dbSwap(a, b);
                                    else finishAction(false, "swap", "third-drag-failed");
                                    return;
                                }
                                handler.postDelayed(new Runnable() {
                                    @Override
                                    public void run() {
                                        verifySwap(a, b, bx, by, ax, ay);
                                    }
                                }, 1100L);
                            }
                        });
                    }
                }, 1000L);
            }
        });
    }

    private int[] emptyCell(int ax, int ay, int bx, int by, List<int[]> cells) {
        for (int[] cell : cells) {
            if (cell == null || cell.length < 2) continue;
            if (cell[1] == ax && cell[0] == ay) continue;
            if (cell[1] == bx && cell[0] == by) continue;
            return cell;
        }
        return null;
    }

    private void verifySwap(ActionItem a, ActionItem b, int ax, int ay, int bx, int by) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        AccessibilityNodeInfo nodeA = findLabel(root, a.label, 0);
        AccessibilityNodeInfo nodeB = findLabel(root, b.label, 0);
        if (nodeA == null || nodeB == null) {
            finishAction(false, "swap", "verify-missing");
            return;
        }
        Rect ra = new Rect();
        Rect rb = new Rect();
        nodeA.getBoundsInScreen(ra);
        nodeB.getBoundsInScreen(rb);
        boolean ok = Math.abs(ra.centerX() - bx) < dp(90) && Math.abs(ra.centerY() - by) < dp(90)
            && Math.abs(rb.centerX() - ax) < dp(90) && Math.abs(rb.centerY() - ay) < dp(90);
        finishAction(ok, "swap", ok ? "done" : "wrong-cells");
    }

    private void dbSwap(ActionItem a, ActionItem b) {
        if (a.id <= 0 || b.id <= 0) {
            finishAction(false, "swap", "missing-id");
            return;
        }
        List<LauncherDbEditor.Update> updates = new ArrayList<>();
        updates.add(new LauncherDbEditor.Update(a.id, b.screen, b.cellX, b.cellY));
        updates.add(new LauncherDbEditor.Update(b.id, a.screen, a.cellX, a.cellY));
        new Thread(new Runnable() {
            @Override
            public void run() {
                boolean ok = LauncherDbEditor.writePositions(getApplicationContext(), updates);
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        finishAction(ok, "swap", ok ? "db" : "db-write-failed");
                    }
                });
            }
        }).start();
    }

    private void runFolder(List<ActionItem> items, ActionTarget target, boolean database) {
        if (items.size() < 2) {
            finishAction(false, "folder", "need-two-items");
            return;
        }
        boolean allSamePage = true;
        for (ActionItem item : items) if (item.screen != target.screen) allSamePage = false;
        if (!allSamePage && !database) {
            finishAction(false, "folder", "cross-page-needs-db");
            return;
        }
        if (allSamePage) {
            if (!target.folderTitle.isEmpty()) {
                locateLabel(target.folderTitle, target.screen, new ScanCallback() {
                    @Override
                    public void found(Rect bounds) {
                        dragItemsIntoFolder(items, 0, bounds.centerX(), bounds.centerY());
                    }

                    @Override
                    public void failed(String detail) {
                        finishAction(false, "folder", "folder-not-found");
                    }
                });
                return;
            }
            locateItem(items.get(0), new ScanCallback() {
                @Override
                public void found(Rect bounds) {
                    int[] to = cellCenter(target.row, target.col);
                    dragAsync(bounds.centerX(), bounds.centerY(), to[0], to[1], new DragCallback() {
                        @Override
                        public void done(boolean ok) {
                            if (!ok) {
                                finishAction(false, "folder", "host-drag-failed");
                                return;
                            }
                            handler.postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    dragItemsIntoFolder(items, 1, to[0], to[1]);
                                }
                            }, 1100L);
                        }
                    });
                }

                @Override
                public void failed(String detail) {
                    finishAction(false, "folder", detail);
                }
            });
            return;
        }

        // 跨页文件夹：先把需要跨页的图标搬到目标页的空位，再在目标页做拖拽。
        List<LauncherDbEditor.Update> updates = new ArrayList<>();
        List<ActionItem> staged = new ArrayList<>();
        List<int[]> used = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            ActionItem item = items.get(i);
            boolean host = target.folderTitle.isEmpty() && i == 0;
            if (host) {
                if (item.id <= 0) {
                    finishAction(false, "folder", "missing-id");
                    return;
                }
                if (item.screen != target.screen || item.cellX != target.col || item.cellY != target.row) {
                    updates.add(new LauncherDbEditor.Update(item.id, target.screen, target.col, target.row));
                }
                staged.add(new ActionItem(item.id, item.label, item.pkg, target.screen, target.col, target.row));
                continue;
            }
            if (item.screen == target.screen) {
                staged.add(item);
                continue;
            }
            if (item.id <= 0) {
                finishAction(false, "folder", "missing-id");
                return;
            }
            int[] cell = nextEmptyCell(target, used);
            if (cell == null) {
                finishAction(false, "folder", "not-enough-empty-cells");
                return;
            }
            used.add(cell);
            updates.add(new LauncherDbEditor.Update(item.id, target.screen, cell[1], cell[0]));
            staged.add(new ActionItem(item.id, item.label, item.pkg, target.screen, cell[1], cell[0]));
        }
        if (updates.isEmpty()) {
            runFolder(staged, target, false);
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                boolean ok = LauncherDbEditor.writePositions(getApplicationContext(), updates);
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        if (!ok) {
                            finishAction(false, "folder", "db-write-failed");
                            return;
                        }
                        runFolderAfterDb(staged, target);
                    }
                }, 2400L);
            }
        }).start();
    }

    private int[] nextEmptyCell(ActionTarget target, List<int[]> used) {
        for (int[] cell : target.emptyCells) {
            if (cell == null || cell.length < 2) continue;
            if (cell[0] == target.row && cell[1] == target.col) continue;
            boolean hit = false;
            for (int[] u : used) if (u[0] == cell[0] && u[1] == cell[1]) hit = true;
            if (!hit) return cell;
        }
        return null;
    }

    private void runFolderAfterDb(List<ActionItem> items, ActionTarget target) {
        if (!target.folderTitle.isEmpty()) {
            locateLabel(target.folderTitle, target.screen, new ScanCallback() {
                @Override
                public void found(Rect bounds) {
                    dragItemsIntoFolder(items, 0, bounds.centerX(), bounds.centerY());
                }

                @Override
                public void failed(String detail) {
                    finishAction(false, "folder", "folder-not-found-after-db");
                }
            });
            return;
        }
        locateItem(items.get(0), new ScanCallback() {
            @Override
            public void found(Rect bounds) {
                int[] to = cellCenter(target.row, target.col);
                // 宿主已经被数据库放到目标格；直接把其余应用拖到目标格。
                dragItemsIntoFolder(items, 1, to[0], to[1]);
            }

            @Override
            public void failed(String detail) {
                finishAction(false, "folder", detail);
            }
        });
    }

    private void dragItemsIntoFolder(List<ActionItem> items, int index, int tx, int ty) {
        if (index >= items.size()) {
            finishAction(true, "folder", "done");
            return;
        }
        ActionItem item = items.get(index);
        locateItem(item, new ScanCallback() {
            @Override
            public void found(Rect bounds) {
                dragAsync(bounds.centerX(), bounds.centerY(), tx, ty, new DragCallback() {
                    @Override
                    public void done(boolean ok) {
                        if (!ok) {
                            finishAction(false, "folder", "item-drag-failed");
                            return;
                        }
                        handler.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                dragItemsIntoFolder(items, index + 1, tx, ty);
                            }
                        }, 1000L);
                    }
                });
            }

            @Override
            public void failed(String detail) {
                finishAction(false, "folder", detail);
            }
        });
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

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void toast(String msg) {
        Toast.makeText(getApplicationContext(), msg, Toast.LENGTH_SHORT).show();
    }
}
