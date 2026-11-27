package com.piaony.thermal;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Locale;

public class MainActivity extends Activity {

    private static final String EXTRA_AUTO_MODE = "auto_mode";
    private static final int REQ_OVERLAY = 1001;
    private static final int REQ_NOTIFICATION = 1002;

    private ThermalController controller;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable refreshTask;
    private String selectedMode = ThermalController.MODE_DEFAULT;
    private String pendingAutoMode;

    private TextView tvRoot;
    private TextView tvModeStatus;
    private TextView tvCpu;
    private TextView tvGpu;
    private TextView tvShell;
    private TextView tvApplyInfo;
    private TextView tvModeHint;
    private TextView modeDefault;
    private TextView modeGame;
    private TextView modeExtreme;
    private TextView btnApply;
    private TextView btnOverlay;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        controller = new ThermalController(this);

        tvRoot = findViewById(R.id.tvRoot);
        tvModeStatus = findViewById(R.id.tvModeStatus);
        tvCpu = findViewById(R.id.tvCpu);
        tvGpu = findViewById(R.id.tvGpu);
        tvShell = findViewById(R.id.tvShell);
        tvApplyInfo = findViewById(R.id.tvApplyInfo);
        tvModeHint = findViewById(R.id.tvModeHint);
        modeDefault = findViewById(R.id.modeDefault);
        modeGame = findViewById(R.id.modeGame);
        modeExtreme = findViewById(R.id.modeExtreme);
        btnApply = findViewById(R.id.btnApply);
        btnOverlay = findViewById(R.id.btnOverlay);

        String stored = controller.getSelectedMode();
        if (ThermalController.MODE_GAME.equals(stored) || ThermalController.MODE_EXTREME.equals(stored)) {
            selectedMode = stored;
        } else {
            selectedMode = ThermalController.MODE_DEFAULT;
        }

        modeDefault.setOnClickListener(v -> selectMode(ThermalController.MODE_DEFAULT));
        modeGame.setOnClickListener(v -> selectMode(ThermalController.MODE_GAME));
        modeExtreme.setOnClickListener(v -> selectMode(ThermalController.MODE_EXTREME));
        btnApply.setOnClickListener(v -> requestApply());
        findViewById(R.id.btnPinGame).setOnClickListener(v -> pinShortcut(ThermalController.MODE_GAME, "游戏温控"));
        findViewById(R.id.btnPinDefault).setOnClickListener(v -> pinShortcut(ThermalController.MODE_DEFAULT, "默认温控"));
        btnOverlay.setOnClickListener(v -> openOverlay());
        findViewById(R.id.btnOverlayStop).setOnClickListener(v -> stopOverlay());

