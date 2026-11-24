/* TAFEI 我的页 · 账号同步 + 问题反馈
   依赖统一登录态模块 tafei-session.js（app-shell 会先注入它）
   打开页面立刻校验本地会话：有效就显示已登录信息，失效自动续期，续期失败回退未登录 */
(function () {
  'use strict';
  if (window.__tafeiMyAccount) return;
  window.__tafeiMyAccount = true;

  var REST = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1';
  var UID = '', TOKEN = '';

  var elAvatar = document.getElementById('avatar');
  var elNick = document.getElementById('nickname');
  var elMeta = document.getElementById('meta');
  var elStats = document.getElementById('statPost');
  var statDm = document.getElementById('statDm');
  var statCredit = document.getElementById('statCredit');
  if (!elAvatar || !elNick || !elMeta) return;

  var oldBtn = document.querySelector('.me-btn');
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'me-btn';
  btn.id = 'mcAuthBtn';
  if (oldBtn && oldBtn.parentNode) {
    oldBtn.parentNode.replaceChild(btn, oldBtn);
  } else {
    elAvatar.parentNode.appendChild(btn);
  }

  var img = document.createElement('img');
  img.alt = '';
  img.hidden = true;
  img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
  if (getComputedStyle(elAvatar).position === 'static') elAvatar.style.position = 'relative';
  elAvatar.style.overflow = 'hidden';
  elAvatar.appendChild(img);

  /* 样式：反馈面板与提示 */
  var style = document.createElement('style');
  style.textContent = [
    '.mc-mask{position:fixed;inset:0;background:rgba(3,7,16,.6);opacity:0;pointer-events:none;transition:opacity .2s;z-index:9998}',
    '.mc-mask.on{opacity:1;pointer-events:auto}',
    '.mc-sheet{position:fixed;left:0;right:0;bottom:0;transform:translateY(100%);transition:transform .22s ease;z-index:9999;',
    'background:#0d1526;border-top:1px solid rgba(130,170,255,.3);border-radius:20px 20px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom));',
    'color:#eef4ff;font:15px/1.6 -apple-system,"PingFang SC",sans-serif}',
    '.mc-sheet.on{transform:translateY(0)}',
    '.light .mc-sheet{background:#fff;color:#16233c}',
    '.mc-sheet h3{margin:0 0 4px;font-size:15px}',
    '.mc-sheet p{margin:0 0 12px;font-size:11.5px;color:#9aaccb}',
    '.light .mc-sheet p{color:#5f7291}',
    '.mc-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:13px 14px;margin-bottom:10px;cursor:pointer;',
    'border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(130,170,255,.22);color:inherit}',
    '.mc-row .g{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;font-weight:900;font-size:13px;color:#06101f;',
    'background:linear-gradient(120deg,#53ddff,#728cff)}',
    '.mc-row b{display:block;font-size:13.5px}',
    '.mc-row small{display:block;font-size:11px;color:#9aaccb;margin-top:2px}',
    '.mc-close{width:100%;padding:12px;border-radius:13px;border:1px solid rgba(130,170,255,.28);background:transparent;color:#9aaccb;cursor:pointer}',
    '.mc-toast{position:fixed;left:50%;bottom:calc(110px + env(safe-area-inset-bottom));transform:translateX(-50%);max-width:80vw;',
    'padding:10px 16px;border-radius:12px;background:rgba(10,18,34,.96);border:1px solid rgba(130,170,255,.34);color:#eef4ff;',
    'font:13px/1.5 -apple-system,"PingFang SC",sans-serif;opacity:0;transition:opacity .2s;pointer-events:none;z-index:100000;text-align:center}',
    '.mc-toast.on{opacity:1}'
  ].join('');
  document.head.appendChild(style);

  var toastEl = document.createElement('div');
  toastEl.className = 'mc-toast';
  document.body.appendChild(toastEl);
  var toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2400);
  }

  function S() { return window.TafeiSession || null; }

  function headers(token) {
    var key = (S() && S().apikey) || 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
    return { apikey: key, Authorization: 'Bearer ' + (token || key) };
  }

  function setAvatar(url, name) {
    if (url) {
      img.src = url;
      img.hidden = false;
      var t0 = elAvatar.firstChild;
      if (t0 && t0.nodeType === 3) t0.hidden = true;
    } else {
      img.hidden = true;
      img.removeAttribute('src');
      var t = elAvatar.firstChild;
      if (t && t.nodeType === 3) {
        t.textContent = String(name || '访').trim().slice(0, 1).toUpperCase() || '访';
        t.hidden = false;
      } else {
        elAvatar.insertBefore(document.createTextNode(String(name || '访').slice(0, 1)), elAvatar.firstChild);
      }
    }
  }

  function loggedOut() {
    UID = ''; TOKEN = '';
    elNick.textContent = '未登录';
    elMeta.textContent = '点右侧「立即登录」，登录后自动同步昵称、头像和额度';
    btn.textContent = '立即登录';
    btn.style.background = '';
    btn.style.color = '';
    btn.style.border = '';
    setAvatar('', '访');
    if (elStats) elStats.textContent = '—';
    if (statDm) statDm.textContent = '—';
    if (statCredit) statCredit.textContent = '—';
  }

  function loggedIn(session) {
    var user = (session && session.user) || {};
    var ss = S();
    UID = user.id || '';
    TOKEN = session.access_token || '';
    var name = ss ? ss.nickname(session) : (user.email || '').split('@')[0];
    elNick.textContent = name;
    elMeta.textContent = (user.email ? String(user.email) : '已登录') + ' · 账号已同步';
    btn.textContent = '退出登录';
    btn.style.background = 'transparent';
    btn.style.color = 'var(--muted)';
    btn.style.border = '1px solid rgba(130,170,255,.34)';
    var cached = ss ? ss.avatarCache(UID) : '';
    setAvatar(cached, name);
    loadAvatar(UID, name);
    loadStats();
  }

  function count(table, query) {
    return fetch(REST + '/' + table + '?select=id' + query, {
      headers: Object.assign(headers(TOKEN), { Prefer: 'count=exact', Range: '0-0' })
    }).then(function (r) {
      var cr = r.headers.get('content-range') || '';
      var n = cr.split('/')[1];
      return (n === undefined || n === '*') ? '—' : String(n);
    }).catch(function () { return '—'; });
  }

  function loadStats() {
    if (!UID || !TOKEN) return;
    count('tafei_posts', '&user_id=eq.' + encodeURIComponent(UID)).then(function (n) {
      if (elStats) elStats.textContent = n;
    });
    count('tafei_messages', '&recipient_id=eq.' + encodeURIComponent(UID) + '&read_at=is.null').then(function (n) {
      if (statDm) statDm.textContent = n;
      if (statDm && statDm.parentNode) {
        var label = statDm.parentNode.querySelector('span');
        if (label) label.textContent = '未读私信';
      }
    });
    fetch(REST + '/tafei_balance?select=current_amount&user_id=eq.' + encodeURIComponent(UID), { headers: headers(TOKEN) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!statCredit) return;
        if (!Array.isArray(rows) || !rows.length) { statCredit.textContent = '0'; return; }
        var v = Number(rows[0].current_amount);
        statCredit.textContent = isFinite(v) ? String(v) : '0';
      }).catch(function () { if (statCredit) statCredit.textContent = '—'; });
  }

  function loadAvatar(uid, name) {
    if (!uid || !TOKEN) return;
    fetch(REST + '/tafei_profiles?select=avatar_url&id=eq.' + encodeURIComponent(uid), { headers: headers(TOKEN) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        var url = Array.isArray(rows) && rows.length ? rows[0].avatar_url : '';
        if (!url) return;
        if (S()) S().avatarCache(uid, url);
        setAvatar(url, name);
      }).catch(function () {});
  }

  function sync() {
    var ss = S();
    if (!ss) { loggedOut(); return; }
    var local = ss.get();
    if (local) {
      loggedIn(local);
      ss.ensure().then(function (session) {
        if (session) loggedIn(session); else loggedOut();
      });
    } else {
      loggedOut();
      ss.ensure().then(function (session) { if (session) loggedIn(session); });
    }
  }

  var tries = 0;
  (function wait() {
    if (window.TafeiSession || tries > 40) { sync(); return; }
    tries++;
    setTimeout(wait, 50);
  })();

  function bindChange() {
    window.TafeiSession.onChange(function (session) {
      if (session) loggedIn(session); else loggedOut();
    });
  }
  if (window.TafeiSession) {
    bindChange();
  } else {
    var poll = setInterval(function () {
      if (window.TafeiSession) {
        clearInterval(poll);
        bindChange();
        sync();
      }
    }, 80);
  }

  btn.addEventListener('click', function () {
    if (UID) {
      if (S()) S().clear();
      loggedOut();
      toast('已退出登录，可在社区页重新登录');
      return;
    }
    location.href = 'index.html#community';
  });

  /* ---------- 问题反馈入口 ---------- */
  var listBox = null;
  var rows = document.querySelectorAll('.list .row');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === 'btnCheck') { listBox = rows[i].parentNode; break; }
  }

  if (listBox && !document.getElementById('mcFeedback')) {
    var fbRow = document.createElement('button');
    fbRow.type = 'button';
    fbRow.className = 'row';
    fbRow.id = 'mcFeedback';
    fbRow.style.cssText = 'width:100%;background:transparent;border:0;border-bottom:1px solid rgba(130,170,255,.12);color:inherit;text-align:left;font:inherit';
    fbRow.innerHTML = '<span class="l"><span class="dot">反</span><span>问题反馈</span></span>'
      + '<span class="r"><span>QQ / TG</span><span>›</span></span>';
    listBox.appendChild(fbRow);
  }

  var mask = document.createElement('div');
  mask.className = 'mc-mask';
  var sheet = document.createElement('div');
  sheet.className = 'mc-sheet';
  sheet.innerHTML = '<h3>问题反馈</h3><p>遇到 bug、提需求或需要售后，直接找我本人。</p>'
    + '<button class="mc-row" type="button" data-fb="qq"><span class="g">Q</span>'
    + '<span><b>QQ · 3659229103</b><small>点按复制号码并尝试打开 QQ 会话</small></span></button>'
    + '<button class="mc-row" type="button" data-fb="tg"><span class="g">T</span>'
    + '<span><b>Telegram · @piaopiaony</b><small>点按打开 t.me/piaopiaony</small></span></button>'
    + '<button class="mc-close" type="button">关闭</button>';
  document.body.appendChild(mask);
  document.body.appendChild(sheet);

  function openSheet() { mask.classList.add('on'); sheet.classList.add('on'); }
  function closeSheet() { mask.classList.remove('on'); sheet.classList.remove('on'); }

  if (document.getElementById('mcFeedback')) {
    document.getElementById('mcFeedback').addEventListener('click', openSheet);
  }
  mask.addEventListener('click', closeSheet);
  sheet.querySelector('.mc-close').addEventListener('click', closeSheet);

  function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); return true; }
    } catch (e) {}
    try {
      var t = document.createElement('textarea');
      t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(t);
      return ok;
    } catch (e2) { return false; }
  }

  sheet.addEventListener('click', function (e) {
    var row = e.target.closest ? e.target.closest('[data-fb]') : null;
    if (!row) return;
    var kind = row.getAttribute('data-fb');
    if (kind === 'qq') {
      var qq = '3659229103';
      var ok = copy(qq);
      toast(ok ? 'QQ 号已复制：' + qq : 'QQ 号：' + qq);
      setTimeout(function () {
        try { location.href = 'mqqwpa://im/chat?chat_type=wpa&uin=' + qq + '&version=1&src_type=web'; } catch (e) {}
      }, 400);
    } else {
      var url = 'https://t.me/piaopiaony';
      try {
        var w = window.open(url, '_blank');
        if (!w) location.href = url;
      } catch (e2) { location.href = url; }
    }
  });
})();
