/* ============================================================
   TAFEI · 信息中心（系统通知 / 站内公告 / 私信）
   纯前端，后端为项目内已有的 Supabase；私信表需先建表（见页面内提示）
   回退方式：删除本文件与 css/tafei-inbox.css 的引用
   ============================================================ */
(function () {
  'use strict';

  var API = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1';
  var KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  var AUTH_STORAGE = 'tafei-auth-session';
  var READ_KEY = 'tafei-inbox-read';
  var DM_TABLE = 'tafei_messages';
  var OWNER_EMAIL = '3659229103@qq.com';

  var root = document.getElementById('tf3Inbox');
  if (!root) return;

  var state = {
    notices: [], announce: [], announceError: null,
    threads: [], profiles: [], profilesLoaded: false,
    tableOk: null, dmLoading: false, msgs: [], peer: null, dmView: 'list', busy: false,
    ownerId: null, ownerLoading: false
  };

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function norm(s) { return String(s == null ? '' : s).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim(); }
  function fmtTime(v) {
    var d = new Date(v);
    if (isNaN(d.getTime())) return '';
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
    return (d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function dayLabel(v) {
    var d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return String(n).length < 2 ? '0' + n : String(n); }
  function clockLabel(v) {
    var d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ---------------- 登录态 ---------------- */
  function session() {
    try { return JSON.parse(localStorage.getItem(AUTH_STORAGE) || 'null'); } catch (e) { return null; }
  }
  function token() { var s = session(); return s && s.access_token ? s.access_token : null; }
  function meId() { var s = session(); return s && s.user && s.user.id ? s.user.id : null; }
  function meName() {
    var s = session();
    if (!s || !s.user) return '我';
    var meta = s.user.user_metadata || {};
    return meta.nickname || meta.username || (s.user.email || '').split('@')[0] || '我';
  }
  function meEmail() {
    var s = session();
    return s && s.user && s.user.email ? String(s.user.email).toLowerCase() : '';
  }
  function isOwner() { return meEmail() === OWNER_EMAIL; }

  var OWNER_WELCOME = '你好，我是挞飞站长。这里是官方直连会话：刷机、救砖、机型选购、资料和售后问题都可以直接在这里说。\n\n站内沟通、站内报价、站内交付都有记录；请不要把设备或钱交给站外认识的人，也不要私下转账。站外交易出了问题，我无法替你兜底。';

  async function resolveOwner() {
    if (state.ownerId || state.ownerLoading || isOwner()) return state.ownerId;
    state.ownerLoading = true;
    try {
      var rows = await rpc('tafei_lookup_peer', { p_email: OWNER_EMAIL });
      if (rows && rows.length && rows[0].uid && rows[0].uid !== meId()) {
        state.ownerId = rows[0].uid;
      }
    } catch (e) {
      state.ownerId = null;
    } finally {
      state.ownerLoading = false;
    }
    return state.ownerId;
  }

  function privateContactKind(text) {
    var raw = String(text || '');
    var digits = raw.replace(/[^0-9]/g, '');
    if (/1[3-9][0-9]{9}/.test(digits)) return '手机号';
    if (/(qq|扣扣|微信|vx|v信|加我|私聊)\s*[：:号]?\s*[a-zA-Z0-9_-]{5,}/i.test(raw)) return 'QQ/微信';
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(raw)) return '邮箱';
    return '';
  }

  function safetyCard() {
    return '<div class="tf3-safety">'
      + '<b>官方保障</b>'
      + '<span>站内私信、站内报价、站长交付。不要私下转账，也不要把设备交给站外认识的人；站外交易产生的纠纷，本站不承担责任。</span>'
      + '</div>';
  }

  function headers(extra) {
    var h = { apikey: KEY };
    var t = token();
    if (t) h.Authorization = 'Bearer ' + t;
    if (extra) { for (var k in extra) h[k] = extra[k]; }
    return h;
  }
  async function rpc(name, body) {
    var res = await fetch(API + '/rpc/' + name, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body || {})
    });
    var text = await res.text();
    if (!res.ok) {
      var msg = '请求失败 ' + res.status;
      try { msg = JSON.parse(text).message || msg; } catch (e) {}
      var err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return text ? JSON.parse(text) : null;
  }

  async function api(path, options) {
    var opts = options || {};
    var res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers(opts.headers),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) {
      var detail = '';
      try { detail = (await res.json()).message || ''; } catch (e) {}
      var err = new Error(detail || ('请求失败 ' + res.status));
      err.status = res.status;
      throw err;
    }
    var text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  /* ---------------- 已读状态 ---------------- */
  function readState() {
    try {
      var v = JSON.parse(localStorage.getItem(READ_KEY) || 'null');
      if (!v || typeof v !== 'object') return { system: [], notice: [] };
      return { system: v.system || [], notice: v.notice || [] };
    } catch (e) { return { system: [], notice: [] }; }
  }
  function saveRead(s) { try { localStorage.setItem(READ_KEY, JSON.stringify(s)); } catch (e) {} }
  function addRead(kind, ids) {
    var s = readState();
    var list = s[kind] || [];
    ids.forEach(function (id) { if (list.indexOf(String(id)) === -1) list.push(String(id)); });
    s[kind] = list;
    saveRead(s);
  }
  function isRead(kind, id) { return (readState()[kind] || []).indexOf(String(id)) > -1; }

  /* ---------------- 分类切换 ---------------- */
  var panes = {
    system: $('[data-pane-body="system"]', root),
    notice: $('[data-pane-body="notice"]', root),
    dm: $('[data-pane-body="dm"]', root)
  };
  var tabs = $$('.tf3-tab', root);
  var readAllBtn = $('#tf3ReadAll', root);

  function switchPane(name) {
    Object.keys(panes).forEach(function (k) {
      if (!panes[k]) return;
      panes[k].hidden = k !== name;
    });
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-pane') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    readAllBtn.hidden = name === 'dm';
    if (name === 'dm') loadDm();
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { switchPane(t.getAttribute('data-pane')); });
  });

  /* ---------------- 未读计数 ---------------- */
  function unreadOf(kind, items) {
    var read = readState()[kind] || [];
    return items.filter(function (it) { return read.indexOf(String(it.id)) === -1; }).length;
  }

  function dmUnread() {
    return (state.threads || []).reduce(function (sum, t) { return sum + (t.unread || 0); }, 0);
  }

  function paintBadges() {
    var counts = {
      system: unreadOf('system', state.notices || []),
      notice: unreadOf('notice', state.announce || []),
      dm: dmUnread()
    };
    Object.keys(counts).forEach(function (k) {
      var el = $('[data-badge="' + k + '"]', root);
      if (!el) return;
      el.textContent = counts[k] > 99 ? '99+' : String(counts[k]);
      el.hidden = counts[k] === 0;
      $$('[data-hub-badge="' + k + '"]').forEach(function (hub) {
        hub.textContent = counts[k] > 99 ? '99+' : String(counts[k]);
        hub.hidden = counts[k] === 0;
      });
    });
    var total = counts.system + counts.notice + counts.dm;
    $$('[data-view="info"]').forEach(function (link) {
      var dot = link.querySelector('.tf3-navdot');
      if (total > 0) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'tf3-navdot';
          dot.setAttribute('aria-hidden', 'true');
          link.appendChild(dot);
        }
        link.setAttribute('aria-label', (link.textContent || '信息').trim() + '，' + total + ' 条未读');
      } else if (dot) {
        dot.parentNode.removeChild(dot);
        link.removeAttribute('aria-label');
      }
    });
  }

  /* ---------------- 系统通知 ---------------- */
  var LEVEL_ICON = { update: '↻', info: 'ℹ', warn: '⚠' };

  function renderSystem() {
    var box = $('[data-pane-body="system"] .tf3-list', root);
    if (!box) return;
    if (!state.notices.length) {
      box.innerHTML = '<div class="tf3-hint">暂时没有系统通知。</div>';
      return;
    }
    var html = '';
    state.notices.forEach(function (n) {
      var read = isRead('system', n.id);
      var lv = n.level || 'info';
      html += '<div class="tf3-row' + (read ? ' is-read' : '') + '" data-role="sys-row" data-id="' + esc(n.id) + '" tabindex="0" role="button" aria-expanded="false">'
        + '<span class="tf3-ico ' + (lv === 'warn' ? 'is-warn' : lv === 'info' ? 'is-info' : '') + '">' + (LEVEL_ICON[lv] || 'ℹ') + '</span>'
        + '<span class="tf3-body"><span class="tf3-title">' + esc(n.title) + '</span>'
        + '<span class="tf3-sub">' + esc(dayLabel(n.date || '')) + ' · 系统通知</span>'
        + '<span class="tf3-text" hidden>' + esc(norm(n.body)) + '</span>'
        + (n.link ? '<a class="tf3-link" href="' + esc(n.link) + '" hidden>前往查看 ↗</a>' : '')
        + '</span>'
        + (read ? '' : '<span class="tf3-dot"></span>')
        + '</div>';
    });
    box.innerHTML = html;

    $$('[data-role="sys-row"]', box).forEach(function (row) {
      function open() {
        var text = $('.tf3-text', row);
        var link = $('.tf3-link', row);
        var dot = $('.tf3-dot', row);
        var expanded = text ? !text.hidden : false;
        if (text) text.hidden = expanded;
        if (link) link.hidden = expanded;
        row.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (dot) { dot.parentNode.removeChild(dot); row.classList.add('is-read'); }
        addRead('system', [row.getAttribute('data-id')]);
        paintBadges();
      }
      row.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.tf3-link')) return;
        open();
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  async function loadSystem() {
    try {
      var res = await fetch('data/notices.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('通知文件读取失败');
      var data = await res.json();
      state.notices = (data.items || []).slice().sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
    } catch (e) {
      state.notices = [];
    }
    renderSystem();
    paintBadges();
  }

  /* ---------------- 公告 ---------------- */
  function renderNotice() {
    var box = $('[data-pane-body="notice"] .tf3-list', root);
    if (!box) return;
    if (state.announceError) {
      box.innerHTML = '<div class="tf3-hint">公告暂时读不到（' + esc(state.announceError) + '）<br>稍后刷新试试。</div>';
      return;
    }
    if (!state.announce.length) {
      box.innerHTML = '<div class="tf3-hint">还没有公告发布。</div>';
      return;
    }
    var html = '';
    state.announce.forEach(function (a) {
      var read = isRead('notice', a.id);
      var badge = a.version ? 'v' + esc(a.version) : '公告';
      html += '<div class="tf3-row' + (read ? ' is-read' : '') + '" data-role="notice-row" data-id="' + esc(a.id) + '" tabindex="0" role="button" aria-expanded="false">'
        + '<span class="tf3-ico">📢</span>'
        + '<span class="tf3-body"><span class="tf3-title">' + esc(a.title || '未命名公告') + '</span>'
        + '<span class="tf3-sub">' + esc(badge) + ' · ' + esc(dayLabel(a.created_at)) + '</span>'
        + '<span class="tf3-text" hidden>' + esc(norm(a.content)) + '</span>'
        + '</span>'
        + (read ? '' : '<span class="tf3-dot"></span>')
        + '</div>';
    });
    box.innerHTML = html;

    $$('[data-role="notice-row"]', box).forEach(function (row) {
      function open() {
        var text = $('.tf3-text', row);
        var dot = $('.tf3-dot', row);
        if (text) {
          var expanded = !text.hidden;
          text.hidden = expanded;
          row.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
        if (dot) { dot.parentNode.removeChild(dot); row.classList.add('is-read'); }
        addRead('notice', [row.getAttribute('data-id')]);
        paintBadges();
      }
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  async function loadNotice() {
    try {
      var rows = await api('/tafei_announcements?select=id,title,content,version,is_active,created_at&order=created_at.desc&limit=30');
      state.announce = (rows || []).filter(function (r) { return r.is_active !== false; });
      state.announceError = null;
    } catch (e) {
      state.announce = [];
      state.announceError = e.status ? ('HTTP ' + e.status) : '网络异常';
    }
    renderNotice();
    paintBadges();
  }

  /* ---------------- 私信 ---------------- */
  var DM_SQL = [
    'create table if not exists public.tafei_messages (',
    '  id bigint generated by default as identity primary key,',
    '  sender_id uuid not null references auth.users (id) on delete cascade,',
    '  recipient_id uuid not null references auth.users (id) on delete cascade,',
    '  body text not null check (char_length(body) between 1 and 1000),',
    '  read_at timestamptz,',
    '  created_at timestamptz not null default now()',
    ');',
    '',
    'alter table public.tafei_messages enable row level security;',
    '',
    'create policy "tafei_dm_insert" on public.tafei_messages',
    '  for insert to authenticated with check (sender_id = auth.uid());',
    'create policy "tafei_dm_select" on public.tafei_messages',
    '  for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());',
    'create policy "tafei_dm_update" on public.tafei_messages',
    '  for update to authenticated using (recipient_id = auth.uid())',
    '  with check (recipient_id = auth.uid());'
  ].join('\n');

  function dmBox() { return $('#tf3DmWrap', root); }

  function renderDm() {
    var box = dmBox();
    if (!box) return;

    if (!token()) {
      box.innerHTML = '<div class="tf3-guest-chat">'
        + '<div class="tf3-threadhead"><b>站长 · 官方会话</b><span class="tf3-pin">默认置顶</span></div>'
        + '<div class="tf3-msgs"><div class="tf3-msg tf3-official-msg">' + esc(OWNER_WELCOME) + '</div></div>'
        + '<div class="tf3-empty tf3-guest-hint">未登录也能看到站长的默认会话。登录后可以直接回复；和其他用户发起对话需要账号。</div>'
        + '<button type="button" class="tf3-cta" data-role="go-login">登录后继续对话</button></div>';
      var btn = $('[data-role="go-login"]', box);
      if (btn) btn.addEventListener('click', function () {
        var toggle = document.getElementById('communityProfileToggle');
        if (toggle) toggle.click();
      });
      return;
    }
    if (state.tableOk !== true) {
      if (isOwner()) {
        box.innerHTML = setupCard();
        wireSetup();
      } else {
        box.innerHTML = pendingCard();
        wirePending();
      }
      return;
    }
    if (state.dmView === 'thread') { box.innerHTML = threadView(); wireThread(); return; }
    if (state.dmView === 'compose') { box.innerHTML = composeView(); wireCompose(); return; }
    box.innerHTML = listView();
    wireList();
  }

  function setupCard() {
    return '<div class="tf3-setup">'
      + '<h4>私信还差一步：建一张表</h4>'
      + '<p>前端已经接好，只差数据库里那张存放私信的表格。你把下面这段 SQL 跑一次，私信立刻就能用（以后不用再跑）。</p>'
      + '<ol><li>打开 Supabase 控制台，进入项目 <b>tafei-cloud</b></li>'
      + '<li>左侧点 <b>SQL Editor</b>，新建查询</li>'
      + '<li>粘贴下面的内容，点 <b>Run</b></li>'
      + '<li>回到这里刷新页面，私信就通了</li></ol>'
      + '<div class="tf3-sqlbar"><span>建表 SQL</span><button type="button" class="tf3-copy" data-role="copy-sql">复制</button></div>'
      + '<div class="tf3-code">' + esc(DM_SQL) + '</div>'
      + '<p style="margin-top:10px">这段 SQL 只做四件事：建表、打开行级安全、让“发件人只能以自己的身份发”、让“只有双方能看到这条消息”。</p>'
      + '<button type="button" class="tf3-cta" data-role="setup-refresh">我已建好，刷新检查</button>'
      + '</div>';
  }

  function pendingCard() {
    return '<div class="tf3-empty tf3-pending">'
      + '<h4>私信正在开通中</h4>'
      + '<p>前端已经就绪，还差站长完成最后一步配置。<br>私信开放前，你仍可以查看系统通知、站内公告和社区内容。</p>'
      + '<button type="button" class="tf3-cta" data-role="dm-refresh">刷新试试</button>'
      + '</div>';
  }

  async function recheckTable(btn) {
    if (!btn || btn.disabled) return;
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '检查中…';
    await probeTable();
    btn.disabled = false;
    btn.textContent = label;
    if (state.tableOk === true) {
      await loadProfiles();
      await loadThreads();
    } else {
      renderDm();
    }
    paintBadges();
  }

  function wirePending() {
    var btn = $('[data-role="dm-refresh"]', dmBox());
    if (btn) btn.addEventListener('click', function () { recheckTable(btn); });
  }

  function wireSetup() {
    var btn = $('[data-role="copy-sql"]', dmBox());
    if (btn) btn.addEventListener('click', function () {
      var text = DM_SQL;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = '已复制';
          setTimeout(function () { btn.textContent = '复制'; }, 1600);
        }, function () { legacyCopy(text, btn); });
      } else {
        legacyCopy(text, btn);
      }
    });
    var re = $('[data-role="setup-refresh"]', dmBox());
    if (re) re.addEventListener('click', function () { recheckTable(re); });
  }

  function legacyCopy(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    if (btn) btn.textContent = ok ? '已复制' : '请手动选中文档复制';
  }

  function peerName(id) {
    if (id && id === state.ownerId) return '挞飞站长';
    var p = (state.profiles || []).filter(function (x) { return x.id === id; })[0];
    if (p && p.nickname) return p.nickname;
    return '成员 ' + String(id || '').slice(0, 6);
  }
  function initial(name) { return String(name || '?').trim().slice(0, 1).toUpperCase(); }

  function listView() {
    var threads = state.threads || [];
    var head = '<div class="tf3-dmhead"><h4>我的会话</h4>'
      + '<button type="button" class="tf3-newbtn" data-role="new-dm">写新私信</button></div>';
    head += safetyCard();
    if (state.dmLoading) return head + '<div class="tf3-hint">正在读取私信…</div>';
    if (!threads.length) {
      return head + '<div class="tf3-empty">还没有私信。<br>点右上角「写新私信」给社区成员发第一条消息。</div>';
    }
    var html = head;
    threads.forEach(function (t) {
      var name = peerName(t.peer);
      var official = t.official || t.peer === state.ownerId;
      html += '<button type="button" class="tf3-thread' + (official ? ' is-official' : '') + '" data-role="open-thread" data-peer="' + esc(t.peer) + '">'
        + '<span class="tf3-avatar">' + esc(official ? '站' : initial(name)) + '</span>'
        + '<span class="tf3-thread-main"><span class="tf3-thread-name">' + esc(name)
        + (official ? ' <span class="tf3-official-tag">官方</span>' : '')
        + (t.unread ? ' <span class="tf3-unread">' + t.unread + '</span>' : '') + '</span>'
        + '<span class="tf3-thread-last">' + esc((t.mine ? '我：' : '') + norm(t.last.body).slice(0, 40)) + '</span></span>'
        + '<span class="tf3-thread-side">' + esc(official && !t.last.created_at ? '默认' : fmtTime(t.last.created_at)) + '</span>'
        + '</button>';
    });
    return html;
  }

  function threadView() {
    var name = peerName(state.peer);
    var official = state.peer === state.ownerId;
    var html = '<div class="tf3-threadhead"><button type="button" class="tf3-back" data-role="back-list">← 会话列表</button>'
      + '<strong>' + esc(name) + '</strong></div>';
    html += safetyCard();
    html += '<div class="tf3-msgs" id="tf3Msgs">';
    if (official) {
      html += '<div class="tf3-msg tf3-official-msg">' + esc(OWNER_WELCOME)
        + '<time>官方会话 · 站长直连</time></div>';
    }
    if (state.dmLoading) {
      html += '<div class="tf3-hint">正在读取消息…</div>';
    } else if (!state.msgs.length) {
      html += '<div class="tf3-hint">' + (official ? '直接回复这条会话即可，站长会看到。' : '还没有消息，说点什么吧。') + '</div>';
    } else {
      state.msgs.forEach(function (m) {
        var mine = m.sender_id === meId();
        html += '<div class="tf3-msg' + (mine ? ' is-mine' : '') + '">' + esc(norm(m.body))
          + '<time>' + esc(clockLabel(m.created_at)) + '</time></div>';
      });
    }
    html += '</div>';
    html += '<div class="tf3-composer">'
      + '<textarea class="tf3-input" id="tf3Input" rows="2" maxlength="1000" placeholder="写点什么…（Ctrl+Enter 发送）"></textarea>'
      + '<button type="button" class="tf3-send" data-role="send">发送</button></div>'
      + '<div class="tf3-status" id="tf3Status"></div>';
    return html;
  }

  function composeView() {
    var head = '<div class="tf3-threadhead"><button type="button" class="tf3-back" data-role="back-list">← 会话列表</button>'
      + '<strong>新私信</strong></div>';
    return head + safetyCard() + '<div class="tf3-form">'
      + '<label class="tf3-label" for="tf3PeerEmail">收件人注册邮箱（必须完整填写）</label>'
      + '<div class="tf3-searchrow">'
      + '<input class="tf3-input" id="tf3PeerEmail" type="email" inputmode="email" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="例如 name@qq.com">'
      + '<button type="button" class="tf3-lookup" data-role="lookup-peer">查找</button>'
      + '</div>'
      + '<div class="tf3-status" id="tf3PeerInfo">只能凭对方注册邮箱发起私信，不提供成员列表。</div>'
      + '<label class="tf3-label" for="tf3Input">内容（1000 字以内）</label>'
      + '<textarea class="tf3-input" id="tf3Input" rows="3" maxlength="1000" placeholder="想说的话…"></textarea>'
      + '<button type="button" class="tf3-send" data-role="send-new" style="align-self:flex-start">发送</button>'
      + '<div class="tf3-status" id="tf3Status"></div></div>';
  }

  function wireList() {
    $$('[data-role="open-thread"]', root).forEach(function (b) {
      b.addEventListener('click', function () { openThread(b.getAttribute('data-peer')); });
    });
    var nb = $('[data-role="new-dm"]', root);
    if (nb) nb.addEventListener('click', function () {
      state.dmView = 'compose';
      renderDm();
    });
  }

  function wireThread() {
    var back = $('[data-role="back-list"]', root);
    if (back) back.addEventListener('click', function () {
      state.dmView = 'list';
      renderDm();
      loadThreads();
    });
    var sendBtn = $('[data-role="send"]', root);
    var input = $('#tf3Input', root);
    function doSend() { sendMessage(input && input.value, state.peer, sendBtn, input); }
    if (sendBtn) sendBtn.addEventListener('click', doSend);
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doSend(); }
    });
    var msgs = $('#tf3Msgs', root);
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function wireCompose() {
    var back = $('[data-role="back-list"]', root);
    if (back) back.addEventListener('click', function () {
      state.dmView = 'list';
      state.peer = null;
      renderDm();
      loadThreads();
    });
    var sendBtn = $('[data-role="send-new"]', root);
    var input = $('#tf3Input', root);
    var emailInput = $('#tf3PeerEmail', root);
    var lookupBtn = $('[data-role="lookup-peer"]', root);

    function peerInfo(msg, isErr) {
      var el = $('#tf3PeerInfo', root);
      if (!el) return;
      el.textContent = msg || '';
      el.style.color = isErr ? '#ff9d9d' : '';
    }

    async function lookup() {
      var val = (emailInput && emailInput.value || '').trim();
      state.peer = null;
      if (!meId()) { peerInfo('请先登录后再发起私信。', true); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { peerInfo('请填写完整的邮箱地址，例如 name@qq.com。', true); return; }
      peerInfo('正在查找…');
      if (lookupBtn) lookupBtn.disabled = true;
      try {
        var rows = await rpc('tafei_lookup_peer', { p_email: val });
        if (!rows || !rows.length) { peerInfo('没有找到这个邮箱的注册成员，请确认是否为对方的注册邮箱。', true); return; }
        if (rows[0].uid === meId()) { peerInfo('不能给自己发私信。', true); return; }
        state.peer = rows[0].uid;
        peerInfo('已找到：' + (rows[0].nickname || val) + '，现在可以发送了。');
      } catch (e) {
        peerInfo('查找失败：' + (e.message || '未知错误'), true);
      } finally {
        if (lookupBtn) lookupBtn.disabled = false;
      }
    }

    if (lookupBtn) lookupBtn.addEventListener('click', lookup);
    if (emailInput) {
      emailInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); lookup(); }
      });
      emailInput.addEventListener('input', function () {
        state.peer = null;
        peerInfo('修改了邮箱，请重新点「查找」。');
      });
    }
    if (sendBtn) sendBtn.addEventListener('click', function () {
      if (!state.peer) { status('请先查找并确认收件人邮箱。'); return; }
      sendMessage(input && input.value, state.peer, sendBtn, input);
    });
  }

  function status(msg) {
    var el = $('#tf3Status', root);
    if (el) el.textContent = msg || '';
  }

  async function sendMessage(text, peer, btn, input) {
    var body = norm(text);
    if (!body) { status('内容不能为空。'); return; }
    if (!peer) { status('请先查找并确认收件人邮箱。'); return; }
    var contactKind = privateContactKind(body);
    if (contactKind) {
      status('私信里不能留' + contactKind + '等站外联系方式。请留在站内沟通，有问题也可以直接找站长，走官方保障。');
      return;
    }
    if (state.busy) return;
    state.busy = true;
    if (btn) { btn.disabled = true; btn.textContent = '发送中…'; }
    status('');
    try {
      await api('/' + DM_TABLE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: { sender_id: meId(), recipient_id: peer, body: body }
      });
      if (input) input.value = '';
      await openThread(peer);
      status('已发送。');
    } catch (e) {
      if (e.status === 404) state.tableOk = false;
      status('发送失败：' + (e.message || '未知错误'));
    } finally {
      state.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '发送'; }
    }
  }

  function groupThreads(rows, me) {
    var map = {};
    rows.forEach(function (m) {
      var peer = m.sender_id === me ? m.recipient_id : m.sender_id;
      if (!map[peer]) map[peer] = { peer: peer, last: m, unread: 0, mine: m.sender_id === me };
      if (m.sender_id === peer && !m.read_at) map[peer].unread += 1;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      return new Date(b.last.created_at) - new Date(a.last.created_at);
    });
  }

  async function loadThreads() {
    if (!token()) { renderDm(); return; }
    state.dmLoading = true;
    renderDm();
    try {
      var me = meId();
      var rows = await api('/' + DM_TABLE
        + '?select=id,sender_id,recipient_id,body,read_at,created_at'
        + '&or=(sender_id.eq.' + me + ',recipient_id.eq.' + me + ')'
        + '&order=created_at.desc&limit=300');
      state.threads = groupThreads(rows || [], me);
      await resolveOwner();
      if (state.ownerId) {
        var hasOwnerThread = state.threads.some(function (t) { return t.peer === state.ownerId; });
        if (!hasOwnerThread) {
          state.threads.unshift({
            peer: state.ownerId,
            official: true,
            mine: false,
            unread: 0,
            last: { body: '官方直连已开启：有问题直接在这里找站长。', created_at: '' }
          });
        } else {
          state.threads.forEach(function (t) {
            if (t.peer === state.ownerId) t.official = true;
          });
        }
        state.threads.sort(function (a, b) {
          if (a.official && !b.official) return -1;
          if (!a.official && b.official) return 1;
          return new Date(b.last.created_at || 0) - new Date(a.last.created_at || 0);
        });
      }
      state.tableOk = true;
    } catch (e) {
      if (e.status === 404) state.tableOk = false;
      state.threads = [];
    }
    state.dmLoading = false;
    renderDm();
    paintBadges();
  }

  async function openThread(peer, keepView) {
    state.peer = peer;
    state.dmView = 'thread';
    state.dmLoading = true;
    if (!keepView) renderDm();
    try {
      var me = meId();
      var rows = await api('/' + DM_TABLE
        + '?select=id,sender_id,recipient_id,body,read_at,created_at'
        + '&or=(and(sender_id.eq.' + me + ',recipient_id.eq.' + peer + '),and(sender_id.eq.' + peer + ',recipient_id.eq.' + me + '))'
        + '&order=created_at.asc&limit=300');
      state.msgs = rows || [];
      state.tableOk = true;
      // 标记收到的消息为已读
      var hasUnread = state.msgs.some(function (m) { return m.sender_id === peer && !m.read_at; });
      if (hasUnread) {
        await api('/' + DM_TABLE + '?sender_id=eq.' + peer + '&recipient_id=eq.' + me + '&read_at=is.null', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: { read_at: new Date().toISOString() }
        });
        state.threads.forEach(function (t) { if (t.peer === peer) t.unread = 0; });
      }
    } catch (e) {
      state.msgs = [];
      if (e.status === 404) state.tableOk = false;
    }
    state.dmLoading = false;
    renderDm();
    paintBadges();
  }

  async function loadProfiles() {
    if (state.profilesLoaded) return;
    try {
      state.profiles = await api('/tafei_profiles?select=id,nickname,bio,created_at&order=created_at.desc&limit=100') || [];
      state.profilesLoaded = true;
    } catch (e) { state.profiles = []; }
  }

  async function probeTable() {
    try {
      var res = await fetch(API + '/' + DM_TABLE + '?select=id&limit=1', { headers: { apikey: KEY } });
      state.tableOk = res.status !== 404;
    } catch (e) { state.tableOk = false; }
  }

  var dmLoaded = false;
  async function loadDm() {
    if (dmLoaded) {
      if (token()) loadThreads();
      return;
    }
    dmLoaded = true;
    if (state.tableOk === null) await probeTable();
    if (state.tableOk === true && token()) {
      await loadProfiles();
      await loadThreads();
    } else {
      renderDm();
    }
    paintBadges();
  }

  /* ---------------- 全部已读 ---------------- */
  if (readAllBtn) {
    readAllBtn.addEventListener('click', function () {
      var pane = 'system';
      tabs.forEach(function (t) { if (t.classList.contains('is-active')) pane = t.getAttribute('data-pane'); });
      if (pane === 'system') {
        addRead('system', state.notices.map(function (n) { return n.id; }));
        renderSystem();
      } else if (pane === 'notice') {
        addRead('notice', state.announce.map(function (a) { return a.id; }));
        renderNotice();
      }
      paintBadges();
    });
  }

  /* ---------------- 启动 ---------------- */
  switchPane('system');
  loadSystem();
  loadNotice();

  window.addEventListener('focus', function () {
    var active = null;
    tabs.forEach(function (t) { if (t.classList.contains('is-active')) active = t.getAttribute('data-pane'); });
    if (active === 'dm' && token() && state.tableOk === true) loadThreads();
  });

  window.TAFEI = window.TAFEI || {};
  window.TAFEI.inbox = {
    reload: function () { loadSystem(); loadNotice(); dmLoaded = false; loadDm(); },
    openPane: function (name) {
      if (!panes[name]) name = 'system';
      switchPane(name);
      var info = document.getElementById('info');
      if (info) info.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
})();
