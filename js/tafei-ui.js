/* TAFEI UI LAYER · 交互增强 · TAFEI 20.0
   用法：在所有页面的 </body> 之前引入
   <script src="js/tafei-ui.js" defer></script>
   说明：只做渐进增强，不影响原有脚本（导航、主题、公告等）。
*/
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    btn.innerHTML = "\u2191";
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

  /* ---------- 4. 主题切换时同步浏览器地址栏颜色 ---------- */
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

  /* ---------- 5. 点击锚点后关闭移动端菜单 ---------- */
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
    initThemeColorSync();
    initMenuAutoClose();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
