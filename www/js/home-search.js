/* TAFEI 首页搜索：就地出结果，不再跳 search.html */
(function () {
  'use strict';
  var box = document.getElementById('hvSearchBox');
  if (!box || window.__tafeiHomeSearch) return;
  window.__tafeiHomeSearch = true;

  var input = document.getElementById('hvSearchInput');
  var panel = document.getElementById('hvSearchResults');
  if (!input || !panel) return;

  var PAGES = [
    { t: '手机急救室', d: '按步骤自检，2 分钟出结论', h: 'fix.html', tag: '页面' },
    { t: '技术服务预约', d: '解 BL / Root / 救砖 / 上门', h: 'service.html', tag: '页面' },
    { t: '淘机商城', d: '资料包 · 折叠工具 · 站长定制服务', h: 'shop.html', tag: '页面' },
    { t: '精灵小屋', d: '伙伴、皮肤与成长任务', h: 'jingling.html', tag: '页面' },
    { t: '留言板', d: '随便聊聊，站长都会看', h: '#guestbook', tag: '页面' },
    { t: '更新日志合集', d: '站点每次改动都在这里', h: '#changelog', tag: '页面' },
    { t: '我的', d: '账号、额度与登录状态', h: 'my.html', tag: '页面' }
  ];

  var ARTICLES = [];
  var DEVICES = [];
  var loaded = false;
  var loading = false;
  var waiters = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function load(cb) {
    if (loaded) { cb(); return; }
    waiters.push(cb);
    if (loading) return;
    loading = true;
    var one = function (url, key) {
      return fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { return j[key] || []; }).catch(function () { return []; });
    };
    Promise.all([one('data/articles.json', 'articles'), one('data/devices.json', 'devices')]).then(function (res) {
      ARTICLES = res[0] || [];
      DEVICES = res[1] || [];
      loaded = true;
      loading = false;
      var q = waiters.splice(0);
      q.forEach(function (fn) { fn(); });
    });
  }

  function articleHit(a, q) {
    var hay = [a.title, a.summary, (a.tags || []).join(' ')].join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  }
  function deviceHit(d, q) {
    var hay = [d.name, d.brand || '', (d.aliases || []).join(' '), d.id].join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function hide() { panel.hidden = true; panel.innerHTML = ''; }

  function row(html) { return html; }

  function renderResults() {
    var q = input.value.trim().toLowerCase();
    if (q.length < 1) { hide(); return; }

    var arts = ARTICLES.filter(function (a) { return articleHit(a, q); }).slice(0, 4);
    var devs = DEVICES.filter(function (d) { return deviceHit(d, q); }).slice(0, 4);
    var pages = PAGES.filter(function (p) { return (p.t + ' ' + p.d).toLowerCase().indexOf(q) >= 0; }).slice(0, 3);
    var out = '';
    var total = arts.length + devs.length + pages.length;

    if (arts.length) {
      out += '<div class="hv-sr-head">文章</div>';
      arts.forEach(function (a) {
        out += '<button type="button" class="hv-sr-item" data-sr-art="' + esc(a.id) + '">'
          + '<span class="hv-sr-tag">' + esc(a.column === 'study' ? '高中资料' : (a.column === 'phone' ? '手机权限' : a.column)) + '</span>'
          + '<span class="hv-sr-main"><b>' + esc(a.title) + '</b><small>' + esc(a.summary) + '</small></span></button>';
      });
    }
    if (devs.length) {
      out += '<div class="hv-sr-head">机型</div>';
      devs.forEach(function (d) {
        out += '<a class="hv-sr-item" href="device.html?m=' + encodeURIComponent(d.id) + '">'
          + '<span class="hv-sr-tag">机型</span>'
          + '<span class="hv-sr-main"><b>' + esc(d.name) + '</b><small>' + esc((d.brand ? d.brand + ' · ' : '') + (d.chip || d.soc || '参数与实测')) + '</small></span></a>';
      });
    }
    if (pages.length) {
      out += '<div class="hv-sr-head">页面</div>';
      pages.forEach(function (p) {
        out += '<a class="hv-sr-item" href="' + esc(p.h) + '"><span class="hv-sr-tag">' + p.tag + '</span>'
          + '<span class="hv-sr-main"><b>' + esc(p.t) + '</b><small>' + esc(p.d) + '</small></span></a>';
      });
    }
    if (!total) {
      out = '<div class="hv-sr-empty">没找到「' + esc(input.value.trim()) + '」。试试「掉帧」「导数」「救砖」或机型名。</div>';
    }
    panel.innerHTML = out;
    panel.hidden = false;

    Array.prototype.forEach.call(panel.querySelectorAll('[data-sr-art]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-sr-art');
        input.value = '';
        hide();
        if (window.TAFEIArticles && window.TAFEIArticles.openArticle) window.TAFEIArticles.openArticle(id);
      });
    });
    Array.prototype.forEach.call(panel.querySelectorAll('a.hv-sr-item'), function (a) {
      a.addEventListener('click', function () { input.value = ''; hide(); });
    });
  }

  var go = document.getElementById('hvSearchGo');
  if (go) go.addEventListener('click', function () { load(renderResults); if (input.value.trim()) input.focus(); });

  var timer = 0;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { load(renderResults); }, 120);
  });
  input.addEventListener('focus', function () { load(function () { if (input.value.trim()) renderResults(); }); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.blur(); hide(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      var first = panel.querySelector('.hv-sr-item');
      if (first) { if (first.click) first.click(); }
    }
  });
  document.addEventListener('click', function (e) {
    if (!box.contains(e.target) && !panel.contains(e.target)) hide();
  });
})();
