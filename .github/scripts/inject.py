#!/usr/bin/env python3
# 一次性迁移脚本：把设计层接入四个页面，并修复历史遗留问题
import pathlib
import re

LINK = '<link rel="stylesheet" href="css/tafei-ui.css">'
SCRIPT = '<script src="js/tafei-ui.js" defer></script>'

PAGES = {
    "index.html": "page-home",
    "about.html": "page-about",
    "admin.html": "page-admin",
    "shop.html": "page-shop",
}

ABOUT_SUFFIX = "\n      x: Math.random() * canvas.width,\n      y: Math.random() * canvas.height,\n      r: Math.random() * 1.4 + 0.3,\n      a: Math.random() * 0.6 + 0.2,\n      s: Math.random() * 0.25 + 0.05\n    }));\n  }\n  function draw(){\n    ctx.clearRect(0, 0, canvas.width, canvas.height);\n    stars.forEach(function(st){\n      st.y += st.s;\n      if(st.y > canvas.height){ st.y = 0; st.x = Math.random() * canvas.width; }\n      ctx.beginPath();\n      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);\n      ctx.fillStyle = 'rgba(150,200,255,' + st.a + ')' + ';\n      ctx.fill();\n    });\n    requestAnimationFrame(draw);\n  }\n  resize();\n  window.addEventListener('resize', resize);\n  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){\n    requestAnimationFrame(draw);\n  }\n}\n</script>\n\n<script src=\"js/tafei-ui.js\" defer></script>\n</body>\n</html>\n"


def inject(path: pathlib.Path, cls: str) -> bool:
    s = path.read_text(encoding="utf-8")
    orig = s

    if not s.strip():
        print("skip empty:", path)
        return False

    if "css/tafei-ui.css" not in s and "</head>" in s:
        s = s.replace("</head>", LINK + "\n</head>", 1)

    if "<body class=" not in s:
        s = re.sub(r"<body([^>]*)>", lambda m: '<body class="%s"%s>' % (cls, m.group(1)), s, count=1)

    truncated = "</html>" not in s

    if truncated:
        i = s.rfind("stars=Array.from")
        if i != -1:
            tail = "},()=>({"
            end = s.find(tail, i)
            if end != -1:
                s = s[: end + len(tail)] + ABOUT_SUFFIX
        else:
            s = s + ABOUT_SUFFIX
    else:
        if "js/tafei-ui.js" not in s:
            i = s.rfind("</body>")
            if i != -1:
                s = s[:i] + SCRIPT + "\n" + s[i:]

    if path.name == "index.html":
        s = s.replace("\n\\n\n", "\n", 1)
        s = s.replace(
            "\u6b22\u8fce\u6765\u5230\u631e\u98de\u5b9e\u9a8c\u5ba4\uff01\\n\u8f93\u5165 help \u67e5\u770b\u53ef\u7528\u547d\u4ee4\u3002\\n",
            "\u6b22\u8fce\u6765\u5230\u631e\u98de\u5b9e\u9a8c\u5ba4\uff01\n\u8f93\u5165 help \u67e5\u770b\u53ef\u7528\u547d\u4ee4\u3002\n",
        )
    if path.name == "shop.html":
        s = s.replace('</div>\\n<section class="panel"', '</div>\n<section class="panel"')

    if s != orig:
        path.write_text(s, encoding="utf-8")
        print(("updated+repaired: " if truncated else "updated: ") + path.name)
        return True

    print("no change:", path.name)
    return False


def main():
    changed = False
    for name, cls in PAGES.items():
        p = pathlib.Path(name)
        if p.exists():
            changed = inject(p, cls) or changed
    print("done, changed =", changed)


if __name__ == "__main__":
    main()
