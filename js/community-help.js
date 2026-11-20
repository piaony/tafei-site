/* TAFEI 求助台：按机型归档的结构化求助
   数据复用 tafei_posts（category 存机型，content 存结构化文本）+ tafei_comments（回答） */
(() => {
  const API = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1';
  const KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  const POSTS_API = API + '/tafei_posts';
  const COMMENTS_API = API + '/tafei_comments';
  const PROFILES_API = API + '/tafei_profiles';

  const board = document.getElementById('helpBoard');
  const form = document.getElementById('helpForm');
  if (!board || !form) return;

  const els = {
    search: document.getElementById('helpSearch'),
    sort: document.getElementById('helpSort'),
    device: document.getElementById('helpDevice'),
    os: document.getElementById('helpOs'),
    problem: document.getElementById('helpProblem'),
    tried: document.getElementById('helpTried'),
    submit: document.getElementById('helpSubmit'),
    status: document.getElementById('helpStatus'),
    deviceList: document.getElementById('helpDeviceList')
  };

  let posts = [];
  let comments = [];
  let profiles = {};
  let openAnswers = new Set();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const session = () => {
    try { return JSON.parse(localStorage.getItem('tafei-auth-session') || 'null'); }
    catch (e) { return null; }
  };
  const headers = (extra) => ({
    apikey: KEY,
    Authorization: 'Bearer ' + (session()?.access_token || KEY),
    ...(extra || {})
  });

  const say = (msg, kind) => {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.className = 'form-status' + (kind ? ' ' + kind : '');
  };

  /* 结构化正文解析：系统版本 / 问题 / 已试；旧帖子没有前缀时整段当作问题 */
  function parsePost(post) {
    const out = { os: '', problem: '', tried: '' };
    const raw = String(post.content || '');
    raw.split('\n').forEach((line) => {
      const t = line.trim();
      if (!t) return;
      if (t.startsWith('系统版本：')) out.os = t.slice(5).trim();
      else if (t.startsWith('问题：')) out.problem = t.slice(3).trim();
      else if (t.startsWith('已试：')) out.tried = t.slice(3).trim();
      else out.problem = out.problem ? out.problem + '\n' + t : t;
    });
    if (!out.problem) out.problem = raw.trim();
    return out;
  }

  const LEGACY_CATS = ['daily', 'learning', 'tech', 'help', 'knowledge', 'discussion'];

  function modelOf(post) {
    const c = String(post.category || '').trim();
    if (!c || LEGACY_CATS.includes(c)) return '未标机型';
    return c;
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
    return d.toLocaleDateString('zh-CN');
  }

  const countOf = (id) => comments.filter((c) => String(c.post_id) === String(id)).length;

  async function load() {
    board.innerHTML = '<div class="feed-empty">正在加载求助……</div>';
    try {
      const res = await fetch(POSTS_API + '?select=id,user_id,category,content,created_at&order=created_at.desc&limit=80', { headers: headers() });
      if (!res.ok) throw new Error('posts ' + res.status);
      posts = await res.json();
      comments = [];

      const ids = posts.map((p) => p.id);
      if (ids.length) {
        const cRes = await fetch(COMMENTS_API + '?select=id,post_id,user_id,content,created_at&post_id=in.(' + ids.join(',') + ')&order=created_at.asc&limit=800', { headers: headers() });
        if (cRes.ok) comments = await cRes.json();
      }

      const uids = [...new Set([
        ...posts.map((p) => p.user_id),
        ...comments.map((c) => c.user_id)
      ].filter(Boolean))];

      profiles = {};
      if (uids.length) {
        const pRes = await fetch(PROFILES_API + '?select=id,nickname&id=in.(' + uids.join(',') + ')', { headers: headers() });
        if (pRes.ok) {
          const rows = await pRes.json();
          rows.forEach((r) => { profiles[r.id] = r.nickname; });
        }
      }

      fillDeviceList();
      render();
    } catch (e) {
      console.error(e);
      board.innerHTML = '<div class="feed-empty">求助加载失败，请稍后刷新。急事可直接联系站长。</div>';
    }
  }

  function fillDeviceList() {
    if (!els.deviceList) return;
    const names = [...new Set(posts.map(modelOf).filter((n) => n !== '未标机型'))];
    els.deviceList.innerHTML = names.slice(0, 40).map((n) => `<option value="${esc(n)}"></option>`).join('');
  }

  function render() {
    const q = (els.search.value || '').trim().toLowerCase();
    const sort = els.sort.value || 'newest';

    let list = posts.filter((p) => {
      const parsed = parsePost(p);
      const hay = (String(p.category || '') + ' ' + parsed.problem + ' ' + parsed.tried).toLowerCase();
      return !q || hay.includes(q);
    });

    if (sort === 'open') list = list.filter((p) => countOf(p.id) === 0);
    if (sort === 'active') {
      list = [...list].sort((a, b) => countOf(b.id) - countOf(a.id) || String(b.created_at).localeCompare(String(a.created_at)));
    }

    if (!list.length) {
      board.innerHTML = '<div class="feed-empty">' +
        (posts.length ? '没有符合条件的求助。' : '求助台还是空的 —— 发第一条，把机型和问题写清楚。') + '</div>';
      return;
    }

    // 按机型聚合
    const groups = new Map();
    list.forEach((p) => {
      const model = modelOf(p);
      if (!groups.has(model)) groups.set(model, []);
      groups.get(model).push(p);
    });

    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

    board.innerHTML = sorted.map(([model, items]) => {
      const open = items.filter((p) => countOf(p.id) === 0).length;
      return `<section class="help-device">
        <div class="help-device-head">
          <h3>${esc(model)}</h3>
          <span class="hd-count"><b>${items.length}</b> 个问题${open ? ' · ' + open + ' 个还没人回答' : ' · 都有回答了'}</span>
        </div>
        ${items.map(itemHtml).join('')}
      </section>`;
    }).join('');

    bindActions();
  }

  function itemHtml(post) {
    const parsed = parsePost(post);
    const answers = comments.filter((c) => String(c.post_id) === String(post.id));
    const opened = openAnswers.has(String(post.id));
    const uid = session()?.user?.id;

    const answersHtml = opened
      ? `<div class="hi-answers">${answers.map((a) => `
          <div class="hi-answer">
            <b>${esc(profiles[a.user_id] || '挞飞用户')}</b>
            <span>${esc(a.content)}</span>
          </div>`).join('')}
          ${uid ? `<form class="hi-answer-form" data-answer="${esc(post.id)}">
            <input maxlength="400" required placeholder="写你的判断或解决步骤……">
            <button type="submit">发送回答</button>
          </form>`
          : '<p class="hi-os" style="margin-top:8px">登录后才能回答。</p>'}
        </div>`
      : '';

    return `<article class="help-item">
      <div class="hi-head">
        <span class="hi-state ${answers.length ? 'answered' : ''}">${answers.length ? '已有 ' + answers.length + ' 个回答' : '还没人回答'}</span>
        <span>${esc(profiles[post.user_id] || '挞飞用户')}</span>
        <span>${esc(fmtTime(post.created_at))}</span>
        ${post.created_at ? `<time datetime="${esc(post.created_at)}" hidden></time>` : ''}
      </div>
      ${parsed.os ? `<p class="hi-os">系统 ${esc(parsed.os)}</p>` : ''}
      <p class="hi-problem">${esc(parsed.problem)}</p>
      ${parsed.tried ? `<p class="hi-tried">已试：${esc(parsed.tried)}</p>` : ''}
      <div class="hi-actions">
        <button class="hi-answer-toggle" type="button" data-toggle="${esc(post.id)}">
          ${answers.length ? '看回答（' + answers.length + '）' : '回答这个问题'}
        </button>
        <a class="hi-service" href="service.html?device=${encodeURIComponent(modelOf(post))}&issue=${encodeURIComponent(parsed.problem.slice(0, 60))}">自己搞不定，找站长处理 ↗</a>
      </div>
      ${answersHtml}
    </article>`;
  }

  function bindActions() {
    board.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = String(btn.dataset.toggle);
        if (openAnswers.has(id)) openAnswers.delete(id);
        else openAnswers.add(id);
        render();
      });
    });

    board.querySelectorAll('[data-answer]').forEach((f) => {
      f.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = f.querySelector('input');
        sendAnswer(String(f.dataset.answer), input.value, f.querySelector('button'));
      });
    });
  }

  async function sendAnswer(postId, text, button) {
    const s = session();
    if (!s?.user?.id) {
      say('请先登录后再回答。', 'err');
      return;
    }
    const content = String(text || '').trim();
    if (!content) return;

    button.disabled = true;
    try {
      const res = await fetch(COMMENTS_API, {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ post_id: Number(postId), user_id: s.user.id, content })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await load();
      openAnswers.add(String(postId));
      render();
    } catch (e) {
      console.error(e);
      alert('回答发送失败，请稍后重试。');
      button.disabled = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const s = session();
    if (!s?.user?.id) {
      say('发布需要先登录，可在「个人中心」登录后再来。', 'err');
      return;
    }

    const device = els.device.value.trim();
    const problem = els.problem.value.trim();
    const os = els.os.value.trim();
    const tried = els.tried.value.trim();

    if (!device) { say('请填写机型，机型是这台机求助的归档依据。', 'err'); els.device.focus(); return; }
    if (problem.length < 6) { say('问题描述再具体一点，至少写清出现了什么现象。', 'err'); els.problem.focus(); return; }

    const content = (os ? '系统版本：' + os + '\n' : '') +
      '问题：' + problem + (tried ? '\n已试：' + tried : '');

    els.submit.disabled = true;
    say('正在发布…');

    try {
      const res = await fetch(POSTS_API, {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ user_id: s.user.id, category: device.slice(0, 30), content: content.slice(0, 1000) })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      form.reset();
      say('已发布，有回答后会在列表里显示。', 'ok');
      await load();
    } catch (e) {
      console.error(e);
      say('发布失败，可能是登录已过期，请重新登录后再试。', 'err');
      els.submit.disabled = false;
    } finally {
      els.submit.disabled = false;
    }
  });

  els.search.addEventListener('input', render);
  els.sort.addEventListener('change', render);

  load();
})();
