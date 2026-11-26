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
 * 桌面精灵周围的粒子层。
 * 瑶的悬浮形态会使用紫、金、粉、青四种星辉，并出现小蝴蝶 / 四角星；
 * 其他伙伴保持金色和青色的轻盈粒子。
 */
public class ParticleView extends View {

    private static final int YAO_MAX = 15;
    private static final int DEFAULT_MAX = 9;

    private static class Particle {
        float x;
        float y;
        float vx;
        float vy;
        float size;
        float life;
        float maxLife;
        int color;
        int kind;
        float angle;
        float spin;
    }

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path shape = new Path();
    private final List<Particle> particles = new ArrayList<>();
    private final Random random = new Random();
    private final int[] yaoColors = new int[]{
        Color.parseColor("#C7A6FF"),
        Color.parseColor("#FFD36E"),
        Color.parseColor("#FF9AC4"),
        Color.parseColor("#8CE8FF")
    };
    private final int[] normalColors = new int[]{
        Color.parseColor("#FFD36E"),
        Color.parseColor("#6EE7FF"),
        Color.parseColor("#FF9AC4")
    };
    private long lastFrameAt = SystemClock.uptimeMillis();
    private boolean yao = false;
    private boolean active = false;
    private long activeUntil = 0L;

    public ParticleView(Context context) {
        super(context);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
    }

    public void setYao(boolean isYao) {
        yao = isYao;
        invalidate();
    }

    /** 打开粒子层；only-on-demand，不再让桌面常驻刷新。 */
    public void setActive(boolean on) {
        if (active == on) {
            if (!on) activeUntil = 0L;
            return;
        }
        active = on;
        activeUntil = 0L;
        if (on) {
            lastFrameAt = SystemClock.uptimeMillis();
        } else {
            particles.clear();
        }
        invalidate();
    }

    /** 短暂激活；到时间后自动停掉 postInvalidate。 */
    public void activate(long durationMs) {
        active = true;
        activeUntil = SystemClock.uptimeMillis() + Math.max(220L, durationMs);
        lastFrameAt = SystemClock.uptimeMillis();
        invalidate();
    }

    public void burst(int count) {
        activate(900L);
        float cx = getWidth() / 2f;
        float cy = getHeight() / 2f;
        for (int i = 0; i < count; i++) {
            Particle p = new Particle();
            double angle = random.nextDouble() * Math.PI * 2;
            float speed = dp(0.7f) + random.nextFloat() * dp(1.9f);
            p.x = cx + (float) Math.cos(angle) * dp(7);
            p.y = cy + (float) Math.sin(angle) * dp(7);
            p.vx = (float) Math.cos(angle) * speed;
            p.vy = (float) Math.sin(angle) * speed - dp(0.45f);
            p.size = dp(1.5f) + random.nextFloat() * dp(2.4f);
            p.maxLife = 650 + random.nextInt(650);
            p.life = p.maxLife;
            p.color = pickColor();
            p.kind = yao ? random.nextInt(4) : random.nextInt(2);
            p.angle = random.nextFloat() * 360f;
            p.spin = (random.nextFloat() - 0.5f) * (yao ? 18f : 6f);
            particles.add(p);
        }
        invalidate();
    }

