package com.piaony.tafei;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.os.SystemClock;
import android.view.View;

import java.util.Random;

/**
 * 吃掉桌面图标的整屏特效层。
 * 只负责画星链、锁定环、飞向瑶的光球和星屑；全屏透明且不可触摸。
 */
public class EatEffectView extends View {

    private static final int MODE_NONE = 0;
    private static final int MODE_FOUND = 1;
    private static final int MODE_SUCCESS = 2;
    private static final int MODE_FAIL = 3;
    private static final int MODE_ACTION = 4;
    private static final int BIT_COUNT = 26;

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    private final Path path = new Path();
    private final Path star = new Path();
    private final RectF dst = new RectF();
    private final Random random = new Random();

    private int mode = MODE_NONE;
    private long startedAt = 0L;
    private float spiritX;
    private float spiritY;
    private float targetX;
    private float targetY;
    private Bitmap icon;
    private String label = "";
    private String action = "";

    private float[] bitAngles;
    private float[] bitSpeeds;
    private int[] bitColors;

    private final int[] colors = new int[]{
        Color.parseColor("#FFD36E"),
        Color.parseColor("#C7A6FF"),
        Color.parseColor("#FF9AC4"),
        Color.parseColor("#8CE8FF")
    };

    public EatEffectView(Context context) {
        super(context);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
    }

    public void playFound(float sx, float sy, float tx, float ty, Bitmap appIcon, String name) {
        mode = MODE_FOUND;
        startedAt = SystemClock.uptimeMillis();
        spiritX = sx;
        spiritY = sy;
        targetX = tx;
        targetY = ty;
        icon = appIcon;
        label = name == null ? "" : name;
        bitAngles = null;
        invalidate();
    }

    public void playSuccess(float tx, float ty, float mx, float my, Bitmap appIcon, String name) {
        mode = MODE_SUCCESS;
        startedAt = SystemClock.uptimeMillis();
        targetX = tx;
        targetY = ty;
        spiritX = mx;
        spiritY = my;
        icon = appIcon;
        label = name == null ? "" : name;
        makeBits();
        invalidate();
    }

    public void playDesktopAction(float tx, float ty, String actionName, String name) {
        mode = MODE_ACTION;
        startedAt = SystemClock.uptimeMillis();
        targetX = tx;
        targetY = ty;
        action = actionName == null ? "" : actionName;
        label = name == null ? "" : name;
        icon = null;
        bitAngles = null;
        makeBits();
        invalidate();
    }

    public void playFailure(float tx, float ty, Bitmap appIcon) {
        mode = MODE_FAIL;
        startedAt = SystemClock.uptimeMillis();
        targetX = tx;
        targetY = ty;
        icon = appIcon;
        bitAngles = null;
        invalidate();
    }

    public void clear() {
        mode = MODE_NONE;
        icon = null;
        bitAngles = null;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (mode == MODE_NONE) return;
        float elapsed = (SystemClock.uptimeMillis() - startedAt) / 1000f;
        if (mode == MODE_FOUND) {
            drawFound(canvas, elapsed);
            if (elapsed < 0.85f) postInvalidateDelayed(30);
            else mode = MODE_NONE;
        } else if (mode == MODE_SUCCESS) {
            drawSuccess(canvas, elapsed);
            if (elapsed < 1.15f) postInvalidateDelayed(30);
            else mode = MODE_NONE;
        } else if (mode == MODE_FAIL) {
            drawFailure(canvas, elapsed);
            if (elapsed < 0.95f) postInvalidateDelayed(30);
            else mode = MODE_NONE;
        } else {
            drawDesktopAction(canvas, elapsed);
            if (elapsed < 1.35f) postInvalidateDelayed(30);
            else mode = MODE_NONE;
        }
    }

