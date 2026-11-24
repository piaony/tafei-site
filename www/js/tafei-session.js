/* TAFEI 统一登录态入口 · 全站共用
   同一份 localStorage 键 tafei-auth-session，任何页面都通过这里读取、续期、监听变化
   社区页登录后本模块会收到 storage 事件，我的页随即刷新 */
(function () {
  'use strict';

  var KEY = 'tafei-auth-session';
  var ORIGIN = 'https://kwkewmhmxyjmzdjyutwa.supabase.co';
  var APIKEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  var AVATAR_CACHE = 'tafei-avatar-cache';

  function readRaw() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }

  function save(session) {
    try { localStorage.setItem(KEY, JSON.stringify(session)); } catch (e) {}
  }

  function isStale(session) {
    if (!session || !session.access_token) return true;
    return !!(session.expires_at && session.expires_at * 1000 <= Date.now() + 60000);
  }

  function refresh(session) {
    if (!session || !session.refresh_token) return Promise.resolve(null);
    return fetch(ORIGIN + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: APIKEY },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(function (r) {
      if (!r.ok) return null;
      return r.json().then(function (d) {
        if (!d || !d.access_token) return null;
        var next = {
          access_token: d.access_token,
          refresh_token: d.refresh_token || session.refresh_token,
          expires_at: d.expires_at,
          token_type: d.token_type || 'bearer',
          user: d.user || session.user
        };
        save(next);
        return next;
      });
    }).catch(function () { return null; });
  }

  /* 读取并确保会话可用：过期自动续期，再拉一次最新用户资料 */
  function ensure() {
    var session = readRaw();
    if (!session) return Promise.resolve(null);
    var p = isStale(session) ? refresh(session) : Promise.resolve(session);
    return p.then(function (s) {
      if (!s) return null;
      return fetch(ORIGIN + '/auth/v1/user', {
        headers: { apikey: APIKEY, Authorization: 'Bearer ' + s.access_token }
      }).then(function (r) {
        if (!r.ok) {
          if (r.status === 401) { clear(); return null; }
          return s;
        }
        return r.json().then(function (user) {
          var next = {
            access_token: s.access_token,
            refresh_token: s.refresh_token,
            expires_at: s.expires_at,
            token_type: s.token_type || 'bearer',
            user: user
          };
          save(next);
          return next;
        });
      }).catch(function () { return s; });
    });
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  function nickname(session) {
    var u = (session && session.user) || {};
    var meta = u.user_metadata || {};
    if (meta.nickname) return meta.nickname;
    if (u.email) return String(u.email).split('@')[0];
    return '挞飞用户';
  }

  function initial(name) {
    var s = String(name || '?').trim();
    return s ? s.slice(0, 1).toUpperCase() : '?';
  }

  function avatarCache(uid, url) {
    if (!uid) return '';
    try {
      var cache = JSON.parse(localStorage.getItem(AVATAR_CACHE) || '{}');
      if (typeof url === 'undefined') return cache[uid] || '';
      if (url) cache[uid] = url; else delete cache[uid];
      localStorage.setItem(AVATAR_CACHE, JSON.stringify(cache));
      return url || '';
    } catch (e) { return ''; }
  }

  function onChange(cb) {
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) cb(readRaw());
    });
    window.addEventListener('tafei-auth-changed', function () { cb(readRaw()); });
  }

  function broadcast() {
    try { window.dispatchEvent(new Event('tafei-auth-changed')); } catch (e) {}
  }

  window.TafeiSession = {
    key: KEY,
    origin: ORIGIN,
    apikey: APIKEY,
    get: readRaw,
    ensure: ensure,
    refresh: refresh,
    clear: clear,
    save: save,
    nickname: nickname,
    initial: initial,
    avatarCache: avatarCache,
    onChange: onChange,
    broadcast: broadcast,
    isStale: isStale
  };
})();