    /** 拖动时在身后撒一串很轻的星屑。 */
    public void trail() {
        activate(700L);
        if (getWidth() <= 0 || getHeight() <= 0) return;
        for (int i = 0; i < 2; i++) {
            Particle p = new Particle();
            p.x = getWidth() / 2f + (random.nextFloat() - 0.5f) * dp(12);
            p.y = getHeight() * 0.72f + random.nextFloat() * dp(8);
            p.vx = (random.nextFloat() - 0.5f) * dp(0.35f);
            p.vy = -dp(0.2f) - random.nextFloat() * dp(0.5f);
            p.size = dp(1f) + random.nextFloat() * dp(1.4f);
            p.maxLife = 600 + random.nextInt(500);
            p.life = p.maxLife;
            p.color = pickColor();
            p.kind = yao ? 2 + random.nextInt(2) : 0;
            p.angle = random.nextFloat() * 360f;
            p.spin = 0f;
            particles.add(p);
        }
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        long now = SystemClock.uptimeMillis();
        float dt = Math.min(80f, now - lastFrameAt);
        lastFrameAt = now;

        if (!active) {
            return;
        }
        if (activeUntil > 0L && now > activeUntil) {
            active = false;
            activeUntil = 0L;
            particles.clear();
            return;
        }

        int ambientMax = yao ? YAO_MAX : DEFAULT_MAX;
        if (particles.size() < ambientMax && random.nextInt(3) == 0) {
            particles.add(ambient());
        }

        Iterator<Particle> it = particles.iterator();
        while (it.hasNext()) {
            Particle p = it.next();
            p.life -= dt;
            if (p.life <= 0f) {
                it.remove();
                continue;
            }
            p.x += p.vx * dt / 16f;
            p.y += p.vy * dt / 16f;
            p.vy += dp(0.018f) * dt / 16f;
            p.angle += p.spin * dt / 16f;
            float progress = 1f - p.life / p.maxLife;
            int alpha = (int) (255 * Math.min(1f, (1f - progress) * 1.4f));
            if (p.y < -dp(4)) {
                p.y = getHeight() + dp(3);
                p.x = random.nextFloat() * Math.max(1, getWidth());
            }
            drawParticle(canvas, p, Math.max(0, alpha));
        }

        if (active && isShown()) postInvalidateDelayed(45);
    }

    private Particle ambient() {
        Particle p = new Particle();
        p.x = dp(5) + random.nextFloat() * Math.max(1, getWidth() - dp(10));
        p.y = getHeight() - dp(3) + random.nextFloat() * dp(10);
        p.vx = (random.nextFloat() - 0.5f) * dp(0.3f);
        p.vy = -dp(0.28f) - random.nextFloat() * dp(0.75f);
        p.size = (yao ? dp(1.2f) : dp(1f)) + random.nextFloat() * dp(1.9f);
        p.maxLife = 1500 + random.nextInt(1200);
        p.life = p.maxLife;
        p.color = pickColor();
        p.kind = yao ? random.nextInt(4) : random.nextInt(2);
        p.angle = random.nextFloat() * 360f;
        p.spin = (random.nextFloat() - 0.5f) * (yao ? 12f : 3f);
        return p;
    }

    private int pickColor() {
        int[] colors = yao ? yaoColors : normalColors;
        return colors[random.nextInt(colors.length)];
    }

    private void drawParticle(Canvas canvas, Particle p, int alpha) {
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(p.color);
        paint.setAlpha(alpha);
        paint.setStrokeWidth(Math.max(dp(0.8f), p.size * 0.8f));

        // 外圈柔光，让粒子在深色桌面上更像星辉。
        paint.setAlpha((int) (alpha * 0.2f));
        canvas.drawCircle(p.x, p.y, p.size * 2.2f, paint);
        paint.setAlpha(alpha);

        if (p.kind == 1) {
            shape.reset();
            shape.moveTo(p.x, p.y - p.size * 1.8f);
            shape.lineTo(p.x + p.size, p.y);
            shape.lineTo(p.x, p.y + p.size * 1.8f);
            shape.lineTo(p.x - p.size, p.y);
            shape.close();
            canvas.drawPath(shape, paint);
        } else if (p.kind == 2) {
            canvas.save();
            canvas.rotate(p.angle, p.x, p.y);
            shape.reset();
            shape.moveTo(p.x, p.y - p.size * 2.3f);
            shape.lineTo(p.x + p.size * 0.65f, p.y);
            shape.lineTo(p.x, p.y + p.size * 2.3f);
            shape.lineTo(p.x - p.size * 0.65f, p.y);
            shape.close();
            canvas.drawPath(shape, paint);
            canvas.restore();
        } else if (p.kind == 3) {
            // 两只小翅膀，像一只很轻的蝴蝶。
            canvas.save();
            canvas.rotate(p.angle, p.x, p.y);
            paint.setAlpha((int) (alpha * 0.72f));
            canvas.drawCircle(p.x - p.size * 0.9f, p.y - p.size * 0.35f, p.size * 0.9f, paint);
            canvas.drawCircle(p.x + p.size * 0.9f, p.y - p.size * 0.35f, p.size * 0.9f, paint);
            paint.setAlpha(alpha);
            canvas.drawCircle(p.x, p.y, p.size * 0.45f, paint);
            canvas.restore();
        } else {
            canvas.drawCircle(p.x, p.y, p.size, paint);
        }
        paint.setAlpha(255);
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }
}
