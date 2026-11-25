package com.piaony.tafei;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;

/** 把应用图标转成 WebView 可直接用的 base64 PNG。 */
public final class AppIconUtil {

    private static final Map<String, String> CACHE = new HashMap<>();
    private static final int MAX_SIZE = 240;

    private AppIconUtil() {}

    public static String data(Context context, String pkg) {
        if (pkg == null || pkg.trim().isEmpty()) return "";
        String key = pkg.trim();
        String cached = CACHE.get(key);
        if (cached != null) return cached;
        try {
            Drawable drawable = context.getPackageManager().getApplicationIcon(key);
            int size = Math.round(56 * context.getResources().getDisplayMetrics().density);
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, size, size);
            drawable.draw(canvas);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
            bitmap.recycle();
            String data = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            if (CACHE.size() > MAX_SIZE) CACHE.clear();
            CACHE.put(key, data);
            return data;
        } catch (Throwable ignored) {
            return "";
        }
    }
}