        pendingAutoMode = getIntent() == null ? null : getIntent().getStringExtra(EXTRA_AUTO_MODE);
        if (pendingAutoMode != null) {
            selectedMode = pendingAutoMode;
        }
        updateModeUi();
        updateOverlayButton();
        refreshTemps();
        checkRoot();
        startRefreshLoop();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.getStringExtra(EXTRA_AUTO_MODE) != null) {
            pendingAutoMode = intent.getStringExtra(EXTRA_AUTO_MODE);
            selectedMode = pendingAutoMode;
            updateModeUi();
            maybeAutoApply();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateOverlayButton();
        refreshTemps();
    }

    @Override
    protected void onDestroy() {
        if (refreshTask != null) handler.removeCallbacks(refreshTask);
        super.onDestroy();
    }

    private void selectMode(String mode) {
        selectedMode = mode;
        updateModeUi();
    }

    private void updateModeUi() {
        modeDefault.setBackgroundResource(
                ThermalController.MODE_DEFAULT.equals(selectedMode) ? R.drawable.bg_mode_active : R.drawable.bg_mode);
        modeGame.setBackgroundResource(
                ThermalController.MODE_GAME.equals(selectedMode) ? R.drawable.bg_mode_active : R.drawable.bg_mode);
        modeExtreme.setBackgroundResource(
                ThermalController.MODE_EXTREME.equals(selectedMode) ? R.drawable.bg_mode_active : R.drawable.bg_mode);

        String label;
        String hint;
        if (ThermalController.MODE_GAME.equals(selectedMode)) {
            label = "游戏";
            hint = "95℃ 被动降频阈值；建议搭配散热背夹使用。";
        } else if (ThermalController.MODE_EXTREME.equals(selectedMode)) {
            label = "极致";
            hint = "100℃ 被动降频阈值；仅限散热背夹短时使用，禁止边充边玩。";
        } else {
            label = "默认";
            hint = "恢复首次运行前的被动阈值与框架属性。";
        }
        tvModeStatus.setText("当前选择：" + label + " · 重启后自动恢复默认");
        tvModeHint.setText(hint);
    }

    private void checkRoot() {
        tvRoot.setText("正在检查 Root…");
        tvRoot.setTextColor(getColor(R.color.warning));
        new Thread(() -> {
            boolean root = controller.hasRoot();
            runOnUiThread(() -> {
                if (root) {
                    tvRoot.setText("Root 已授权");
                    tvRoot.setTextColor(getColor(R.color.accent));
                    tvApplyInfo.setText(controller.describeCurrentSetup()
                            + (controller.hasTripBackup() ? " · 已备份原始阈值" : ""));
                    maybeAutoApply();
                } else {
                    tvRoot.setText("未获得 Root 权限");
                    tvRoot.setTextColor(getColor(R.color.danger));
                    tvApplyInfo.setText("温控修改需要 Root；温度显示和悬浮窗仍可使用。");
                }
            });
        }).start();
    }

    private void maybeAutoApply() {
        if (pendingAutoMode == null) return;
        String mode = pendingAutoMode;
        pendingAutoMode = null;
        if (!ThermalController.MODE_GAME.equals(mode) && !ThermalController.MODE_DEFAULT.equals(mode)) return;
        applyMode(mode, false);
    }

    private void requestApply() {
        if (ThermalController.MODE_EXTREME.equals(selectedMode)) {
            new AlertDialog.Builder(this)
                    .setTitle("开启极致模式？")
                    .setMessage("极致模式会把部分被动降频阈值上调到 100℃。\n\n"
                            + "必须搭配散热背夹，绝对禁止边充电边玩游戏。\n"
                            + "系统 critical / hot 高温保护不会被修改，重启手机后全部恢复。")
                    .setNegativeButton("取消", null)
                    .setPositiveButton("仍然应用", (d, w) -> applyMode(selectedMode, true))
                    .show();
        } else {
            applyMode(selectedMode, true);
        }
    }

    private void applyMode(String mode, boolean showToast) {
        tvApplyInfo.setText("正在应用…");
        btnApply.setAlpha(0.6f);
        new Thread(() -> {
            ThermalController.ApplyResult result = controller.applyMode(mode);
            runOnUiThread(() -> {
                btnApply.setAlpha(1f);
                String label = modeLabel(mode);
                if (result.failed == 0) {
                    tvApplyInfo.setText("已应用" + label + "：调整 " + result.changed
                            + " 项，跳过 " + result.skipped + " 项"
                            + (result.propsOk ? "" : "；框架属性写入失败")
                            + "。重启后自动恢复。");
                } else {
                    tvApplyInfo.setText("部分完成：成功 " + result.changed + " 项，失败 "
                            + result.failed + " 项。请确认 Root 授权和 sysfs 权限。");
                }
                if (showToast) {
                    Toast.makeText(MainActivity.this,
                            "已应用" + label + "温控", Toast.LENGTH_SHORT).show();
                }
            });
        }).start();
    }

    private String modeLabel(String mode) {
        if (ThermalController.MODE_GAME.equals(mode)) return "游戏";
        if (ThermalController.MODE_EXTREME.equals(mode)) return "极致";
        return "默认";
    }

    private void startRefreshLoop() {
        refreshTask = new Runnable() {
            @Override
            public void run() {
                refreshTemps();
                handler.postDelayed(this, 2000L);
            }
        };
        handler.post(refreshTask);
    }

    private void refreshTemps() {
        ThermalController.Snapshot snapshot = controller.snapshot();
        tvCpu.setText(formatTemp(snapshot.cpu));
        tvGpu.setText(formatTemp(snapshot.gpu));
        tvShell.setText(formatTemp(snapshot.shell));
    }

    private String formatTemp(Double value) {
        if (value == null || value <= 0) return "--°";
        return String.format(Locale.US, "%.1f°", value);
    }

    private void pinShortcut(String mode, String label) {
        ShortcutManager manager = getSystemService(ShortcutManager.class);
        if (manager == null) {
            Toast.makeText(this, "当前系统不支持桌面快捷方式", Toast.LENGTH_SHORT).show();
            return;
        }
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.putExtra(EXTRA_AUTO_MODE, mode);
        ShortcutInfo info = new ShortcutInfo.Builder(this, "thermal_" + mode)
                .setShortLabel(label)
                .setLongLabel(label)
                .setIcon(Icon.createWithResource(this, R.drawable.ic_launcher))
                .setIntent(intent)
                .build();
        try {
            manager.requestPinShortcut(info, null);
            Toast.makeText(this, "已请求添加到桌面，请在系统弹窗中确认", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "添加快捷方式失败：" + e.getClass().getSimpleName(), Toast.LENGTH_SHORT).show();
        }
    }

    private void openOverlay() {
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "请先允许「显示在其他应用上层」", Toast.LENGTH_LONG).show();
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));
            startActivityForResult(intent, REQ_OVERLAY);
            return;
        }
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATION);
        }
        Intent intent = new Intent(this, TempOverlayService.class);
        intent.setAction(TempOverlayService.ACTION_START);
        if (Build.VERSION.SDK_INT >= 26) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
        btnOverlay.postDelayed(this::updateOverlayButton, 300);
    }

    private void stopOverlay() {
        Intent intent = new Intent(this, TempOverlayService.class);
        intent.setAction(TempOverlayService.ACTION_STOP);
        startService(intent);
        btnOverlay.postDelayed(this::updateOverlayButton, 300);
    }

    private void updateOverlayButton() {
        btnOverlay.setText(TempOverlayService.isRunning()
                ? "悬浮温度窗运行中 · 点击重开"
                : "开启悬浮温度窗");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_OVERLAY) {
            if (Settings.canDrawOverlays(this)) {
                Toast.makeText(this, "权限已开启，再点一次「开启悬浮温度窗」", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIFICATION) {
            if (grantResults.length > 0 && grantResults[0] != PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "通知权限未开启；悬浮窗仍可运行，但通知栏可能不显示", Toast.LENGTH_LONG).show();
            }
        }
    }
}
