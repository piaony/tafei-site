/* ============================================================
   TAFEI · 站内指令面板 / 快捷键 / 分享 / 视图记忆
   纯前端、无依赖、无后端；任何页面缺元素都自动降级
   回退方式：删除本文件与 css/tafei-features.css
   ============================================================ */
(function () {
  'use strict';

  var doc = document;
  var body = doc.body;
  var isHome = body.classList.contains('page-home');
  var VIEWS = {
    home: ['home', 'home-tools', 'projects', 'about', 'lab', 'studio', 'contact'],
    info: ['info'],
    community: ['community', 'help'],
    guestbook: ['guestbook'],
    profile: ['profile']
  };
  var SITE_PAGES = [
    { type: 'page', href: 'index.html', title: '首页 · 让互联网温暖每一个人', body: 'home 首页 挞飞 社区 工具 作品 实验室 留言 个人中心' },
    { type: 'page', href: 'about.html', title: '关于 · 我是飘飘', body: 'about 关于 故事 梦想 高中生 初心' },
    { type: 'page', href: 'shop.html', title: '挞飞商城', body: 'shop 商城 商品 购物车 联系卖家' },
    { type: 'page', href: 'admin.html', title: '管理后台', body: 'admin 管理 后台 登录 公告 商品' }
  ];

  /* ---------------- 工具 ---------------- */
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* 读取可读文本：块级元素边界补空格，隐藏元素也能得到分词正确的结果 */
  var BLOCK_TAGS = /^(DIV|P|H1|H2|H3|H4|H5|SECTION|ARTICLE|LI|UL|OL|HEADER|FOOTER|NAV|BUTTON|A|BR|TR|TD|TH|FORM|LABEL|PRE|TABLE)$/;
  function readableText(node) {
    var buf = [];
    (function walk(n) {
      if (!n) return;
      if (n.nodeType === 3) { buf.push(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CANVAS' || tag === 'SVG') return;
      var isBlock = BLOCK_TAGS.test(tag);
      if (isBlock) buf.push(' ');
      for (var i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
      if (isBlock) buf.push(' ');
    })(node);
    return buf.join('');
  }

  function viewOf(id) {
    for (var k in VIEWS) { if (VIEWS[k].indexOf(id) > -1) return k; }
    return null;
  }
  function isTyping(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  /* ---------------- 轻提示 ---------------- */
  var toastTimer = null, toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = doc.createElement('div');
      toastEl.className = 'tf2-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      doc.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }

  /* ---------------- 复制 / 分享 ---------------- */
  function legacyCopy(text) {
    var ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    doc.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    toast(ok ? '链接已复制' : '复制失败，请手动复制地址栏链接');
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('链接已复制'); }, function () { legacyCopy(text); });
    } else {
      legacyCopy(text);
    }
  }
  function copyLink() { copyText(location.href); }
  function sharePage() {
    if (navigator.share) {
      navigator.share({ title: doc.title, url: location.href }).catch(function () {});
    } else {
      copyLink();
    }
  }

  /* ---------------- 搜索索引 ---------------- */
  var index = null;
  function buildIndex() {
    if (index) return index;
    index = [];
    if (isHome) {
      Array.prototype.forEach.call(doc.querySelectorAll('main > section'), function (sec) {
        if (!sec.id) return;
        var h = sec.querySelector('h2') || sec.querySelector('h1') || sec.querySelector('h3');
        var title = norm(h ? h.textContent : '') || sec.id;
        index.push({
          kind: '页面分区', id: sec.id, view: viewOf(sec.id),
          title: title.slice(0, 64),
          body: norm(readableText(sec)).slice(0, 900)
        });
      });
      SITE_PAGES.forEach(function (p) {
        if (p.href === 'index.html') return;
        index.push({ kind: '页面', href: p.href, title: p.title, body: p.body });
      });
      index.push({ kind: '页面', href: 'index.html', title: '首页 · 让互联网温暖每一个人', body: 'home 首页 挞飞 社区 工具 作品 实验室 留言 个人中心' });
    } else {
      Array.prototype.forEach.call(doc.querySelectorAll('main h1,main h2,main h3'), function (h) {
        var sec = h.closest ? h.closest('section') : null;
        var t = norm(h.textContent);
        if (!t || t.length < 2) return;
        index.push({ kind: '本页小节', el: h, title: t.slice(0, 64), body: norm(readableText(h.parentNode)).slice(0, 600) });
      });
      SITE_PAGES.forEach(function (p) {
        if (location.pathname.indexOf(p.href) > -1) return;
        index.push({ kind: '页面', href: p.href, title: p.title, body: p.body });
      });
    }
    return index;
  }

  function dedupe(list) {
    var seen = {}, out = [];
    list.forEach(function (it) {
      var key = it.title;
      if (!seen[key]) { seen[key] = it; out.push(it); return; }
      if ((it.body || '').length > (seen[key].body || '').length) {
        out[out.indexOf(seen[key])] = it;
        seen[key] = it;
      }
    });
    return out;
  }

  function search(q) {
    var all = buildIndex();
    var qs = String(q || '').toLowerCase().split(/[\s,，、]+/).filter(Boolean);
    if (!qs.length) {
      var base = dedupe(all.filter(function (x) {
        return x.kind === '页面分区' || x.kind === '页面' || (x.kind === '本页小节' && !isHome);
      }));
      return base.slice(0, 8).map(function (x) { return { item: x, hit: '' }; });
    }
    var out = [];
    all.forEach(function (it) {
      var hay = (it.title + ' ' + (it.body || '')).toLowerCase();
      var hitAll = true;
      for (var i = 0; i < qs.length; i++) { if (hay.indexOf(qs[i]) === -1) { hitAll = false; break; } }
      if (!hitAll) return;
      var score = 0;
      var t = it.title.toLowerCase();
      qs.forEach(function (k) {
        if (t.indexOf(k) > -1) score += 3;
        if (it.kind === '页面分区' || it.kind === '本页小节') score += 1;
      });
      if (it.kind === '页面') score -= 1;
      out.push({ item: it, score: score, token: qs[0] });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    var picked = dedupe(out.map(function (x) { return x.item; }));
    return picked.slice(0, 8).map(function (it) {
      var token = qs[0];
      return { item: it, token: token };
    });
  }

  function snippet(it, token) {
    var txt = norm(it.body || '');
    var at = txt.toLowerCase().indexOf(String(token || '').toLowerCase());
    var head = at > 40 ? '…' + txt.slice(at - 34) : txt.slice(0, 78);
    var tail = txt.length > head.length + 24 ? '…' : '';
    var out = esc(head) + tail;
    if (token) {
      out = out.replace(new RegExp('(' + String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<em>$1</em>');
    }
    return out;
  }

  /* ---------------- 结果项动作 ---------------- */
  function actions(q) {
    var list = [];
    if (!norm(q)) {
      list.push({ kind: '动作', title: '分享本页', run: sharePage });
      list.push({ kind: '动作', title: '复制本页链接', run: copyLink });
      list.push({ kind: '动作', title: '快捷键说明', run: openKeys });
    }
    return list;
  }

  function goTo(item) {
    if (item.href) { location.href = item.href; return; }
    var el = item.el || doc.getElementById(item.id);
    if (!el) return;
    var view = item.view;
    if (view && el.classList && el.classList.contains('app-section-hidden')) {
      var link = doc.querySelector('[data-view="' + view + '"]') || doc.querySelector('[data-open-view="' + view + '"]');
      if (link) link.click();
    }
    if (view) { try { localStorage.setItem('tafei-view', view); } catch (e) {} }
    setTimeout(function () {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); }
      el.classList.add('tf2-hit');
      setTimeout(function () { el.classList.remove('tf2-hit'); }, 1700);
    }, 90);
  }

  /* ---------------- 指令面板 ---------------- */
  var layer = null, box = null, input = null, list = null, cur = 0, lastFocus = null;

  function render(q) {
    var results = [];
    actions(q).forEach(function (a) { results.push({ item: a, hit: '', act: true }); });
    search(q).forEach(function (r) { results.push({ item: r.item, hit: r.token, act: false }); });
    cur = 0;
    if (!results.length) {
      list.innerHTML = '<li class="tf2-empty">没有找到「' + esc(norm(q)) + '」相关内容<br><span style="font-size:12px">试试「留言」「作品」「商城」「关于」</span></li>';
      return;
    }
    var html = '';
    results.forEach(function (r, i) {
      var sub = r.act ? '按 Enter 执行' : snippet(r.item, r.token || r.hit);
      html += '<li class="tf2-item" role="option" data-i="' + i + '"' + (i === 0 ? ' aria-selected="true"' : '') + '>'
        + '<span class="tf2-badge">' + esc(r.item.kind) + '</span>'
        + '<span class="tf2-txt"><span class="tf2-title">' + esc(r.item.title) + '</span>'
        + '<span class="tf2-sub">' + sub + '</span></span></li>';
    });
    list.innerHTML = html;
    list._results = results;
  }

  function moveSelection(step) {
    var results = list._results || [];
    if (!results.length) return;
    cur = (cur + step + results.length) % results.length;
    Array.prototype.forEach.call(list.children, function (li, i) {
      li.setAttribute('aria-selected', i === cur ? 'true' : 'false');
    });
    var li = list.children[cur];
    if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
  }

  function chooseCurrent() {
    var results = list._results || [];
    var r = results[cur];
    if (!r) return;
    closeLayer();
    if (r.item.run) { r.item.run(); return; }
    goTo(r.item);
  }

  function openCmd() {
    if (layer) { input.value = ''; render(''); input.focus(); return; }
    lastFocus = doc.activeElement;
    layer = doc.createElement('div');
    layer.className = 'tf2-layer';
    layer.innerHTML = '<div class="tf2-box" role="dialog" aria-modal="true" aria-label="站内搜索">'
      + '<div class="tf2-head"><span class="tf2-ico" aria-hidden="true">' + '<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M20 20l-4.2-4.2\"/></svg>' + '</span>'
      + '<input class="tf2-input" id="tf2Input" type="search" autocomplete="off" spellcheck="false" placeholder="搜索站内内容，或输入页面名跳转…">'
      + '<span class="tf2-kbd">Esc</span></div>'
      + '<ul class="tf2-list" id="tf2List" role="listbox"></ul>'
      + '<div class="tf2-foot"><span>↑↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span></div></div>';
    doc.body.appendChild(layer);
    box = layer.firstChild;
    input = doc.getElementById('tf2Input');
    list = doc.getElementById('tf2List');

    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); chooseCurrent(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); }
    });
    list.addEventListener('click', function (e) {
      var li = e.target.closest ? e.target.closest('.tf2-item') : null;
      if (!li) return;
      cur = +li.dataset.i;
      chooseCurrent();
    });
    layer.addEventListener('mousedown', function (e) { if (e.target === layer) closeLayer(); });

    render('');
    input.focus();
  }

  /* ---------------- 快捷键面板 ---------------- */
  var keysLayer = null;
  var KEY_ROWS = [
    ['⌘K / Ctrl K', '打开站内搜索'],
    ['/', '同「打开站内搜索」'],
    ['?', '查看这份快捷键说明'],
    ['Enter', '打开选中的结果'],
    ['↑ ↓', '在结果之间移动'],
    ['Esc', '关闭当前浮层'],
    ['Tab', '切换焦点（全站可见焦点环）']
  ];
  function openKeys() {
    closeLayer();
    keysLayer = doc.createElement('div');
    keysLayer.className = 'tf2-layer';
    var rows = '';
    KEY_ROWS.forEach(function (r) {
      rows += '<div class="tf2-key-row"><span>' + esc(r[1]) + '</span><kbd>' + esc(r[0]) + '</kbd></div>';
    });
    keysLayer.innerHTML = '<div class="tf2-box" role="dialog" aria-modal="true" aria-label="快捷键">'
      + '<div class="tf2-head"><span class="tf2-ico" aria-hidden="true">⌨</span>'
      + '<input class="tf2-input" readonly value="键盘快捷键" aria-label="键盘快捷键">'
      + '<span class="tf2-kbd">Esc</span></div>'
      + '<div class="tf2-keys">' + rows + '</div>'
      + '<div class="tf2-foot"><span>按 Esc 关闭</span></div></div>';
    doc.body.appendChild(keysLayer);
    keysLayer.addEventListener('mousedown', function (e) { if (e.target === keysLayer) closeKeys(); });
    var first = keysLayer.querySelector('.tf2-box');
    if (first) { first.setAttribute('tabindex', '-1'); first.focus(); }
  }
  function closeKeys() {
    if (keysLayer && keysLayer.parentNode) keysLayer.parentNode.removeChild(keysLayer);
    keysLayer = null;
  }

  function closeLayer() {
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = null; box = null; input = null; list = null;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  /* ---------------- 浮动入口 ---------------- */
  function mountFab() {
    if (doc.querySelector('.tf2-fab')) return;
    var fab = doc.createElement('button');
    fab.type = 'button';
    fab.className = 'tf2-fab';
    fab.setAttribute('aria-label', '站内搜索（快捷键 Ctrl+K）');
    fab.title = '站内搜索（Ctrl+K）';
    fab.innerHTML = '<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M20 20l-4.2-4.2\"/></svg>';
    fab.addEventListener('click', openCmd);
    doc.body.appendChild(fab);
  }

  /* ---------------- 键盘 ---------------- */
  doc.addEventListener('keydown', function (e) {
    var typing = isTyping(e.target);
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault(); openCmd(); return;
    }
    if (e.key === 'Escape') {
      if (keysLayer) { closeKeys(); return; }
      if (layer) { closeLayer(); return; }
      return;
    }
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); openCmd(); return; }
    if (e.key === '?') { e.preventDefault(); openKeys(); }
  });

  /* ---------------- 视图记忆（仅首页） ---------------- */
  function restoreView() {
    if (!isHome) return;
    var saved = null;
    try { saved = localStorage.getItem('tafei-view'); } catch (e) { saved = null; }
    if (!saved || saved === 'home' || !VIEWS[saved]) return;
    var link = doc.querySelector('[data-view="' + saved + '"]');
    if (link) setTimeout(function () { link.click(); }, 60);
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    if (!doc.querySelector('.mobile-bottom-nav')) body.classList.add('tf2-nobnav');
    mountFab();
    restoreView();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 供调试/外部调用 */
  window.TAFEI = window.TAFEI || {};
  window.TAFEI.openSearch = openCmd;
  window.TAFEI.toast = toast;
})();
