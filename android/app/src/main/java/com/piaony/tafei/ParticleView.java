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

/** 桌面精灵周围的金色 / 青色粒子，以及触摸时的爆发特效。 */
public class ParticleView extends View {

    private static final int AMBIENT_MAX = 9;

    private static class Particle {
        float x;
        float y;
        float vx;
        float vy;
        float size;
        float life;
        float maxLife;
        int color;
        boolean diamond;
    }

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path diamond = new Path();
    private final List<Particle> particles = new ArrayList<>();
    private final Random random = new Random();
    private long lastFrameAt = SystemClock.uptimeMillis();

    public ParticleView(Context context) {
        super(context);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
    }

    public void burst(int count) {
        float cx = getWidth() / 2f;
        float cy = getHeight() / 2f;
        for (int i = 0; i < count; i++) {
            Particle p = new Particle();
            double angle = random.nextDouble() * Math.PI * 2;
            float speed = dp(0.8f) + random.nextFloat() * dp(1.8f);
            p.x = cx + (float) Math.cos(angle) * dp(8);
            p.y = cy + (float) Math.sin(angle) * dp(8);
            p.vx = (float) Math.cos(angle) * speed;
            p.vy = (float) Math.sin(angle) * speed - dp(0.5f);
            p.size = dp(1.6f) + random.nextFloat() * dp(2.2f);
            p.maxLife = 700 + random.nextInt(500);
            p.life = p.maxLife;
            p.color = random.nextInt(3) == 0 ? Color.parseColor("#FF9AC4")
                : (random.nextInt(2) == 0 ? Color.parseColor("#FFD36E") : Color.parseColor("#6EE7FF"));
            p.diamond = random.nextBoolean();
            particles.add(p);
        }
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        long now = SystemClock.uptimeMillis();
        float dt = Math.min(80f, now - lastFrameAt);
        lastFrameAt = now;

        if (particles.size() < AMBIENT_MAX && random.nextInt(3) == 0) {
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
            p.vy += dp(0.025f) * dt / 16f;
            float progress = 1f - p.life / p.maxLife;
            int alpha = (int) (255 * Math.min(1f, (1f - progress) * 1.35f));
            if (p.y < -dp(4)) {
                p.y = getHeight() + dp(3);
                p.x = random.nextFloat() * Math.max(1, getWidth());
            }
            drawParticle(canvas, p, Math.max(0, alpha));
        }

        if (isShown()) postInvalidateDelayed(45);
    }

    private Particle ambient() {
        Particle p = new Particle();
        p.x = dp(5) + random.nextFloat() * Math.max(1, getWidth() - dp(10));
        p.y = getHeight() - dp(3) + random.nextFloat() * dp(10);
        p.vx = (random.nextFloat() - 0.5f) * dp(0.28f);
        p.vy = -dp(0.35f) - random.nextFloat() * dp(0.75f);
        p.size = dp(1.2f) + random.nextFloat() * dp(1.8f);
        p.maxLife = 1500 + random.nextInt(1200);
        p.life = p.maxLife;
        p.color = random.nextInt(3) == 0 ? Color.parseColor("#6EE7FF") : Color.parseColor("#FFD36E");
        p.diamond = random.nextInt(4) == 0;
        return p;
    }

    private void drawParticle(Canvas canvas, Particle p, int alpha) {
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(p.color);
        paint.setAlpha(alpha);
        if (p.diamond) {
            diamond.reset();
            diamond.moveTo(p.x, p.y - p.size * 1.8f);
            diamond.lineTo(p.x + p.size, p.y);
            diamond.lineTo(p.x, p.y + p.size * 1.8f);
            diamond.lineTo(p.x - p.size, p.y);
            diamond.close();
            canvas.drawPath(diamond, paint);
        } else {
            canvas.drawCircle(p.x, p.y, p.size, paint);
        }
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }
}
