package com.piaony.tafei;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;

/**
 * 一张横向行走图集只上传一次纹理，播放时只改源矩形。
 * 这样不会再为了切一帧反复 setImageBitmap、触发 ImageView 重新布局。
 */
public final class WalkFrameDrawable extends Drawable {

    private final Bitmap atlas;
    private final int frameWidth;
    private final int frameHeight;
    private final int frameCount;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG | Paint.DITHER_FLAG);
    private final Rect src = new Rect();
    private int frame = 0;

    public WalkFrameDrawable(Bitmap atlas, int frameWidth) {
        this.atlas = atlas;
        this.frameWidth = Math.max(1, frameWidth);
        this.frameHeight = atlas == null ? 1 : atlas.getHeight();
        this.frameCount = atlas == null ? 0 : Math.max(1, atlas.getWidth() / this.frameWidth);
    }

    public int getFrameCount() {
        return frameCount;
    }

    public int getFrame() {
        return frame;
    }

    public void setFrame(int index) {
        if (frameCount <= 1) {
            if (!src.isEmpty()) return;
            frame = 0;
            invalidateSelf();
            return;
        }
        int next = index % frameCount;
        if (next < 0) next += frameCount;
        if (next == frame) return;
        frame = next;
        invalidateSelf();
    }

    @Override
    public void draw(Canvas canvas) {
        if (atlas == null || frameCount <= 0 || atlas.isRecycled()) return;
        Rect bounds = getBounds();
        if (bounds.isEmpty()) return;
        int left = frame * frameWidth;
        src.set(left, 0, left + frameWidth, frameHeight);
        canvas.drawBitmap(atlas, src, bounds, paint);
    }

    @Override
    public void setAlpha(int alpha) {
        paint.setAlpha(alpha);
        invalidateSelf();
    }

    @Override
    public void setColorFilter(ColorFilter colorFilter) {
        paint.setColorFilter(colorFilter);
        invalidateSelf();
    }

    @Override
    public int getOpacity() {
        return PixelFormat.TRANSLUCENT;
    }

    @Override
    public int getIntrinsicWidth() {
        return frameWidth;
    }

    @Override
    public int getIntrinsicHeight() {
        return frameHeight;
    }
}
