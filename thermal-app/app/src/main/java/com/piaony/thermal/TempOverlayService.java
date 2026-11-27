package com.piaony.thermal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Locale;

public class TempOverlayService extends Service {

    public static final String ACTION_START = "com.piaony.thermal.OVERLAY_START";
    public static final String ACTION_STOP = "com.piaony.thermal.OVERLAY_STOP";

    private static final int NOTIFICATION_ID = 41;
    private static final String CHANNEL_ID = "thermal_overlay";
    private static volatile boolean running = false;

    private WindowManager windowManager;
    private View overlayView;
    private WindowManager.LayoutParams overlayParams;
    private TextView tempText;
    private ThermalController controller;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private final Runnable updateTask = new Runnable() {
        @Override
        public void run() {
            updateText();
            handler.postDelayed(this, 2000L);
        }
    };

    public static boolean isRunning() {
        return running;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        controller = new ThermalController(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!Settings.canDrawOverlays(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (overlayView == null) {
            createOverlay();
        }
        startForegroundCompat();
        running = true;
        updateText();
        handler.removeCallbacks(updateTask);
        handler.postDelayed(updateTask, 2000L);
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        handler.removeCallbacksAndMessages(null);
        removeOverlay();
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createOverlay() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.HORIZONTAL);
        box.setGravity(Gravity.CENTER_VERTICAL);
        box.setBackgroundResource(R.drawable.bg_overlay);
        box.setPadding(dp(14), dp(9), dp(8), dp(9));
        box.setElevation(dp(8));

        tempText = new TextView(this);
        tempText.setTextColor(Color.WHITE);
        tempText.setTextSize(13);
        tempText.setIncludeFontPadding(false);
        tempText.setText("CPU --°   GPU --°   壳 --°");
        tempText.setPadding(dp(2), dp(2), dp(10), dp(2));
        tempText.setOnTouchListener(new View.OnTouchListener() {
            private int startX;
            private int startY;
            private float downX;
            private float downY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        startX = overlayParams.x;
                        startY = overlayParams.y;
                        downX = event.getRawX();
                        downY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        overlayParams.x = startX + Math.round(event.getRawX() - downX);
                        overlayParams.y = startY + Math.round(event.getRawY() - downY);
                        windowManager.updateViewLayout(overlayView, overlayParams);
                        return true;
                    default:
                        return true;
                }
            }
        });

        TextView close = new TextView(this);
        close.setText("×");
        close.setTextColor(getColor(R.color.accent));
        close.setTextSize(20);
        close.setGravity(Gravity.CENTER);
        close.setPadding(dp(8), dp(1), dp(6), dp(3));
        close.setOnClickListener(v -> stopSelf());

        box.addView(tempText);
        box.addView(close);

        overlayParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                Build.VERSION.SDK_INT >= 26
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);
        overlayParams.gravity = Gravity.TOP | Gravity.START;
        overlayParams.x = dp(18);
        overlayParams.y = dp(180);

        overlayView = box;
        windowManager.addView(overlayView, overlayParams);
    }

    private void removeOverlay() {
        if (overlayView != null && windowManager != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {
            }
        }
        overlayView = null;
        tempText = null;
    }

    private void updateText() {
        if (tempText == null) return;
        ThermalController.Snapshot snapshot = controller.snapshot();
        tempText.setText("CPU " + format(snapshot.cpu)
                + "   GPU " + format(snapshot.gpu)
                + "   壳 " + format(snapshot.shell));
    }

    private String format(Double value) {
        if (value == null || value <= 0) return "--°";
        return String.format(Locale.US, "%.0f°", value);
    }

    private void startForegroundCompat() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "悬浮温度", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("桌面悬浮温度窗");
            channel.setShowBadge(false);
            nm.createNotificationChannel(channel);
        }

        Intent stop = new Intent(this, TempOverlayService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 42, stop,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        Notification notification = builder
                .setSmallIcon(R.drawable.ic_stat_temp)
                .setContentTitle("挞飞温控 · 悬浮温度")
                .setContentText("实时显示 CPU / GPU / 后盖温度")
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .addAction(new Notification.Action.Builder(
                        Icon.createWithResource(this, R.drawable.ic_stat_temp),
                        "停止", stopPi).build())
                .build();

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
