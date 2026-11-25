/* TAFEI APP SHELL · 手机 App 专用外壳（v3）
   1) 统一底部导航：首页 / 社区 / 精灵 / 工具 / 我的（5 项，全站一致）
   2) 默认跟随系统主题（用户手动选过则尊重其选择）
   3) 返回键协同：先关弹层，再退回上一页，最后双击退出（在 App 内由原生调用）
   4) 图片懒加载 + 挂件长按菜单自动注入 */
(function () {
  'use strict';
  if (window.__tafeiShell) return;
  window.__tafeiShell = true;

  var html = document.documentElement;
  html.classList.add('in-app');

  /* —— 主题：默认跟随系统（用户手动选过则尊重其选择） —— */
  var wantLight = false;
  try {
    var saved = localStorage.getItem('tafei-theme');
    var sysLight = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    wantLight = (saved === 'light') || (!saved && sysLight);
    html.style.colorScheme = wantLight ? 'light' : 'dark';
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (ev) {
        try {
          if (localStorage.getItem('tafei-theme')) return;
          document.body.classList.toggle('light', !!ev.matches);
          html.style.colorScheme = ev.matches ? 'light' : 'dark';
        } catch (e2) {}
      });
    }
  } catch (e) {}

  var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase() || 'index.html';
  var isIndex = file === 'index.html';

  /* —— 图标 —— */
  var GRAD = '<defs><linearGradient id="tfAppGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">'
    + '<stop offset="0" stop-color="#64e8ff"/><stop offset=".55" stop-color="#7297ff"/><stop offset="1" stop-color="#bd8cff"/>'
    + '</linearGradient></defs>';

  function symbol(id, path) {
    return '<symbol id="' + id + '" viewBox="0 0 24 24" fill="none" stroke="url(#tfAppGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + path + '</symbol>';
  }

  var SPRITE = '<svg class="tf-app-sprite" aria-hidden="true" width="0" height="0" style="position:absolute;overflow:hidden">'
    + GRAD
    + symbol('app-home', '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>')
    + symbol('app-community', '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h5A2.5 2.5 0 0 1 14 6.5v3A2.5 2.5 0 0 1 11.5 12H9l-5 4v-4A2.5 2.5 0 0 1 4 9.5z"/><path d="M14 9.5h3.5A2.5 2.5 0 0 1 20 12v3.5A2.5 2.5 0 0 1 17.5 18H16v3l-3.5-3H15"/>')
    + symbol('app-spirit', '<path d="M12 3.5l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7L4.2 8.5l4.7-.7z"/>')
    + symbol('app-tools', '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><path d="M17 13.5v7M13.5 17h7"/>')
    + symbol('app-my', '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-3.6 3.4-5.8 7.5-5.8s7.5 2.2 7.5 5.8"/>')
    + '</svg>';

  var TABS = [
    { key: 'home', label: '首页', icon: 'app-home', href: 'index.html' },
    { key: 'community', label: '社区', icon: 'app-community', href: 'index.html#community' },
    { key: 'spirit', label: '精灵', icon: 'app-spirit', href: 'jingling.html' },
    { key: 'tools', label: '工具', icon: 'app-tools', href: 'app-more.html' },
    { key: 'my', label: '我的', icon: 'app-my', href: 'my.html' }
  ];

  function activeKey() {
    if (/admin/.test(file)) return '';
    var hash = (location.hash || '').replace('#', '').toLowerCase();
    if (isIndex) {
      if (hash === 'community' || hash === 'info' || hash === 'profile') return 'community';
      if (hash === 'shop') return 'tools';
      return 'home';
    }
    if (file === 'my.html') return 'my';
    if (file === 'app-more.html') return 'tools';
    if (file === 'device.html' || file === 'search.html' || file === 'fix.html' || file === 'service.html' || file === 'shop.html') return 'tools';
    if (file === 'jingling.html' || file === 'angela.html' || file === 'xiaota.html' || file === 'naiwa.html') return 'spirit';
    if (file === 'about.html') return 'my';
    return 'tools'; /* 其余内页统一高亮「工具」 */
  }

  var navEl = null;

  function buildNav() {
    var nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', '手机底部导航');
    var act = activeKey();
    nav.innerHTML = TABS.map(function (t) {
      return '<a href="' + t.href + '" data-key="' + t.key + '"' + (t.key === act ? ' class="active" aria-current="page"' : '') + '>'
        + '<svg class="tf-ico" aria-hidden="true"><use href="#' + t.icon + '"></use></svg>'
        + '<span>' + t.label + '</span></a>';
    }).join('');
    return nav;
  }

  function refreshActive() {
    if (!navEl) return;
    var act = activeKey();
    var links = navEl.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      var on = links[i].getAttribute('data-key') === act;
      links[i].classList.toggle('active', on);
      if (on) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }


  /* —— 图片懒加载：全站图片滚到可视区再请求 —— */
  function lazyImages(scope) {
    var imgs = (scope || document).querySelectorAll('img:not([data-tf-lazy])');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.closest && img.closest('.spirit-widget,#spiritWidget')) continue;
      img.setAttribute('data-tf-lazy', '1');
      try {
        if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
        if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
      } catch (e) {}
    }
  }

  function mountNav() {
    if (!document.body) return;
    document.body.classList.toggle('light', wantLight);
    if (!document.querySelector('.tf-app-sprite')) {
      document.body.insertAdjacentHTML('afterbegin', SPRITE);
    }
    lazyImages(document);
    if (window.MutationObserver) {
      new MutationObserver(function () { lazyImages(document); })
        .observe(document.body, { childList: true, subtree: true });
    }

    var old = document.querySelector('.mobile-bottom-nav');
    navEl = buildNav();
    if (old && old.parentNode) old.parentNode.replaceChild(navEl, old);
    else document.body.appendChild(navEl);

    /* 点当前 Tab：回顶部，不重复跳转 */
    navEl.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a || !a.classList.contains('active')) return;
      var want = a.getAttribute('href');
      var here = (location.pathname.split('/').pop() || 'index.html') + (location.hash || '');
      if (want === here || (want === 'index.html' && isIndex && !location.hash)) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  if (document.body) mountNav();
  else document.addEventListener('DOMContentLoaded', mountNav, { once: true });

  window.addEventListener('hashchange', function () {
    refreshActive();
  });

  /* —— 返回键协同：由 MainActivity 调用，返回 '1' 表示已消费 —— */
  var OPEN_CLASSES = ['spirit-modal-open', 'spirit-memorial-open', 'pet-panel-open'];
  var CLOSERS = ['spiritModalClose', 'memorialClose', 'memorialCloseBottom', 'petPanelClose'];

  function anyOpen() {
    var body = document.body;
    if (!body) return false;
    for (var i = 0; i < OPEN_CLASSES.length; i++) {
      if (body.classList.contains(OPEN_CLASSES[i])) return true;
    }
    return false;
  }

  function clickFirstCloser() {
    for (var i = 0; i < CLOSERS.length; i++) {
      var el = document.getElementById(CLOSERS[i]);
      if (!el) continue;
      if (el.getClientRects().length === 0) continue;
      el.click();
      if (!anyOpen()) return true;
    }
    return false;
  }

  function closeOverlay() {
    if (!anyOpen()) return false;
    try {
      var esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
      document.dispatchEvent(esc);
      window.dispatchEvent(esc);
    } catch (e) {}
    if (!anyOpen()) return true;
    if (clickFirstCloser()) return true;
    return true; /* 弹层存在时至少消费一次返回，避免直接退出 */
  }

  window.__tafeiBack = function () {
    try {
      if (closeOverlay()) return '1';
    } catch (e) {}
    return 'pass';
  };

  /* —— 载入挂件长按菜单（脚本自带等待，没有挂件的页面不会做事） —— */
  try {
    if (!document.querySelector('script[data-sw-menu]')) {
      var sm = document.createElement('script');
      sm.src = 'js/spirit-widget-menu.js?v=20261124b';
      sm.setAttribute('data-sw-menu', '1');
      sm.defer = true;
      document.head.appendChild(sm);
    }
  } catch (e) {}

  /* —— 统一登录态入口：全站共用 tafei-session.js —— */
  try {
    if (!window.TafeiSession && !document.querySelector('script[data-tf-session]')) {
      var ss = document.createElement('script');
      ss.src = 'js/tafei-session.js?v=20261124b';
      ss.setAttribute('data-tf-session', '1');
      document.head.appendChild(ss);
    }
    /* 「我的」页额外挂上账号同步与问题反馈 */
    if (/my\.html($|[?#])/.test(location.pathname + location.search) && !document.querySelector('script[data-tf-account]')) {
      var ac = document.createElement('script');
      ac.src = 'js/my-account.js?v=20261125a';
      ac.setAttribute('data-tf-account', '1');
      document.head.appendChild(ac);
    }
  } catch (e) {}

  window.__tafeiAppInfo = { ready: true, navHeight: 62, tabs: 5 };
})();
