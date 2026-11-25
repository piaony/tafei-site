package com.piaony.tafei;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;

/**
 * 桌面互动用的无障碍服务占位。
 * v87 只用于环境探测；真正长按/移除逻辑在 v88 接入，避免首次版本就动桌面。
 */
public class SpiritAccessibilityService extends AccessibilityService {
    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
    }

    @Override
    public void onInterrupt() {
    }
}
