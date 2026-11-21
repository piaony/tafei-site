/* TAFEI 内容站：文章列表 + 阅读视图 */
(() => {
  const root = document.getElementById('articles');
  if (!root) return;

  const DATA = { columns: [], articles: [] };
  let TERMS = [];

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function buildTerms(devices) {
    const list = [];
    (devices || []).forEach((d) => {
      [d.name].concat(d.aliases || []).forEach((t) => {
        const term = String(t || '').trim();
        if (term.length >= 3 && /[a-z0-9]/i.test(term)) list.push({ term, id: d.id });
      });
    });
    list.sort((a, b) => b.term.length - a.term.length);
    TERMS = list;
  }

  function linkify(text) {
    const html = esc(text);
    if (!TERMS.length) return html;
    const map = new Map();
    const alts = TERMS.map((t) => { map.set(t.term.toLowerCase(), t.id); return escRe(esc(t.term)); });
    try {
      return html.replace(new RegExp('(' + alts.join('|') + ')', 'gi'), (m) => {
        const id = map.get(m.toLowerCase());
        return id ? `<a class="af-devlink" href="device.html?m=${encodeURIComponent(id)}">${m}</a>` : m;
      });
    } catch (e) { return html; }
  }
  const state = { mode: 'list', column: null, current: null };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const colName = (id) => {
    const c = DATA.columns.find((x) => x.id === id);
    return c ? c.name : id;
  };

  const byDateDesc = (list) => [...list].sort((a, b) => b.date.localeCompare(a.date));

  function blockHtml(b) {
    switch (b.type) {
      case 'h2': return `<h2 class="af-h2">${esc(b.text)}</h2>`;
      case 'list':
        return `<ul class="af-list">${(b.items || []).map((i) => `<li>${linkify(i)}</li>`).join('')}</ul>`;
      case 'quote': return `<blockquote class="af-quote">${linkify(b.text)}</blockquote>`;
      case 'code': return `<pre class="af-code"><code>${esc(b.text)}</code></pre>`;
      case 'tip': return `<aside class="af-tip">${linkify(b.text)}</aside>`;
      default: return `<p class="af-p">${linkify(b.text)}</p>`;
    }
  }

  function cardHtml(a) {
    const tags = (a.tags || []).map((t) => `<span class="af-tag">${esc(t)}</span>`).join('');
    return `<article class="af-card" data-id="${esc(a.id)}" tabindex="0" role="button"
      aria-label="阅读：${esc(a.title)}">
      <div class="af-card-meta"><span class="af-col">${esc(colName(a.column))}</span>
      <span class="af-date">${esc(a.date)}</span><span class="af-read">约 ${a.read_min} 分钟</span></div>
      <h3 class="af-card-title">${esc(a.title)}</h3>
      <p class="af-card-summary">${esc(a.summary)}</p>
      <div class="af-tags">${tags}</div>
    </article>`;
  }

  function renderList(filter) {
    state.mode = 'list';
    const cols = filter
      ? DATA.columns.filter((c) => c.id === filter)
      : DATA.columns;

    const groups = cols.map((col) => {
      const list = byDateDesc(DATA.articles.filter((a) => a.column === col.id));
      if (!list.length) return '';
      return `<div class="af-group">
        <div class="af-group-head">
          <div><div class="kicker">${esc(col.id.toUpperCase())}</div>
          <h2>${esc(col.name)}</h2></div>
          <p>${esc(col.tagline)}</p>
        </div>
        <div class="af-grid">${list.map(cardHtml).join('')}</div>
      </div>`;
    }).join('');

    root.innerHTML = `<div class="af-list-wrap">
      <div class="section-head"><div><div class="kicker">CONTENT</div>
      <h2>最近更新</h2></div><p>手机权限为主线，高中资料为副线；游客可读全文，注册用于评论与私信。</p></div>
      ${groups || '<div class="empty-state">内容准备中，稍后更新。</div>'}
    </div>`;

    root.querySelectorAll('.af-card').forEach((card) => {
      const open = () => openArticle(card.dataset.id);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  function renderReader(a) {
    state.mode = 'reader';
    const others = DATA.articles.filter((x) => x.column === a.column && x.id !== a.id);
    const related = byDateDesc(others).slice(0, 3);
    const idx = byDateDesc(DATA.articles.filter((x) => x.column === a.column))
      .findIndex((x) => x.id === a.id);
    const colList = byDateDesc(DATA.articles.filter((x) => x.column === a.column));
    const prev = idx > 0 ? colList[idx - 1] : null;
    const next = idx < colList.length - 1 ? colList[idx + 1] : null;

    const tags = (a.tags || []).map((t) => `<span class="af-tag">${esc(t)}</span>`).join('');
    const relHtml = related.length
      ? `<div class="af-related"><h3>同栏目更多</h3><div class="af-grid">${related.map(cardHtml).join('')}</div></div>` : '';

    root.innerHTML = `<article class="af-reader">
      <button class="textbtn af-back" type="button" data-af-back>← 返回文章列表</button>
      <div class="af-reader-meta">
        <span class="af-col">${esc(colName(a.column))}</span>
        <span class="af-date">${esc(a.date)}</span>
        <span class="af-read">约 ${a.read_min} 分钟</span>
      </div>
      <h1 class="af-reader-title">${esc(a.title)}</h1>
      <p class="af-reader-summary">${esc(a.summary)}</p>
      <div class="af-tags">${tags}</div>
      <div class="af-body">${(a.blocks || []).map(blockHtml).join('')}</div>
      <nav class="af-pager">
        ${prev ? `<a class="af-page" data-id="${esc(prev.id)}"><span>上一篇</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}
        ${next ? `<a class="af-page" data-id="${esc(next.id)}"><span>下一篇</span><strong>${esc(next.title)}</strong></a>` : '<span></span>'}
      </nav>
      ${relHtml}
    </article>`;

    root.querySelectorAll('[data-af-back]').forEach((b) => b.addEventListener('click', () => goList()));
    root.querySelectorAll('.af-pager [data-id], .af-related [data-id]').forEach((el) => {
      el.addEventListener('click', () => openArticle(el.dataset.id));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goList() {
    history.replaceState(null, '', '#home');
    renderList(state.column);
  }

  function openArticle(id) {
    const a = DATA.articles.find((x) => x.id === id);
    if (!a) { renderList(state.column); return; }
    state.current = id;
    history.replaceState(null, '', `#/article/${encodeURIComponent(id)}`);
    renderReader(a);
    document.title = `${a.title} · 挞飞`;
  }

  function openColumn(id) {
    state.column = id && DATA.columns.some((c) => c.id === id) ? id : null;
    history.replaceState(null, '', '#home');
    renderList(state.column);
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function init() {
    try {
      const res = await fetch('data/articles.json', { cache: 'no-store' });
      const json = await res.json();
      DATA.columns = json.columns || [];
      DATA.articles = json.articles || [];
    } catch (e) {
      root.innerHTML = '<div class="empty-state">文章加载失败，请稍后刷新。</div>';
      return;
    }

    try {
      const devRes = await fetch('data/devices.json', { cache: 'no-store' });
      const devJson = await devRes.json();
      buildTerms(devJson.devices || []);
    } catch (e) { TERMS = []; }

    const hash = location.hash;
    const m = hash.match(/^#\/article\/(.+)$/);
    if (m) { openArticle(decodeURIComponent(m[1])); } else { renderList(null); }

    if (hash === '#articles') {
      setTimeout(() => root.scrollIntoView({ behavior: 'smooth', block: 'start' }), 260);
    }

    window.addEventListener('hashchange', () => {
      const hm = location.hash.match(/^#\/article\/(.+)$/);
      if (hm) openArticle(decodeURIComponent(hm[1]));
      else if (state.mode === 'reader') goList();
    });
  }

  window.TAFEIArticles = { openColumn, openArticle };
  init();
})();
