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

  var root = document.getElementById('tf3Inbox');
  if (!root) return;

  var state = {
    notices: [], announce: [], announceError: null,
    threads: [], profiles: [], profilesLoaded: false,
    tableOk: null, dmLoading: false, msgs: [], peer: null, dmView: 'list', busy: false
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

  function headers(extra) {
    var h = { apikey: KEY };
    var t = token();
    if (t) h.Authorization = 'Bearer ' + t;
    if (extra) { for (var k in extra) h[k] = extra[k]; }
    return h;
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

    if (state.tableOk !== true) {
      box.innerHTML = setupCard();
      wireSetup();
      return;
    }
    if (!token()) {
      box.innerHTML = '<div class="tf3-empty">登录后才能收发私信。<br>未登录也可以正常浏览其他内容。'
        + '<br><button type="button" class="tf3-cta" data-role="go-login">去登录 / 注册</button></div>';
      var btn = $('[data-role="go-login"]', box);
      if (btn) btn.addEventListener('click', function () {
        var link = document.querySelector('[data-view="profile"]');
        if (link) link.click();
      });
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
      + '</div>';
  }

  function wireSetup() {
    var btn = $('[data-role="copy-sql"]', dmBox());
    if (!btn) return;
    btn.addEventListener('click', function () {
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
    var p = (state.profiles || []).filter(function (x) { return x.id === id; })[0];
    if (p && p.nickname) return p.nickname;
    return '成员 ' + String(id || '').slice(0, 6);
  }
  function initial(name) { return String(name || '?').trim().slice(0, 1).toUpperCase(); }

  function listView() {
    var threads = state.threads || [];
    var head = '<div class="tf3-dmhead"><h4>我的会话</h4>'
      + '<button type="button" class="tf3-newbtn" data-role="new-dm">写新私信</button></div>';
    if (state.dmLoading) return head + '<div class="tf3-hint">正在读取私信…</div>';
    if (!threads.length) {
      return head + '<div class="tf3-empty">还没有私信。<br>点右上角「写新私信」给社区成员发第一条消息。</div>';
    }
    var html = head;
    threads.forEach(function (t) {
      var name = peerName(t.peer);
      html += '<button type="button" class="tf3-thread" data-role="open-thread" data-peer="' + esc(t.peer) + '">'
        + '<span class="tf3-avatar">' + esc(initial(name)) + '</span>'
        + '<span class="tf3-thread-main"><span class="tf3-thread-name">' + esc(name)
        + (t.unread ? ' <span class="tf3-unread">' + t.unread + '</span>' : '') + '</span>'
        + '<span class="tf3-thread-last">' + esc((t.mine ? '我：' : '') + norm(t.last.body).slice(0, 40)) + '</span></span>'
        + '<span class="tf3-thread-side">' + esc(fmtTime(t.last.created_at)) + '</span>'
        + '</button>';
    });
    return html;
  }

  function threadView() {
    var name = peerName(state.peer);
    var html = '<div class="tf3-threadhead"><button type="button" class="tf3-back" data-role="back-list">← 会话列表</button>'
      + '<strong>' + esc(name) + '</strong></div>';
    html += '<div class="tf3-msgs" id="tf3Msgs">';
    if (state.dmLoading) {
      html += '<div class="tf3-hint">正在读取消息…</div>';
    } else if (!state.msgs.length) {
      html += '<div class="tf3-hint">还没有消息，说点什么吧。</div>';
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
    var profiles = (state.profiles || []).filter(function (p) { return p.id !== meId(); });
    var head = '<div class="tf3-threadhead"><button type="button" class="tf3-back" data-role="back-list">← 会话列表</button>'
      + '<strong>新私信</strong></div>';
    if (!profiles.length) {
      return head + '<div class="tf3-empty">还没有可发信的对象。<br>等更多成员注册后就能互发私信了。</div>';
    }
    var opts = profiles.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.nickname || p.id.slice(0, 6)) + '</option>';
    }).join('');
    return head + '<div class="tf3-form">'
      + '<label class="tf3-label" for="tf3Peer">发给谁</label>'
      + '<select class="tf3-select" id="tf3Peer">' + opts + '</select>'
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
    function doSend() { sendMessage(input && input.value, null, sendBtn, input); }
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
      renderDm();
    });
    var sendBtn = $('[data-role="send-new"]', root);
    var input = $('#tf3Input', root);
    var peerSel = $('#tf3Peer', root);
    if (sendBtn) sendBtn.addEventListener('click', function () {
      if (!peerSel) return;
      state.peer = peerSel.value;
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
    if (!peer) { status('请选择收件人。'); return; }
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
  window.TAFEI.inbox = { reload: function () { loadSystem(); loadNotice(); dmLoaded = false; loadDm(); } };
})();
