package com.piaony.thermal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Undo persist.* thermal props after reboot. Sysfs trip points reset themselves.
 * The user has already granted root once, so this should run without a prompt.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        final PendingResult pending = goAsync();
        final Context app = context.getApplicationContext();
        new Thread(() -> {
            try {
                new ThermalController(app).restorePersistedPropertiesOnBoot();
            } finally {
                pending.finish();
            }
        }, "thermal-boot-restore").start();
    }
}
