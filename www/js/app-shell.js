/* TAFEI APP SHELL · 手机 App 专用外壳
   1) 统一底部导航：首页 / 机型 / 精灵 / 更多（4 项，全站一致）
   2) 返回键协同：先关弹层，再退回上一页，最后双击退出（在 App 内由原生调用） */
(function () {
  'use strict';
  if (window.__tafeiShell) return;
  window.__tafeiShell = true;

  var html = document.documentElement;
  html.classList.add('in-app');

  var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase() || 'index.html';
  var isIndex = file === 'index.html';

  /* —— 底部导航 —— */
  var GRAD = '<defs><linearGradient id="tfAppGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">'
    + '<stop offset="0" stop-color="#64e8ff"/><stop offset=".55" stop-color="#7297ff"/><stop offset="1" stop-color="#bd8cff"/>'
    + '</linearGradient></defs>';

  function symbol(id, path) {
    return '<symbol id="' + id + '" viewBox="0 0 24 24" fill="none" stroke="url(#tfAppGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + path + '</symbol>';
  }

  var SPRITE = '<svg class="tf-app-sprite" aria-hidden="true" width="0" height="0" style="position:absolute;overflow:hidden">'
    + GRAD
    + symbol('app-home', '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>')
    + symbol('app-device', '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 18.5h4"/>')
    + symbol('app-spirit', '<path d="M12 3.5l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7L4.2 8.5l4.7-.7z"/>')
    + symbol('app-more', '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v.01M12 11v6"/>')
    + '</svg>';

  var TABS = [
    { key: 'home', label: '首页', icon: 'app-home', href: isIndex ? '#home' : 'index.html' },
    { key: 'device', label: '机型', icon: 'app-device', href: 'device.html' },
    { key: 'spirit', label: '精灵', icon: 'app-spirit', href: 'jingling.html' },
    { key: 'more', label: '更多', icon: 'app-more', href: 'app-more.html' }
  ];

  function activeKey() {
    if (/admin/.test(file)) return '';
    if (file === 'device.html' || file === 'search.html') return 'device';
    if (file === 'jingling.html' || file === 'angela.html' || file === 'xiaota.html' || file === 'naiwa.html') return 'spirit';
    if (isIndex) return 'home';
    return 'more'; /* 服务、急救室、商城、关于等内页统一高亮「更多」 */
  }

  function buildNav() {
    var nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', '手机底部导航');
    var act = activeKey();
    var items = TABS.map(function (t) {
      return '<a href="' + t.href + '"' + (t.key === act ? ' class="active"' : '') + '>'
        + '<svg class="tf-ico" aria-hidden="true"><use href="#' + t.icon + '"></use></svg>'
        + '<span>' + t.label + '</span></a>';
    }).join('');
    nav.innerHTML = items;
    return nav;
  }

  function mountNav() {
    if (!document.body) return;
    if (!document.querySelector('.tf-app-sprite')) {
      document.body.insertAdjacentHTML('afterbegin', SPRITE);
    }
    var old = document.querySelector('.mobile-bottom-nav');
    var nav = buildNav();
    if (old && old.parentNode) old.parentNode.replaceChild(nav, old);
    else document.body.appendChild(nav);
  }

  if (document.body) mountNav();
  else document.addEventListener('DOMContentLoaded', mountNav, { once: true });

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

  window.__tafeiAppInfo = { ready: true, navHeight: 62 };
})();
