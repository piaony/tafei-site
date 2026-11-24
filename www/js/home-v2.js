/* TAFEI 首页 v34 · 首屏账号卡
   读取统一登录态（tafei-session.js），有会话就渲染头像、昵称、额度、帖子与未读私信；
   没有会话时保持"未登录 + 立即登录"，点按直达社区登录。 */
(function () {
  'use strict';

  var REST = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1';
  var APIKEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';

  var el = {};
  var lastSession = null;

  function greet() {
    var h = new Date().getHours();
    if (h < 5) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function count(table, filter) {
    return fetch(REST + '/' + table + '?' + filter + '&select=id', {
      method: 'HEAD',
      headers: { apikey: APIKEY, Authorization: 'Bearer ' + lastSession.access_token, Prefer: 'count=exact', Range: '0-0' }
    }).then(function (r) {
      var cr = r.headers.get('content-range') || '';
      var n = parseInt(String(cr).split('/')[1], 10);
      return isFinite(n) ? n : 0;
    }).catch(function () { return null; });
  }

  function balance(uid) {
    return fetch(REST + '/tafei_balance?user_id=eq.' + encodeURIComponent(uid) + '&select=current_amount', {
      headers: { apikey: APIKEY, Authorization: 'Bearer ' + lastSession.access_token }
    }).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (!rows || !rows.length) return 0;
        var v = Number(rows[0].current_amount);
        return isFinite(v) ? v : 0;
      }).catch(function () { return null; });
  }

  function setMetric(name, value) {
    var node = el[name];
    if (!node) return;
    node.textContent = (value === null || typeof value === 'undefined') ? '—' : String(value);
  }

  function renderLoggedOut() {
    if (el.ava) { el.ava.innerHTML = '访'; }
    if (el.hi) el.hi.textContent = greet() + '，欢迎来挞飞';
    if (el.sub) el.sub.textContent = '未登录 · 登录后同步数据';
    if (el.act) {
      el.act.textContent = '立即登录';
      el.act.classList.remove('ghost');
      el.act.setAttribute('href', 'index.html#community');
      el.act.setAttribute('target', '_self');
    }
    setMetric('bal', '—'); setMetric('post', '—'); setMetric('dm', '—');
    if (el.acc) el.acc.removeAttribute('data-on');
  }

  function renderLoggedIn(session) {
    var user = (session && session.user) || {};
    var name = (window.TafeiSession && TafeiSession.nickname(session)) || '挞飞用户';
    var uid = user.id || '';
    var avatar = (window.TafeiSession && TafeiSession.avatarCache(uid)) || '';

    if (el.ava) {
      if (avatar) {
        el.ava.innerHTML = '<img alt="' + name.replace(/"/g, '') + '" src="' + avatar + '">';
      } else {
        el.ava.textContent = name.slice(0, 1).toUpperCase();
      }
    }
    if (el.hi) el.hi.textContent = greet() + '，' + name;
    if (el.sub) el.sub.textContent = (user.email || '账号已登录') + ' · 已同步';
    if (el.act) {
      el.act.textContent = '个人中心';
      el.act.classList.add('ghost');
      el.act.setAttribute('href', 'my.html');
    }
    if (el.acc) el.acc.setAttribute('data-on', '1');

    balance(uid).then(function (v) { setMetric('bal', v); });
    count('tafei_posts', 'user_id=eq.' + encodeURIComponent(uid)).then(function (v) { setMetric('post', v); });
    count('tafei_messages', 'recipient_id=eq.' + encodeURIComponent(uid) + '&read_at=is.null').then(function (v) { setMetric('dm', v); });
  }

  function pick() {
    el.acc = document.getElementById('hvAcc');
    el.ava = document.getElementById('hvAva');
    el.hi = document.getElementById('hvHi');
    el.sub = document.getElementById('hvSub');
    el.act = document.getElementById('hvAct');
    el.bal = document.getElementById('hvBal');
    el.post = document.getElementById('hvPost');
    el.dm = document.getElementById('hvDm');
  }

  function refresh() {
    var S = window.TafeiSession;
    if (!S) { renderLoggedOut(); return; }
    var raw = S.get();
    if (!raw || !raw.access_token) { lastSession = null; renderLoggedOut(); return; }
    lastSession = raw;
    renderLoggedIn(raw);
    S.ensure().then(function (session) {
      if (!session) { lastSession = null; renderLoggedOut(); return; }
      lastSession = session;
      renderLoggedIn(session);
    }).catch(function () {});
  }

  function boot() {
    pick();
    if (!el.acc) return;
    var tries = 0;
    (function wait() {
      if (!window.TafeiSession && tries < 8) { tries++; setTimeout(wait, 250); return; }
      refresh();
      if (window.TafeiSession && TafeiSession.onChange) {
        TafeiSession.onChange(function () { refresh(); });
      }
      /* 兜底：从社区页登录回来（hashchange）时再校验一次 */
      window.addEventListener('hashchange', function () { refresh(); });
      setTimeout(refresh, 900);
    })();
  }

  window.TafeiHome = { refresh: refresh };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
