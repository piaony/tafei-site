package com.piaony.tafei;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * 桌面精灵悬浮窗。
 * 退出 App 后，用前台服务把当前伙伴留在桌面上；点一下说台词，连点两下回到挞飞。
 * 需要「显示在其他应用上层」权限，国产系统还需要允许自启动/后台活动。
 */
public class SpiritOverlayService extends Service {

    public static final String ACTION_START = "com.piaony.tafei.overlay.START";
    public static final String ACTION_STOP = "com.piaony.tafei.overlay.STOP";
    public static final String ACTION_APP_STATE = "com.piaony.tafei.overlay.APP_STATE";
    public static final String ACTION_UPDATE = "com.piaony.tafei.overlay.UPDATE";
    public static final String ACTION_SPIRIT = "com.piaony.tafei.overlay.SPIRIT";
    public static final String EXTRA_FOREGROUND = "foreground";

    private static final String CHANNEL_ID = "tafei_overlay";
    private static final int NOTIFICATION_ID = 9101;
    private static final String PREFS = "tafei_app";
    private static final String PREF_ENABLED = "overlay_enabled";
    private static final String PREF_SIZE = "overlay_size";
    private static final String PREF_OPACITY = "overlay_opacity";
    private static final String PREF_SPIRIT = "overlay_spirit";

    private static volatile boolean appForeground = true;
    private static volatile SpiritOverlayService instance;

    private WindowManager windowManager;
    private WindowManager.LayoutParams params;
    private LinearLayout root;
    private FrameLayout stage;
    private ParticleView particleView;
    private ImageView sprite;
    private TextView bubble;
    private final Map<String, Bitmap> frameCache = new HashMap<>();
    private final Random random = new Random();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final String[] lines = new String[]{
        "今天也要一起收集糖霜吗？",
        "我在这儿，切回挞飞就能继续玩。",
        "别忘了喂我一点零食。",
        "桌面有点亮，我眯一会儿。",
        "你忙你的，我替你看着时间。"
    };
    private int lineIndex = 0;
    private long lastTapAt = 0L;
    private float lastRawX = 0f;
    private float lastRawY = 0f;
    private float lastDownY = 0f;
    private boolean moved = false;
    private boolean longPressFired = false;
    private int scalePercent = 100;

