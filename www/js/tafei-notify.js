/* TAFEI · 站内消息通知：系统通知 / 站内公告 / 私信有新内容时，调用原生通知栏提醒 */
(function () {
  'use strict';
  var NATIVE = window.TafeiNative;
  if (!NATIVE || typeof NATIVE.notifyMessage !== 'function') return;
  if (window.__tafeiNotify) return;
  window.__tafeiNotify = true;

  var API = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1';
  var KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  var AUTH = 'tafei-auth-session';
  var SEEN_KEY = 'tafei-notified-ids';
  var ASKED_KEY = 'tafei-notify-asked';
  var INTERVAL = 3 * 60 * 1000;
  var booted = false;

  function loadSeen() {
    try {
      var v = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
      return v && typeof v === 'object' ? v : {};
    } catch (e) { return {}; }
  }
  var seen = loadSeen();

  function saveSeen() {
    try {
      var keys = Object.keys(seen);
      if (keys.length > 260) {
        keys.slice(0, keys.length - 260).forEach(function (k) { delete seen[k]; });
      }
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch (e) {}
  }

  function push(title, body, page, key, silent) {
    if (!key) return;
    if (seen[key]) return;
    seen[key] = Date.now();
    saveSeen();
    if (silent) return;
    try {
      NATIVE.notifyMessage(title, body, page || 'community');
    } catch (e) {}
  }

  function trim(s, n) {
    var t = String(s == null ? '' : s).replace(/[#>*`]/g, '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  function session() {
    try { return JSON.parse(localStorage.getItem(AUTH) || 'null'); } catch (e) { return null; }
  }

  async function scanNotices(silent) {
    try {
      var res = await fetch('data/notices.json', { cache: 'no-store' });
      if (!res.ok) return;
      var data = await res.json();
      (data.items || []).forEach(function (n) {
        push('系统通知 · ' + trim(n.title, 30), trim(n.body, 110), 'community', 'sys:' + n.id, silent);
      });
    } catch (e) {}
  }

  async function scanAnnouncements(silent) {
    try {
      var res = await fetch(API + '/tafei_announcements?select=id,title,content,created_at&order=created_at.desc&limit=6', {
        headers: { apikey: KEY }
      });
      if (!res.ok) return;
      var rows = await res.json();
      (rows || []).forEach(function (a) {
        push('站内公告 · ' + trim(a.title, 30), trim(a.content, 110), 'community', 'ann:' + a.id, silent);
      });
    } catch (e) {}
  }

  async function scanMessages(silent) {
    var s = session();
    if (!s || !s.access_token || !s.user || !s.user.id) return;
    try {
      var res = await fetch(API + '/tafei_messages?recipient_id=eq.' + encodeURIComponent(s.user.id)
        + '&read_at=is.null&select=id,sender_id,body,created_at&order=created_at.desc&limit=5', {
        headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token }
      });
      if (!res.ok) return;
      var rows = await res.json();
      (rows || []).forEach(function (m) {
        push('新私信', trim(m.body, 110), 'community', 'dm:' + m.id, silent);
      });
    } catch (e) {}
  }

  function check() {
    if (document.visibilityState === 'hidden') return;
    scanNotices(booted);
    scanAnnouncements(booted);
    scanMessages(booted);
    booted = true;
  }

  /* 首次进 App 申请一次通知权限 */
  if (!localStorage.getItem(ASKED_KEY)) {
    try { localStorage.setItem(ASKED_KEY, '1'); } catch (e) {}
    setTimeout(function () {
      try { NATIVE.requestNotifyPermission(); } catch (e) {}
    }, 1800);
  }

  setTimeout(check, 2500);
  setInterval(check, INTERVAL);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') check();
  });
})();
