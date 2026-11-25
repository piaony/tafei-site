package com.piaony.tafei;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.SystemClock;
import android.view.View;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Random;

/**
 * 桌面涂鸦层：精灵偶尔会在自己旁边画一颗小星星 / 爱心 / 螺旋线，
 * 画完停留几秒后淡出。整层是全屏透明、不可触摸的，不会挡住桌面操作。
 */
public class DoodleView extends View {

    private static class Doodle {
        Path path;
        Path brush;
        float x;
        float y;
        long startedAt;
        long duration;
        int color;
        int kind;
    }

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path scratch = new Path();
    private final List<Doodle> doodles = new ArrayList<>();
    private final Random random = new Random();
    private boolean yao = false;

    public DoodleView(Context context) {
        super(context);
    }

    public void setYao(boolean isYao) {
        yao = isYao;
    }

    public void doodle(float x, float y) {
        Doodle d = new Doodle();
        d.x = x;
        d.y = y;
        d.duration = 3800 + random.nextInt(1300);
        d.startedAt = SystemClock.uptimeMillis();
        d.kind = random.nextInt(yao ? 3 : 2);
        d.color = yao
            ? (random.nextBoolean() ? Color.parseColor("#C7A6FF") : Color.parseColor("#FFD36E"))
            : (random.nextBoolean() ? Color.parseColor("#FFD36E") : Color.parseColor("#8CE8FF"));
        d.path = makeShape(d.kind, dp(8 + random.nextInt(5)));
        d.brush = makeBrush(dp(28 + random.nextInt(20)));
        doodles.add(d);
        if (doodles.size() > 3) doodles.remove(0);
        invalidate();
    }

    public void clear() {
        doodles.clear();
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        long now = SystemClock.uptimeMillis();
        Iterator<Doodle> it = doodles.iterator();
        while (it.hasNext()) {
            Doodle d = it.next();
            float progress = (now - d.startedAt) / (float) d.duration;
            if (progress >= 1f) {
                it.remove();
                continue;
            }
            float appear = Math.min(1f, progress * 4f);
            float fade = progress < 0.7f ? 1f : (1f - progress) / 0.3f;
            int alpha = (int) (255 * Math.max(0f, fade) * 0.8f);
            float scale = 0.45f + Math.min(1f, appear) * 0.55f;
            canvas.save();
            canvas.translate(d.x, d.y);
            canvas.scale(scale, scale);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(1.4f));
            paint.setColor(d.color);
            paint.setAlpha((int) (alpha * 0.35f));
            canvas.drawPath(d.brush, paint);
            paint.setStyle(Paint.Style.FILL);
            paint.setAlpha(alpha);
            canvas.drawPath(d.path, paint);
            canvas.restore();
        }
        if (!doodles.isEmpty() && isShown()) postInvalidateDelayed(30);
    }

    private Path makeShape(int kind, float r) {
        Path path = new Path();
        if (kind == 0) {
            // 四角星
            path.moveTo(0, -r * 1.8f);
            path.lineTo(r * 0.5f, -r * 0.45f);
            path.lineTo(r * 1.8f, 0);
            path.lineTo(r * 0.5f, r * 0.45f);
            path.lineTo(0, r * 1.8f);
            path.lineTo(-r * 0.5f, r * 0.45f);
            path.lineTo(-r * 1.8f, 0);
            path.lineTo(-r * 0.5f, -r * 0.45f);
            path.close();
        } else if (kind == 1) {
            // 爱心
            path.moveTo(0, r * 1.4f);
            path.cubicTo(-r * 2.2f, r * 0.1f, -r * 1.2f, -r * 1.6f, 0, -r * 0.65f);
            path.cubicTo(r * 1.2f, -r * 1.6f, r * 2.2f, r * 0.1f, 0, r * 1.4f);
            path.close();
        } else {
            // 瑶的蝴蝶结 / 双翼
            path.moveTo(0, 0);
            path.cubicTo(-r * 2.1f, -r * 1.6f, -r * 2.3f, r * 1.2f, 0, r * 0.25f);
            path.cubicTo(r * 2.3f, r * 1.2f, r * 2.1f, -r * 1.6f, 0, 0);
            path.close();
            Path loop = new Path();
            loop.addCircle(0, 0, r * 0.28f, Path.Direction.CW);
            path.addPath(loop);
        }
        return path;
    }

    private Path makeBrush(float r) {
        scratch.reset();
        scratch.moveTo(-r, r * 0.8f);
        scratch.quadTo(-r * 0.2f, -r * 0.9f, r, -r * 0.1f);
        return new Path(scratch);
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }
}