    public static void start(Context context) {
        Intent intent = new Intent(context, SpiritOverlayService.class).setAction(ACTION_START);
        ContextCompat.startForegroundService(context, intent);
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, SpiritOverlayService.class));
    }

    /** App 回到前台时收起悬浮窗，退到后台时再放出来。 */
    public static void onAppState(Context context, boolean foreground) {
        appForeground = foreground;
        SpiritOverlayService svc = instance;
        if (svc != null) {
            svc.updateVisibility();
            return;
        }
        SharedPreferences sp = context.getSharedPreferences(PREFS, 0);
        if (!sp.getBoolean(PREF_ENABLED, false)) return;
        try {
            Intent intent = new Intent(context, SpiritOverlayService.class)
                .setAction(ACTION_APP_STATE)
                .putExtra(EXTRA_FOREGROUND, foreground);
            if (foreground) {
                ContextCompat.startForegroundService(context, intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception ignored) {
        }
    }

    public static void updatePrefs(Context context) {
        SpiritOverlayService svc = instance;
        if (svc != null) {
            svc.applyPrefs();
            return;
        }
        SharedPreferences sp = context.getSharedPreferences(PREFS, 0);
        if (!sp.getBoolean(PREF_ENABLED, false)) return;
        try {
            Intent intent = new Intent(context, SpiritOverlayService.class).setAction(ACTION_UPDATE);
            ContextCompat.startForegroundService(context, intent);
        } catch (Exception ignored) {
        }
    }

    public static void updateSpirit(Context context) {
        SpiritOverlayService svc = instance;
        if (svc != null && svc.sprite != null) {
            svc.handler.post(new Runnable() {
                @Override
                public void run() {
                    if (svc.sprite == null) return;
                    svc.frameCache.clear();
                    Bitmap art = svc.spiritBitmap();
                    if (art != null) svc.sprite.setImageBitmap(art);
                }
            });
            return;
        }
        SharedPreferences sp = context.getSharedPreferences(PREFS, 0);
        if (!sp.getBoolean(PREF_ENABLED, false)) return;
        try {
            Intent intent = new Intent(context, SpiritOverlayService.class).setAction(ACTION_SPIRIT);
            ContextCompat.startForegroundService(context, intent);
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        ensureChannel();
        if (!canOverlay()) {
            setEnabled(false);
            stopSelf();
            return;
        }
        startForegroundCompat();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = (intent == null) ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            setEnabled(false);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!canOverlay()) {
            setEnabled(false);
            stopSelf();
            return START_NOT_STICKY;
        }
        startForegroundCompat();
        if (ACTION_APP_STATE.equals(action)) {
            appForeground = intent.getBooleanExtra(EXTRA_FOREGROUND, appForeground);
        } else {
            setEnabled(true);
        }
        ensureOverlay();
        applyPrefs();
        updateVisibility();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (root != null && windowManager != null) {
            try {
                windowManager.removeView(root);
            } catch (Exception ignored) {
            }
        }
        if (sprite != null) sprite.animate().cancel();
        frameCache.clear();
        root = null;
        stage = null;
        particleView = null;
        sprite = null;
        bubble = null;
        if (instance == this) instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private boolean canOverlay() {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this);
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "桌面精灵", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("退出 App 后，让伙伴继续留在桌面");
        channel.setSound(null, null);
        channel.enableVibration(false);
        nm.createNotificationChannel(channel);
    }

    private void startForegroundCompat() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(
            this, 101, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stop = new Intent(this, SpiritOverlayService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(
            this, 102, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_spirit_notify)
            .setContentTitle("挞飞精灵正在陪着你")
            .setContentText("点一下回到挞飞，也可以在这里收起精灵")
            .setContentIntent(openPi)
            .addAction(0, "收起精灵", stopPi)
            .setOngoing(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void ensureOverlay() {
        if (root != null || windowManager == null) return;
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = dp(4);
        root.setPadding(pad, pad, pad, pad);

        bubble = new TextView(this);
        bubble.setTextColor(Color.WHITE);
        bubble.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f);
        bubble.setTypeface(Typeface.DEFAULT);
        bubble.setGravity(Gravity.CENTER);
        bubble.setPadding(dp(9), dp(7), dp(9), dp(7));
        bubble.setMaxWidth(dp(220));
        GradientDrawable bubbleBg = new GradientDrawable();
        bubbleBg.setColor(Color.parseColor("#E6111A31"));
        bubbleBg.setCornerRadius(dp(11));
        bubbleBg.setStroke(dp(1), Color.parseColor("#55FFD36E"));
        bubble.setBackground(bubbleBg);
        bubble.setVisibility(View.GONE);
        LinearLayout.LayoutParams bubbleLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bubbleLp.bottomMargin = dp(5);
        root.addView(bubble, bubbleLp);

        stage = new FrameLayout(this);
        particleView = new ParticleView(this);
        stage.addView(particleView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        sprite = new ImageView(this);
        sprite.setScaleType(ImageView.ScaleType.FIT_CENTER);
        Bitmap art = spiritBitmap();
        if (art != null) sprite.setImageBitmap(art);
        else sprite.setImageResource(R.mipmap.ic_launcher);
        stage.addView(sprite, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        LinearLayout.LayoutParams stageLp = new LinearLayout.LayoutParams(dp(104), dp(104));
        root.addView(stage, stageLp);

        int type = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = Math.max(0, screenWidth() - dp(120));
        params.y = Math.max(dp(80), screenHeight() / 2);

        root.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        lastRawX = event.getRawX();
                        lastRawY = event.getRawY();
                        lastDownY = event.getY();
                        moved = false;
                        longPressFired = false;
                        handler.postDelayed(longPressTask, 520L);
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX() - lastRawX;
                        float dy = event.getRawY() - lastRawY;
                        if (Math.abs(dx) > dp(4) || Math.abs(dy) > dp(4)) {
                            moved = true;
                            handler.removeCallbacks(longPressTask);
                        }
                        if (moved) {
                            params.x += (int) dx;
                            params.y += (int) dy;
                            lastRawX = event.getRawX();
                            lastRawY = event.getRawY();
                            clampPosition();
                            try {
                                windowManager.updateViewLayout(root, params);
                            } catch (Exception ignored) {
                            }
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        handler.removeCallbacks(longPressTask);
                        if (!moved && !longPressFired) handleTap(lastDownY);
                        return true;
                    case MotionEvent.ACTION_CANCEL:
                        handler.removeCallbacks(longPressTask);
                        return true;
                    default:
                        return false;
                }
            }
        });

        try {
            windowManager.addView(root, params);
        } catch (Exception e) {
            root = null;
            setEnabled(false);
            stopSelf();
            return;
        }
        root.post(new Runnable() {
            @Override
            public void run() {
                if (root != null && params != null) {
                    params.x = Math.max(0, screenWidth() - root.getWidth() - dp(4));
                    clampPosition();
                    try {
                        windowManager.updateViewLayout(root, params);
                    } catch (Exception ignored) {
                    }
                }
            }
        });
    }

    private void handleTap(float localY) {
        long now = System.currentTimeMillis();
        if (now - lastTapAt < 360L) {
            lastTapAt = 0L;
            hideBubble();
            handler.removeCallbacks(revertFrameTask);
            Intent open = new Intent(this, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(open);
            return;
        }
        lastTapAt = now;
        if (stage != null && localY < stage.getHeight() * 0.58f) {
            showReaction("emotion-happy", "摸头成功，头发要乱啦。", 13);
        } else {
            int roll = random.nextInt(5);
            if (roll == 0) showReaction("emotion-shy", "别、别一直戳我……", 11);
            else if (roll == 1) showReaction("emotion-angry", "再戳就要生气了！", 9);
            else showReaction("emotion-surprised", "诶？突然戳我一下。", 13);
        }
    }

    private final Runnable longPressTask = new Runnable() {
        @Override
        public void run() {
            if (moved || root == null) return;
            longPressFired = true;
            moved = true;
            showReaction("action-pet", "呼噜呼噜……再摸一会儿。", 16);
        }
    };

    private void showReaction(String frame, String text, int particles) {
        showFrame(frame, 1500);
        if (particleView != null) particleView.burst(particles);
        if (sprite != null) {
            sprite.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
            sprite.animate().cancel();
            sprite.setScaleX(1f);
            sprite.setScaleY(1f);
            sprite.animate()
                .scaleX(1.1f).scaleY(1.1f).setDuration(110)
                .withEndAction(new Runnable() {
                    @Override
                    public void run() {
                        if (sprite == null) return;
                        sprite.animate().scaleX(1f).scaleY(1f).setDuration(180).start();
                    }
                }).start();
        }
        showBubble(text);
    }

    private final Runnable revertFrameTask = new Runnable() {
        @Override
        public void run() {
            if (sprite == null) return;
            Bitmap art = frameBitmap("main");
            if (art != null) sprite.setImageBitmap(art);
        }
    };

    private void showBubble(String text) {
        if (bubble == null) return;
        handler.removeCallbacks(hideBubbleTask);
        bubble.setText(text);
        bubble.setVisibility(View.VISIBLE);
        bubble.setAlpha(0f);
        bubble.animate().alpha(1f).setDuration(150).start();
        handler.postDelayed(hideBubbleTask, 2600L);
    }

    private final Runnable hideBubbleTask = new Runnable() {
        @Override
        public void run() {
            hideBubble();
        }
    };

    private void hideBubble() {
        if (bubble == null) return;
        bubble.animate().alpha(0f).setDuration(120).withEndAction(new Runnable() {
            @Override
            public void run() {
                if (bubble != null) bubble.setVisibility(View.GONE);
            }
        }).start();
    }

    private void applyPrefs() {
        scalePercent = getSharedPreferences(PREFS, 0).getInt(PREF_SIZE, 100);
        int opacity = getSharedPreferences(PREFS, 0).getInt(PREF_OPACITY, 100);
        if (root != null) {
            root.setAlpha(Math.max(0.4f, Math.min(1f, opacity / 100f)));
        }
        if (stage != null) {
            int size = dp((int) Math.round(104 * scalePercent / 100.0));
            LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) stage.getLayoutParams();
            lp.width = size;
            lp.height = size;
            stage.setLayoutParams(lp);
        }
        if (root != null && params != null) {
            try {
                windowManager.updateViewLayout(root, params);
            } catch (Exception ignored) {
            }
        }
    }

    private String spiritFolder() {
        String id = getSharedPreferences(PREFS, 0).getString(PREF_SPIRIT, "xiaota");
        if (id == null || id.isEmpty()) id = "xiaota";
        id = id.replaceAll("[^a-zA-Z0-9-]", "");
        if (id.isEmpty()) id = "xiaota";
        return id + "-v23";
    }

    private Bitmap spiritBitmap() {
        return frameBitmap("main");
    }

    private Bitmap frameBitmap(String name) {
        String folder = spiritFolder();
        String key = folder + "/" + name;
        Bitmap cached = frameCache.get(key);
        if (cached != null) return cached;
        Bitmap art = readAsset("public/assets/spirits/" + folder + "/" + name + ".webp");
        if (art == null && !"xiaota-v23".equals(folder)) {
            art = readAsset("public/assets/spirits/xiaota-v23/" + name + ".webp");
        }
        if (art == null && !"main".equals(name)) {
            art = readAsset("public/assets/spirits/" + folder + "/main.webp");
        }
        if (art != null) frameCache.put(key, art);
        return art;
    }

    private Bitmap readAsset(String path) {
        InputStream input = null;
        try {
            input = getAssets().open(path);
            return BitmapFactory.decodeStream(input);
        } catch (Exception ignored) {
            return null;
        } finally {
            if (input != null) {
                try {
                    input.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private void showFrame(String name, int durationMs) {
        if (sprite == null) return;
        Bitmap art = frameBitmap(name);
        if (art != null) sprite.setImageBitmap(art);
        handler.removeCallbacks(revertFrameTask);
        if (durationMs > 0) handler.postDelayed(revertFrameTask, durationMs);
    }

    private void updateVisibility() {
        if (root == null) return;
        root.setVisibility(appForeground ? View.GONE : View.VISIBLE);
        if (!appForeground && particleView != null) particleView.invalidate();
    }

    private void clampPosition() {
        if (root == null || params == null) return;
        int w = root.getWidth();
        int h = root.getHeight();
        int sw = screenWidth();
        int sh = screenHeight();
        params.x = Math.max(0, Math.min(params.x, sw - w));
        params.y = Math.max(0, Math.min(params.y, sh - h - dp(12)));
    }

    private int screenWidth() {
        return getResources().getDisplayMetrics().widthPixels;
    }

    private int screenHeight() {
        return getResources().getDisplayMetrics().heightPixels;
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }

    private void setEnabled(boolean enabled) {
        getSharedPreferences(PREFS, 0).edit().putBoolean(PREF_ENABLED, enabled).apply();
    }
}