    private void drawFound(Canvas canvas, float elapsed) {
        float p = Math.min(1f, elapsed / 0.72f);
        float ease = 1f - (float) Math.pow(1f - p, 3f);

        // 瑶到图标的金色星链。
        path.reset();
        path.moveTo(spiritX, spiritY);
        float midX = (spiritX + targetX) / 2f;
        float midY = (spiritY + targetY) / 2f - dp(34);
        path.quadTo(midX, midY, targetX, targetY);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1.7f));
        paint.setColor(Color.parseColor("#FFD36E"));
        paint.setAlpha((int) (190 * ease));
        canvas.drawPath(path, paint);

        // 星链上的流动光点。
        paint.setStyle(Paint.Style.FILL);
        for (int i = 0; i < 7; i++) {
            float u = (p * 0.85f + i * 0.145f) % 1f;
            float x = quad(spiritX, midX, targetX, u);
            float y = quad(spiritY, midY, targetY, u);
            int alpha = i % 2 == 0 ? 245 : 145;
            paint.setColor(i % 2 == 0 ? Color.parseColor("#FFF2BF") : Color.parseColor("#C7A6FF"));
            paint.setAlpha((int) (alpha * ease));
            canvas.drawCircle(x, y, dp(i % 2 == 0 ? 2.2f : 1.5f), paint);
        }

        // 目标锁定环。
        float pulse = (float) (0.5f + 0.5f * Math.sin(elapsed * 10f));
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(2f));
        paint.setColor(Color.parseColor("#FFD36E"));
        paint.setAlpha((int) (220 * (1f - 0.25f * p)));
        canvas.drawCircle(targetX, targetY, dp(23) + dp(5) * pulse, paint);
        paint.setStrokeWidth(dp(1f));
        paint.setAlpha((int) (140 * (1f - p)));
        canvas.drawCircle(targetX, targetY, dp(31) + dp(9) * p, paint);

        drawIcon(canvas, targetX, targetY, 0.78f + 0.22f * ease, 255, false);
    }

    private void drawSuccess(Canvas canvas, float elapsed) {
        float fly = Math.min(1f, elapsed / 0.52f);
        float ease = 1f - (float) Math.pow(1f - fly, 3f);
        float midX = (targetX + spiritX) / 2f + dp(26);
        float midY = (targetY + spiritY) / 2f - dp(46);
        float x = quad(targetX, midX, spiritX, ease);
        float y = quad(targetY, midY, spiritY, ease);

        if (elapsed < 0.62f) {
            // 飞行拖尾。
            paint.setStyle(Paint.Style.FILL);
            for (int i = 0; i < 8; i++) {
                float u = Math.max(0f, ease - i * 0.055f);
                float px = quad(targetX, midX, spiritX, u);
                float py = quad(targetY, midY, spiritY, u);
                paint.setColor(colors[i % colors.length]);
                paint.setAlpha(Math.max(0, 170 - i * 18));
                canvas.drawCircle(px, py, dp(2.4f - i * 0.16f), paint);
            }
            drawIcon(canvas, x, y, 1f - 0.18f * ease, 255, true);
        }

        float burst = Math.max(0f, (elapsed - 0.5f) / 0.55f);
        if (burst > 0f && burst < 1.25f) {
            float bt = Math.min(1f, burst);
            paint.setStyle(Paint.Style.FILL);
            for (int i = 0; i < BIT_COUNT; i++) {
                float radius = dp(10) + dp(78) * bitSpeeds[i] * bt;
                float bx = spiritX + (float) Math.cos(bitAngles[i]) * radius;
                float by = spiritY + (float) Math.sin(bitAngles[i]) * radius + dp(12) * bt * bt;
                int alpha = (int) (255 * (1f - bt));
                if (i % 4 == 0) drawStar(canvas, bx, by, dp(2.3f + bitSpeeds[i] * 2.2f), bitColors[i], alpha);
                else {
                    paint.setColor(bitColors[i]);
                    paint.setAlpha(alpha);
                    canvas.drawCircle(bx, by, dp(1.2f + bitSpeeds[i] * 1.7f), paint);
                }
            }
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(1.8f));
            paint.setColor(Color.parseColor("#FFD36E"));
            paint.setAlpha((int) (150 * (1f - bt)));
            canvas.drawCircle(spiritX, spiritY, dp(24) + dp(56) * bt, paint);
        }
    }

    private void drawDesktopAction(Canvas canvas, float elapsed) {
        float p = Math.min(1f, elapsed / 0.85f);
        float ease = 1f - (float) Math.pow(1f - p, 3f);
        boolean swap = action.contains("swap");
        boolean folder = action.contains("folder");
        int accent = swap ? Color.parseColor("#C7A6FF")
            : (folder ? Color.parseColor("#FFD36E") : Color.parseColor("#8CE8FF"));

        // 目标格的四角定位框。
        float half = dp(26) + dp(8) * ease;
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1.4f));
        paint.setColor(accent);
        paint.setAlpha((int) (190 * (1f - 0.25f * p)));
        float gap = dp(7);
        // 左上
        canvas.drawLine(targetX - half, targetY - half, targetX - half + gap, targetY - half, paint);
        canvas.drawLine(targetX - half, targetY - half, targetX - half, targetY - half + gap, paint);
        // 右上
        canvas.drawLine(targetX + half, targetY - half, targetX + half - gap, targetY - half, paint);
        canvas.drawLine(targetX + half, targetY - half, targetX + half, targetY - half + gap, paint);
        // 左下
        canvas.drawLine(targetX - half, targetY + half, targetX - half + gap, targetY + half, paint);
        canvas.drawLine(targetX - half, targetY + half, targetX - half, targetY + half - gap, paint);
        // 右下
        canvas.drawLine(targetX + half, targetY + half, targetX + half - gap, targetY + half, paint);
        canvas.drawLine(targetX + half, targetY + half, targetX + half, targetY + half - gap, paint);

        // 两道不同速度的扩散环。
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1.6f));
        paint.setColor(accent);
        paint.setAlpha((int) (200 * (1f - p)));
        canvas.drawCircle(targetX, targetY, dp(18) + dp(30) * ease, paint);
        paint.setStrokeWidth(dp(1f));
        paint.setAlpha((int) (120 * (1f - p)));
        canvas.drawCircle(targetX, targetY, dp(28) + dp(52) * ease, paint);

        // 交换：两个虚影小圆点对向滑过；文件夹：四颗星点收拢。
        paint.setStyle(Paint.Style.FILL);
        if (swap) {
            float dx = dp(30) + dp(14) * ease;
            float dy = dp(20) + dp(9) * ease;
            paint.setColor(Color.parseColor("#C7A6FF"));
            paint.setAlpha((int) (210 * (1f - p)));
            canvas.drawCircle(targetX - dx, targetY - dy, dp(4.4f), paint);
            paint.setColor(Color.parseColor("#8CE8FF"));
            canvas.drawCircle(targetX + dx, targetY + dy, dp(4.4f), paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(1.2f));
            paint.setAlpha((int) (150 * (1f - p)));
            canvas.drawArc(new RectF(targetX - dp(42), targetY - dp(42), targetX + dp(42), targetY + dp(42)),
                -40f + 180f * ease, 120f, false, paint);
        } else if (folder) {
            for (int i = 0; i < 5; i++) {
                float a = (float) (i * Math.PI * 2 / 5 + elapsed * 1.5f);
                float radius = dp(34) * (1f - ease);
                float sx = targetX + (float) Math.cos(a) * radius;
                float sy = targetY + (float) Math.sin(a) * radius;
                paint.setColor(i % 2 == 0 ? Color.parseColor("#FFD36E") : Color.parseColor("#FFF2BF"));
                paint.setAlpha((int) (230 * (1f - p)));
                drawStar(canvas, sx, sy, dp(2.6f + 1.4f * (1f - p)), accent, (int) (230 * (1f - p)));
            }
            // 文件夹底色小方框。
            dst.set(targetX - dp(17), targetY - dp(14), targetX + dp(17), targetY + dp(14));
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(1.4f));
            paint.setColor(Color.parseColor("#FFD36E"));
            paint.setAlpha((int) (170 * (1f - p * 0.5f)));
            canvas.drawRoundRect(dst, dp(5), dp(5), paint);
            canvas.drawLine(dst.left + dp(5), dst.top + dp(7), dst.right - dp(5), dst.top + dp(7), paint);
        } else {
            // 移动：从中心向外的速度线。
            paint.setStrokeWidth(dp(1.2f));
            for (int i = 0; i < 6; i++) {
                float a = (float) (i * Math.PI / 3 + 0.2);
                float r1 = dp(18) + dp(16) * ease;
                float r2 = r1 + dp(12) * (1f - p);
                paint.setColor(Color.parseColor(i % 2 == 0 ? "#8CE8FF" : "#FFF2BF"));
                paint.setAlpha((int) (180 * (1f - p)));
                canvas.drawLine(targetX + (float) Math.cos(a) * r1, targetY + (float) Math.sin(a) * r1,
                    targetX + (float) Math.cos(a) * r2, targetY + (float) Math.sin(a) * r2, paint);
            }
        }

        // 星屑爆开。
        float burst = Math.max(0f, (elapsed - 0.22f) / 0.7f);
        if (burst > 0f && burst < 1f) {
            paint.setStyle(Paint.Style.FILL);
            for (int i = 0; i < BIT_COUNT; i++) {
                float radius = dp(7) + dp(58) * bitSpeeds[i] * burst;
                float bx = targetX + (float) Math.cos(bitAngles[i]) * radius;
                float by = targetY + (float) Math.sin(bitAngles[i]) * radius + dp(8) * burst * burst;
                paint.setColor(bitColors[i]);
                paint.setAlpha((int) (220 * (1f - burst)));
                if (i % 5 == 0) drawStar(canvas, bx, by, dp(2.2f + bitSpeeds[i] * 1.7f), bitColors[i], (int) (220 * (1f - burst)));
                else canvas.drawCircle(bx, by, dp(1.1f + bitSpeeds[i] * 1.4f), paint);
            }
        }

        // 目标下方的小标签。
        if (label.length() > 0) {
            String tag = (swap ? "交换 · " : (folder ? "文件夹 · " : "移动 · ")) + label;
            paint.setStyle(Paint.Style.FILL);
            paint.setTextSize(dp(10.5f));
            paint.setColor(Color.parseColor("#0B1021"));
            paint.setAlpha((int) (215 * (1f - Math.max(0f, (elapsed - 1.05f) / 0.3f))));
            float tw = paint.measureText(tag);
            dst.set(targetX - tw / 2 - dp(8), targetY + dp(34),
                targetX + tw / 2 + dp(8), targetY + dp(52));
            canvas.drawRoundRect(dst, dp(8), dp(8), paint);
            paint.setColor(accent);
            canvas.drawText(tag, targetX - tw / 2, targetY + dp(46), paint);
        }
    }

    private void drawFailure(Canvas canvas, float elapsed) {
        float p = Math.min(1f, elapsed / 0.7f);
        float ease = 1f - (float) Math.pow(1f - p, 3f);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(2f));
        paint.setColor(Color.parseColor("#9A9AAE"));
        paint.setAlpha((int) (180 * (1f - p)));
        canvas.drawCircle(targetX, targetY, dp(20) + dp(22) * p, paint);

        drawIcon(canvas, targetX, targetY + dp(18) * ease, 1f - 0.12f * p, (int) (210 * (1f - p)), false);

        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.parseColor("#B7B7C6"));
        paint.setAlpha((int) (200 * (1f - p)));
        float s = dp(7);
        canvas.drawLine(targetX - s, targetY - s, targetX + s, targetY + s, paint);
        canvas.drawLine(targetX + s, targetY - s, targetX - s, targetY + s, paint);
    }

    private void drawIcon(Canvas canvas, float cx, float cy, float scale, int alpha, boolean trail) {
        if (alpha <= 0) return;
        if (icon != null && !icon.isRecycled()) {
            float size = dp(44) * scale;
            dst.set(cx - size / 2f, cy - size / 2f, cx + size / 2f, cy + size / 2f);
            paint.setStyle(Paint.Style.FILL);
            paint.setAlpha(alpha);
            canvas.drawBitmap(icon, null, dst, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(1.4f));
            paint.setColor(trail ? Color.parseColor("#FFF2BF") : Color.parseColor("#FFD36E"));
            paint.setAlpha(Math.min(255, alpha));
            canvas.drawRoundRect(dst, dp(9), dp(9), paint);
            return;
        }
        float r = dp(14) * scale;
        star.reset();
        star.moveTo(cx, cy - r * 1.8f);
        star.lineTo(cx + r * 0.55f, cy - r * 0.5f);
        star.lineTo(cx + r * 1.8f, cy);
        star.lineTo(cx + r * 0.55f, cy + r * 0.5f);
        star.lineTo(cx, cy + r * 1.8f);
        star.lineTo(cx - r * 0.55f, cy + r * 0.5f);
        star.lineTo(cx - r * 1.8f, cy);
        star.lineTo(cx - r * 0.55f, cy - r * 0.5f);
        star.close();
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.parseColor("#FFD36E"));
        paint.setAlpha(alpha);
        canvas.drawPath(star, paint);
    }

    private void drawStar(Canvas canvas, float cx, float cy, float r, int color, int alpha) {
        star.reset();
        star.moveTo(cx, cy - r * 1.7f);
        star.lineTo(cx + r * 0.45f, cy - r * 0.45f);
        star.lineTo(cx + r * 1.7f, cy);
        star.lineTo(cx + r * 0.45f, cy + r * 0.45f);
        star.lineTo(cx, cy + r * 1.7f);
        star.lineTo(cx - r * 0.45f, cy + r * 0.45f);
        star.lineTo(cx - r * 1.7f, cy);
        star.lineTo(cx - r * 0.45f, cy - r * 0.45f);
        star.close();
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(color);
        paint.setAlpha(alpha);
        canvas.drawPath(star, paint);
    }

    private void makeBits() {
        bitAngles = new float[BIT_COUNT];
        bitSpeeds = new float[BIT_COUNT];
        bitColors = new int[BIT_COUNT];
        for (int i = 0; i < BIT_COUNT; i++) {
            bitAngles[i] = (float) (random.nextDouble() * Math.PI * 2);
            bitSpeeds[i] = 0.45f + random.nextFloat() * 0.95f;
            bitColors[i] = colors[random.nextInt(colors.length)];
        }
    }

    private float quad(float a, float b, float c, float t) {
        float mt = 1f - t;
        return mt * mt * a + 2f * mt * t * b + t * t * c;
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }
}
