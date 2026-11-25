package com.piaony.tafei;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * 站内消息通知：系统通知 / 站内公告 / 私信有新内容时，在通知栏提醒。
 * 点击通知回到 App，并跳到社区页。
 */
public class NotificationHelper {

    private static final String CHANNEL_ID = "tafei_messages";
    private static final String CHANNEL_NAME = "消息与公告";

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("系统通知、站内公告和私信提醒");
        channel.enableVibration(true);
        nm.createNotificationChannel(channel);
    }

    public static boolean hasPermission(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(context, "android.permission.POST_NOTIFICATIONS")
                == PackageManager.PERMISSION_GRANTED;
    }

    /** 安卓 13 及以上需要动态申请；已申请过就不再打扰。 */
    public static void requestPermission(Activity activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (hasPermission(activity)) return;
        try {
            activity.requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1001);
        } catch (Throwable ignored) {
        }
    }

    public static void show(Context context, String title, String body, String page) {
        if (!hasPermission(context)) return;
        ensureChannel(context);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        String safeTitle = (title == null || title.trim().isEmpty()) ? "挞飞" : title.trim();
        String safeBody = (body == null) ? "" : body.trim();
        if (safeBody.length() > 180) safeBody = safeBody.substring(0, 180) + "…";

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("tafei_page", (page == null || page.isEmpty()) ? "community" : page);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pending = PendingIntent.getActivity(context, (int) (System.currentTimeMillis() % 100000), intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(safeTitle)
                .setContentText(safeBody)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(safeBody))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pending);

        try {
            nm.notify((int) (System.currentTimeMillis() % 100000), builder.build());
        } catch (Throwable ignored) {
        }
    }
}
