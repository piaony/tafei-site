#!/usr/bin/env python3
"""把 partials/info-center.html 注入 index.html 的 #info，并接入 inbox 样式与脚本。幂等。"""
import re, pathlib, sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
log = []

partial = (root / "partials" / "info-center.html").read_text(encoding="utf-8").rstrip("\n") + "\n"
idx = root / "index.html"
s = idx.read_text(encoding="utf-8")

if 'id="tf3Inbox"' not in s:
    s2, n = re.subn(r'<section id="info"[\s\S]*?</section>', lambda m: partial, s, count=1)
    if n != 1:
        raise SystemExit("未找到 #info 区块")
    s = s2
    log.append("已替换 #info 为信息中心")

CSS_TAG = '<link rel="stylesheet" href="css/tafei-inbox.css">'
JS_TAG = '<script src="js/tafei-inbox.js" defer></script>'
if CSS_TAG not in s:
    s = s.replace("</head>", CSS_TAG + "\n</head>", 1)
    log.append("接入 inbox.css")
if JS_TAG not in s:
    s = s.replace("</body>", JS_TAG + "\n</body>", 1)
    log.append("接入 inbox.js")

idx.write_text(s, encoding="utf-8")
print("\n".join(log) or "无改动")
