/* TAFEI 社区栏目：在社区页原地展开「手机权限 / 高中资料」列表，不再跳到文章区 */
(function () {
  'use strict';
  var host = document.getElementById('commFeed');
  if (!host || window.__tafeiCommFeed) return;
  window.__tafeiCommFeed = true;

  var DATA = null;
  var pending = [];
  var cur = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function byDateDesc(a, b) { return String(b.date).localeCompare(String(a.date)); }

  function colOf(id) {
    if (!DATA) return null;
    var cols = DATA.columns || [];
    for (var i = 0; i < cols.length; i++) if (cols[i].id === id) return cols[i];
    return null;
  }

  function cardHtml(a) {
    var col = colOf(a.column);
    var tags = (a.tags || []).map(function (t) { return '<span class="af-tag">' + esc(t) + '</span>'; }).join('');
    return '<article class="af-card" data-cf-id="' + esc(a.id) + '" tabindex="0" role="button" aria-label="阅读：' + esc(a.title) + '">'
      + '<div class="af-card-meta"><span class="af-col">' + esc(col ? col.name : a.column) + '</span>'
      + '<span class="af-date">' + esc(a.date) + '</span><span class="af-read">约 ' + a.read_min + ' 分钟</span></div>'
      + '<h3 class="af-card-title">' + esc(a.title) + '</h3>'
      + '<p class="af-card-summary">' + esc(a.summary) + '</p>'
      + '<div class="af-tags">' + tags + '</div></article>';
  }

  function blockHtml(b) {
    switch (b.type) {
      case 'h2': return '<h2 class="af-h2">' + esc(b.text) + '</h2>';
      case 'list': return '<ul class="af-list">' + (b.items || []).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
      case 'quote': return '<blockquote class="af-quote">' + esc(b.text) + '</blockquote>';
      case 'code': return '<pre class="af-code"><code>' + esc(b.text) + '</code></pre>';
      case 'tip': return '<aside class="af-tip">' + esc(b.text) + '</aside>';
      default: return '<p class="af-p">' + esc(b.text) + '</p>';
    }
  }

  function bindCards() {
    Array.prototype.forEach.call(host.querySelectorAll('[data-cf-id]'), function (el) {
      el.addEventListener('click', function () { openArticle(el.getAttribute('data-cf-id')); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openArticle(el.getAttribute('data-cf-id')); }
      });
    });
  }

  function renderList(colId) {
    var col = colOf(colId);
    var list = (DATA.articles || []).filter(function (a) { return a.column === colId; }).sort(byDateDesc);
    var head = '<div class="af-group-head"><div><div class="kicker">' + esc(String(colId).toUpperCase()) + '</div>'
      + '<h2>' + esc(col ? col.name : colId) + '</h2></div><p>' + esc(col ? col.tagline : '') + '</p></div>';
    host.innerHTML = head + (list.length
      ? '<div class="af-grid">' + list.map(cardHtml).join('') + '</div>'
      : '<div class="empty-state">这个栏目还在整理，稍后更新。</div>');
    bindCards();
  }

  function renderAll() {
    var list = (DATA.articles || []).slice().sort(byDateDesc);
    var head = '<div class="af-group-head"><div><div class="kicker">ALL POSTS</div>'
      + '<h2>全部文章</h2></div><p>综合、手机权限、高中资料，按时间倒序。</p></div>';
    host.innerHTML = head + (list.length
      ? '<div class="af-grid">' + list.map(cardHtml).join('') + '</div>'
      : '<div class="empty-state">还没有文章。</div>');
    bindCards();
  }

  function renderReader(a) {
    var col = colOf(a.column);
    var tags = (a.tags || []).map(function (t) { return '<span class="af-tag">' + esc(t) + '</span>'; }).join('');
    host.innerHTML = '<article class="af-reader">'
      + '<button class="textbtn af-back" type="button" data-cf-back>← 返回' + esc(col ? col.name : '栏目') + '</button>'
      + '<div class="af-reader-meta"><span class="af-col">' + esc(col ? col.name : a.column) + '</span>'
      + '<span class="af-date">' + esc(a.date) + '</span><span class="af-read">约 ' + a.read_min + ' 分钟</span></div>'
      + '<h1 class="af-reader-title">' + esc(a.title) + '</h1>'
      + '<p class="af-reader-summary">' + esc(a.summary) + '</p>'
      + '<div class="af-tags">' + tags + '</div>'
      + '<div class="af-body">' + (a.blocks || []).map(blockHtml).join('') + '</div>'
      + '</article>';
    var back = host.querySelector('[data-cf-back]');
    if (back) back.addEventListener('click', function () { renderList(cur); });
  }

  function openArticle(id) {
    if (!DATA) return;
    var a = null;
    for (var i = 0; i < DATA.articles.length; i++) if (DATA.articles[i].id === id) { a = DATA.articles[i]; break; }
    if (!a) return;
    renderReader(a);
    var tabs = document.getElementById('commTabs');
    if (tabs) tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function load(cb) {
    if (DATA) { cb(); return; }
    pending.push(cb);
    if (host.getAttribute('data-cf-loading')) return;
    host.setAttribute('data-cf-loading', '1');
    fetch('data/articles.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (json) {
      DATA = { columns: json.columns || [], articles: json.articles || [] };
      host.removeAttribute('data-cf-loading');
      var q = pending.splice(0);
      q.forEach(function (fn) { fn(); });
    }).catch(function () {
      host.removeAttribute('data-cf-loading');
      host.innerHTML = '<div class="empty-state">内容加载失败，请稍后重试。</div>';
      pending = [];
    });
  }

  function show(colId) {
    cur = colId;
    host.hidden = false;
    load(function () { colId === 'all' ? renderAll() : renderList(colId); });
  }

  function hide() {
    cur = null;
    host.hidden = true;
    host.innerHTML = '';
  }

  window.TAFEICommFeed = { show: show, hide: hide, openArticle: openArticle };
  load(function () { if (!cur) show('all'); });
})();
