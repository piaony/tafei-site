#!/usr/bin/env python3
"""一次性流水线：1) 拆分 index.html 内联样式/脚本 2) 四页接入 features 层。可重复执行（幂等）。"""
import re, pathlib, sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
log = []

# ---------- 1) 拆分 ----------
idx = root / "index.html"
if idx.exists():
    html = idx.read_text(encoding="utf-8")
    m = re.search(r"<style>\n(.*?)\n</style>", html, re.S)
    if m:
        (root / "css").mkdir(exist_ok=True)
        (root / "css" / "home.css").write_text(m.group(1).strip() + "\n", encoding="utf-8")
        html = html[:m.start()] + '<link rel="stylesheet" href="css/home.css">' + html[m.end():]
        log.append("已拆分内联样式 -> css/home.css")
    names = ["home-core.js", "home-views.js"]
    for i, mm in reversed(list(enumerate(re.finditer(r"<script>\n(.*?)\n</script>", html, re.S)))):
        (root / "js").mkdir(exist_ok=True)
        name = names[i] if i < len(names) else "home-extra-%d.js" % i
        (root / "js" / name).write_text(mm.group(1).strip() + "\n", encoding="utf-8")
        html = html[:mm.start()] + ('<script src="js/%s"></script>' % name) + html[mm.end():]
        log.append("已拆分内联脚本 -> js/%s" % name)
    idx.write_text(html, encoding="utf-8")

# ---------- 2) 四页接入 features ----------
CSS_TAG = '<link rel="stylesheet" href="css/tafei-features.css">'
JS_TAG = '<script src="js/tafei-features.js" defer></script>'
for page in ["index.html", "about.html", "admin.html", "shop.html"]:
    p = root / page
    if not p.exists():
        continue
    s = p.read_text(encoding="utf-8")
    if CSS_TAG not in s and "</head>" in s:
        s = s.replace("</head>", CSS_TAG + "\n</head>", 1)
        log.append(page + " 接入 features.css")
    if JS_TAG not in s and "</body>" in s:
        s = s.replace("</body>", JS_TAG + "\n</body>", 1)
        log.append(page + " 接入 features.js")
    p.write_text(s, encoding="utf-8")

print("\n".join(log) or "无改动")
