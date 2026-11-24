/* TAFEI 图标系统 v34
   作用：全站统一线性图标，取代"用单个汉字当图标"的做法
   用法：<span class="ico" data-ti="fix"></span> 或 <svg class="ti"><use href="#ti-fix"></use></svg>
   说明：脚本会自动注入 SVG sprite，并对页面上所有 [data-ti] 元素补齐图标；
        之后动态插入的元素也会被 MutationObserver 覆盖 */
(function () {
  'use strict';

  var NAMES = [
    'home', 'community', 'spirit', 'grid', 'me',
    'fix', 'device', 'search', 'shop', 'service', 'game', 'book',
    'update', 'feedback', 'about', 'shield', 'coin', 'fire', 'calendar',
    'clock', 'bell', 'user', 'sun', 'lock', 'go', 'star', 'download', 'chat', 'smile', 'paper'
  ];

  var PATHS = {
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>',
    community: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h5A2.5 2.5 0 0 1 14 6.5v3A2.5 2.5 0 0 1 11.5 12H9l-5 4v-4A2.5 2.5 0 0 1 4 9.5z"/><path d="M14 9.5h3.5A2.5 2.5 0 0 1 20 12v3.5A2.5 2.5 0 0 1 17.5 18H16v3l-3.5-3H15"/>',
    spirit: '<path d="M12 3.2l1.75 4.45L18.2 9.4l-4.45 1.75L12 15.6l-1.75-4.45L5.8 9.4l4.45-1.75z"/><path d="M17.8 14.6l.85 2.05 2.05.85-2.05.85-.85 2.05-.85-2.05-2.05-.85 2.05-.85z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    me: '<circle cx="12" cy="8.2" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    fix: '<rect x="3.4" y="7.4" width="17.2" height="12.2" rx="3"/><path d="M9 7.4V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.4"/><path d="M12 10.9v5.2M9.4 13.5h5.2"/>',
    device: '<rect x="6.4" y="2.4" width="11.2" height="19.2" rx="2.6"/><path d="M10 18.4h4"/><path d="M9.6 5.2h4.8"/>',
    search: '<circle cx="10.6" cy="10.6" r="6.4"/><path d="m15.4 15.4 5 5"/>',
    shop: '<path d="M5.4 8h13.2l1 12.2H4.4z"/><path d="M9 8V6.6a3 3 0 0 1 6 0V8"/>',
    service: '<path d="M14.7 5.3a4.2 4.2 0 0 0-5.4 5.4L4 16l4 4 5.3-5.3a4.2 4.2 0 0 0 5.4-5.4l-3 3-2.4-2.4z"/>',
    game: '<rect x="3" y="7.2" width="18" height="9.8" rx="4.4"/><path d="M8 10.4v3.4M6.3 12.1h3.4"/><circle cx="16.2" cy="11.2" r="1.05"/><circle cx="18.3" cy="13.4" r="1.05"/>',
    book: '<path d="M12 6.6C10.6 5.1 8.6 4.6 5 4.6v13c3.6 0 5.6.5 7 2 1.4-1.5 3.4-2 7-2v-13c-3.6 0-5.6.5-7 2z"/><path d="M12 6.6v13"/>',
    update: '<path d="M4.6 12a7.4 7.4 0 0 1 12.6-5.3"/><path d="M19.4 12a7.4 7.4 0 0 1-12.6 5.3"/><path d="M17.4 3.2v3.6h-3.6M6.6 20.8v-3.6h3.6"/>',
    feedback: '<path d="M4 5.4h16v10.4H9.6l-5.6 4.2z"/><path d="M8.2 9h7.6M8.2 12h5"/>',
    about: '<circle cx="12" cy="12" r="8.4"/><path d="M12 8.4h.01"/><path d="M12 11.4v5.2"/>',
    shield: '<path d="M12 3.3l7.2 2.6v6.3c0 4-3.1 6.5-7.2 7.9-4.1-1.4-7.2-3.9-7.2-7.9V5.9z"/><path d="m9 12 2.2 2.2 3.9-4.1"/>',
    coin: '<path d="m12 3 8 5-8 5-8-5z"/><path d="M4 13l8 5 8-5"/><path d="M4 17.2l8 5 8-5"/>',
    fire: '<path d="M12.4 3.4c2.9 3.3 5.2 5.5 5.2 8.6a5.6 5.6 0 0 1-11.2 0c0-1.9.8-3.4 1.8-4.9.5 1.6 1.3 2.7 2.2 3.5.9-2.2 1.5-4.6 2-7.2z"/>',
    calendar: '<rect x="3.4" y="5.4" width="17.2" height="15.2" rx="2.6"/><path d="M8 3.4v4M16 3.4v4M3.4 10h17.2"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 2"/>',
    bell: '<path d="M6 9.4a6 6 0 0 1 12 0v3.8l2 2v1.8H4v-1.8l2-2z"/><path d="M10 19.4a2 2 0 0 0 4 0"/>',
    user: '<circle cx="12" cy="8" r="3.4"/><path d="M5.2 19.6a6.8 6.8 0 0 1 13.6 0"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.2 5.2l1.5 1.5M17.3 17.3l1.5 1.5M18.8 5.2l-1.5 1.5M6.7 17.3l-1.5 1.5"/>',
    lock: '<rect x="4.6" y="10.2" width="14.8" height="10.2" rx="2.4"/><path d="M8 10.2V7.8a4 4 0 0 1 8 0v2.4"/>',
    go: '<path d="m9.2 5 7 7-7 7"/>',
    star: '<path d="m12 3.4 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    download: '<path d="M12 3.6v10.8"/><path d="m7.8 10.6 4.2 4.2 4.2-4.2"/><path d="M4.8 19.4h14.4"/>',
    chat: '<path d="M4 5.4h16v11H9.6l-5.6 4.2z"/><path d="M8.4 9.2h7.2M8.4 12.2h4.6"/>',
    smile: '<circle cx="12" cy="12" r="8.4"/><path d="M8.6 14.1a3.9 3.9 0 0 0 6.8 0"/><path d="M9.4 9.5h.01M14.6 9.5h.01"/>',
    paper: '<path d="M20.4 3.6 3.9 10.4l6 2.1 2.1 6z"/><path d="m9.9 12.5 4.9-4.9"/>'
  };

  function buildSprite() {
    var out = '<svg id="ti-sprite" aria-hidden="true" focusable="false" width="0" height="0" '
      + 'style="position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none">';
    for (var i = 0; i < NAMES.length; i++) {
      var n = NAMES[i];
      out += '<symbol id="ti-' + n + '" viewBox="0 0 24 24" fill="none" stroke-width="1.7" '
        + 'stroke-linecap="round" stroke-linejoin="round">' + PATHS[n] + '</symbol>';
    }
    return out + '</svg>';
  }

  function markup(name, cls) {
    if (!PATHS[name]) name = 'star';
    return '<svg class="ti-svg ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
      + '<use href="#ti-' + name + '"/></svg>';
  }

  function hydrate(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = scope.querySelectorAll('[data-ti]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute('data-ti-ready') === '1') continue;
      var name = el.getAttribute('data-ti');
      el.innerHTML = markup(name, el.getAttribute('data-ti-cls'));
      el.setAttribute('data-ti-ready', '1');
    }
    var uses = scope.querySelectorAll('[data-ti-use]');
    for (var j = 0; j < uses.length; j++) {
      var u = uses[j];
      if (u.getAttribute('data-ti-ready') === '1') continue;
      u.innerHTML = markup(u.getAttribute('data-ti-use'), u.getAttribute('data-ti-cls'));
      u.setAttribute('data-ti-ready', '1');
    }
  }

  function boot() {
    if (!document.getElementById('ti-sprite')) {
      var box = document.createElement('div');
      box.innerHTML = buildSprite();
      var sprite = box.firstChild;
      if (document.body) document.body.insertBefore(sprite, document.body.firstChild);
      else document.documentElement.appendChild(sprite);
    }
    hydrate();
    try {
      var obs = new MutationObserver(function () { hydrate(); });
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    setTimeout(hydrate, 400);
    setTimeout(hydrate, 1500);
  }

  window.TafeiIcons = { markup: markup, hydrate: hydrate, names: NAMES };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
