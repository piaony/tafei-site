/* TAFEI UI LAYER · 交互增强 · TAFEI 20.0
   用法：在所有页面的 </body> 之前引入
   <script src="js/tafei-ui.js" defer></script>
   说明：只做渐进增强，不影响原有脚本（导航、主题、公告等）。
*/
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var THEME_KEY = "tafei-theme";

  /* ---------- 1. 顶部滚动进度条 ---------- */
  function initProgress() {
    var header = document.querySelector("header");
    if (!header) return;

    if (getComputedStyle(header).position === "static") {
      header.style.position = "relative";
    }

    var bar = document.createElement("div");
    bar.className = "tf-progress";
    bar.setAttribute("aria-hidden", "true");
    header.appendChild(bar);

    var raf = null;

    function render() {
      raf = null;
      var doc = document.documentElement;
      var scrollTop = window.pageYOffset || doc.scrollTop;
      var max = doc.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(100, (scrollTop / max) * 100) : 0;

      bar.style.width = pct.toFixed(2) + "%";
      header.classList.toggle("is-scrolled", scrollTop > 8);
    }

    function onScroll() {
      if (raf === null) raf = window.requestAnimationFrame(render);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    render();
  }

  /* ---------- 2. 入场动效：同级元素错峰 ---------- */
  function initRevealStagger() {
    if (reduceMotion) return;

    var reveals = document.querySelectorAll(".reveal");
    if (!reveals.length) return;

    reveals.forEach(function (el) {
      var siblings = el.parentElement
        ? Array.prototype.filter.call(el.parentElement.children, function (node) {
            return node.classList && node.classList.contains("reveal");
          })
        : [];

      var index = siblings.indexOf(el);
      if (index < 0) index = 0;

      var delay = Math.min(index, 4) * 70 + 60;
      el.style.setProperty("--tf-delay", delay + "ms");
    });
  }

  /* ---------- 3. 回到顶部 ---------- */
  function initBackTop() {
    var btn = document.createElement("button");
    btn.className = "tf-backtop";
    btn.type = "button";
    btn.setAttribute("aria-label", "回到顶部");
    btn.innerHTML = "&#8593;";
    document.body.appendChild(btn);

    var raf = null;

    function render() {
      raf = null;
      var y = window.pageYOffset || document.documentElement.scrollTop;
      btn.classList.toggle("show", y > 600);
    }

    window.addEventListener(
      "scroll",
      function () {
        if (raf === null) raf = window.requestAnimationFrame(render);
      },
      { passive: true }
    );

    btn.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: reduceMotion ? "auto" : "smooth"
      });
    });

    render();
  }

  /* ---------- 4. 主题：未手动选择时跟随系统 ---------- */
  function initAutoTheme() {
    // 只有带主题切换按钮的页面才跟随系统，避免独立页面出现半浅色状态
    if (!document.getElementById("themeBtn")) return;

    var mq = window.matchMedia("(prefers-color-scheme: light)");

    function apply() {
      if (localStorage.getItem(THEME_KEY)) return;
      document.body.classList.toggle("light", mq.matches);
    }

    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(apply);
    }
  }

  /* ---------- 5. 主题图标语义同步 ---------- */
  function initThemeIcon() {
    var btn = document.getElementById("themeBtn");
    if (!btn) return;

    function sync() {
      var isLight = document.body.classList.contains("light");
      btn.textContent = isLight ? "\u263E" : "\u2600";
      btn.setAttribute("aria-label", isLight ? "切换到深色主题" : "切换到浅色主题");
      btn.setAttribute("aria-pressed", isLight ? "true" : "false");
      btn.setAttribute("title", isLight ? "当前浅色 · 点击切换深色" : "当前深色 · 点击切换浅色");
    }

    sync();

    new MutationObserver(sync).observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  /* ---------- 6. 浏览器地址栏颜色同步 ---------- */
  function initThemeColorSync() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;

    function sync() {
      var isLight = document.body.classList.contains("light");
      meta.setAttribute("content", isLight ? "#eef4ff" : "#080d1b");
    }

    sync();

    new MutationObserver(sync).observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  /* ---------- 7. 点击锚点后关闭移动端菜单 ---------- */
  function initMenuAutoClose() {
    var nav = document.querySelector(".navlinks");
    if (!nav) return;

    nav.addEventListener("click", function (event) {
      if (!event.target.closest("a")) return;
      if (window.innerWidth > 760) return;
      nav.classList.remove("open");
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    initProgress();
    initRevealStagger();
    initBackTop();
    initAutoTheme();
    initThemeIcon();
    initThemeColorSync();
    initMenuAutoClose();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
