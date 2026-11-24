# App 更新检查说明

数据源：仓库根目录 `version.json`（main 分支）

- `code`：最新 versionCode（等于构建号 run_number）
- `name`：版本名，如 `1.0.16`
- `notes`：更新说明，会显示在弹窗里
- `url`：下载地址（固定为 releases/latest/download/app-release.apk）

拉取顺序（App 内）：

1. `raw.githubusercontent.com/.../main/version.json`（无 CDN 缓存）
2. `piaony.github.io/tafei-site/version.json`（Pages）
3. `api.github.com/.../releases/latest`（靶底，受匿名限流影响）

发新包后记得把 `version.json` 的 `code` / `name` / `notes` 改成新版本，否则老用户收不到提醒。
