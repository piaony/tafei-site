package com.piaony.tafei;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;

/** 手机重启后，如果用户开过桌面精灵，就把悬浮窗接回来。 */
public class SpiritOverlayBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        boolean enabled = context.getSharedPreferences("tafei_app", 0)
            .getBoolean("overlay_enabled", false);
        if (!enabled) return;
        if (android.os.Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(context)) return;
        try {
            SpiritOverlayService.start(context);
        } catch (Exception ignored) {
        }
    }
}
