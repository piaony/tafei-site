/* TAFEI 21.7：签到与每日任务（前端界面 + 全局事件上报） */
(function () {
  'use strict';

  const REST = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1';
  const KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  const AUTH_KEY = 'tafei-auth-session';

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const panel = $('taskCenter');
  const openBtn = $('communityTaskBtn');
  const closeBtn = $('taskCenterClose');
  const checkinBtn = $('taskCheckinBtn');
  const loginBtn = $('taskLoginBtn');
  const taskList = $('taskList');
  const taskWeek = $('taskWeek');
  const taskMsg = $('taskMsg');
  const taskStreak = $('taskStreak');
  const taskBalance = $('taskBalance');
  const taskHint = $('taskCheckinHint');
  const taskBadge = $('taskBadge');

  let state = null;
  let loading = false;
  let lastEmail = '__initial__';
  let warnedMissing = false;

  function session() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
    catch (e) { return null; }
  }

  function token() {
    return session()?.access_token || '';
  }

  function say(text, kind) {
    if (!taskMsg) return;
    taskMsg.textContent = text || '';
    taskMsg.className = 'task-msg' + (kind ? ' ' + kind : '');
  }

  function friendlyError(error) {
    const message = String(error?.message || error || '');
    if (error?.status === 401 || error?.status === 403 || /JWT|登录|401|403/i.test(message)) {
      return '登录状态已过期，请重新登录后再试。';
    }
    if (error?.status === 404 || /PGRST202|Could not find|function/i.test(message)) {
      const email = String(document.body.dataset.tafeiEmail || '').toLowerCase();
      return email === '3659229103@qq.com'
        ? '任务库还没启用。请站长先在 Supabase 执行 supabase/daily_tasks.sql。'
        : '任务中心正在准备中，稍后再来。';
    }
    return '任务中心暂时不可用：' + message;
  }

  async function rpc(name, body) {
    const accessToken = token();
    if (!accessToken) throw new Error('请先登录');
    const response = await fetch(REST + '/rpc/' + name, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!response.ok) {
      const error = new Error((data && (data.message || data.hint || data.details)) || ('请求失败 ' + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function shiftDate(value, days) {
    const parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return '';
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function localToday() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function weekdayOf(value) {
    const parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3) return '';
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return ['日', '一', '二', '三', '四', '五', '六'][date.getUTCDay()] || '';
  }

  function renderWeek(data) {
    if (!taskWeek) return;
    const today = (data && data.today) || localToday();
    let start = shiftDate(today, -6);
    let markedStart = '';
    let markedEnd = '';
    if (data && data.streak > 0) {
      markedEnd = data.checked_today ? today : (data.last_date || '');
      markedStart = markedEnd ? shiftDate(markedEnd, -(data.streak - 1)) : '';
    }

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = shiftDate(start, index);
      const on = !!(markedStart && date >= markedStart && date <= markedEnd);
      return '<div class="task-day' + (on ? ' on' : '') + (date === today ? ' today' : '') + '">'
        + '<span>周' + weekdayOf(date) + '</span><b>' + Number(date.slice(8, 10)) + '</b></div>';
    });
    taskWeek.innerHTML = days.join('');
  }

  function renderTaskCard(task) {
    const target = Number(task.target) || 1;
    const progress = Math.min(Number(task.progress) || 0, target);
    const percent = Math.max(0, Math.min(100, Math.round(progress / target * 100)));
    const claimed = !!task.claimed;
    const ready = !!task.ready && !claimed;
    let button;
    if (claimed) {
      button = '<button class="task-claim" type="button" disabled>' + (task.once ? '已完成' : '已领取') + '</button>';
    } else if (ready) {
      button = '<button class="task-claim" type="button" data-claim="' + esc(task.key) + '">领取 +' + Number(task.reward || 0) + '</button>';
    } else if (task.key === 'profile') {
      button = '<button class="task-claim" type="button" data-open-profile="1">去完善</button>';
    } else if (task.key === 'post') {
      button = '<button class="task-claim" type="button" data-open-help="1">去求助</button>';
    } else if (task.key === 'comment') {
      button = '<a class="task-claim task-link" href="#helpBoard" data-help-board="1">去回帖 · ' + progress + '/' + target + '</a>';
    } else if (task.key === 'device_view') {
      button = '<a class="task-claim task-link" href="device.html">去逛机型 · ' + progress + '/' + target + '</a>';
    } else {
      button = '<button class="task-claim" type="button" disabled>进度 ' + progress + '/' + target + '</button>';
    }
    return '<article class="task-card' + (ready ? ' ready' : '') + (claimed ? ' claimed' : '') + '">'
      + '<div class="task-card-top"><div class="task-card-title"><b>' + esc(task.title) + '</b>'
      + '<p>' + esc(task.description) + '</p></div>'
      + '<span class="task-reward">+' + Number(task.reward || 0) + '</span></div>'
      + '<div class="task-progress" aria-hidden="true"><i style="width:' + percent + '%"></i></div>'
      + '<div class="task-card-foot"><span>' + (task.once ? '一次性任务' : '每日重置') + '</span>' + button + '</div>'
      + '</article>';
  }

  function render(data) {
    if (!panel) return;
    state = data || state;
    const info = state || {};
    if (taskStreak) taskStreak.textContent = String(Number(info.streak) || 0);
    if (taskBalance) taskBalance.textContent = info.balance == null ? '—' : String(info.balance);
    if (taskHint) {
      if (info.checked_today) taskHint.textContent = '今天已签到，连续 ' + (Number(info.streak) || 0) + ' 天。';
      else if (info.streak) taskHint.textContent = '今天签到后连续 ' + (Number(info.streak) + 1) + ' 天。';
      else taskHint.textContent = '今天签到可得 1 额度。';
    }
    if (checkinBtn) {
      checkinBtn.disabled = !!info.checked_today;
      checkinBtn.textContent = info.checked_today ? '今天已签到' : '签到 +1';
    }
    if (loginBtn) loginBtn.hidden = true;
    renderWeek(state);
    if (taskList) {
      const tasks = Array.isArray(info.tasks) ? info.tasks : [];
      taskList.innerHTML = tasks.length
        ? tasks.map(renderTaskCard).join('')
        : '<p class="task-empty">任务配置为空，请站长检查 tafei_task_catalog。</p>';
    }
    updateBadge();
  }

  function renderLoggedOut() {
    if (!panel) return;
    state = null;
    if (taskStreak) taskStreak.textContent = '0';
    if (taskBalance) taskBalance.textContent = '—';
    if (taskHint) taskHint.textContent = '登录后开始签到';
    if (checkinBtn) {
      checkinBtn.disabled = true;
      checkinBtn.textContent = '签到 +1';
    }
    if (loginBtn) loginBtn.hidden = false;
    renderWeek(null);
    if (taskList) taskList.innerHTML = '<p class="task-empty">登录后查看今天的任务。</p>';
    say('登录后可签到、做任务、领额度。');
    updateBadge();
  }

  function updateBadge() {
    if (!taskBadge) return;
    const ready = state
      ? ((state.checked_today ? 0 : 1) + (state.tasks || []).filter((task) => task.ready).length)
      : 0;
    taskBadge.textContent = ready > 0 ? String(ready) : '';
    taskBadge.hidden = ready <= 0;
    if (openBtn) openBtn.classList.toggle('has-reward', ready > 0);
  }

  async function refreshStatus(silent) {
    if (!panel) return;
    if (!token()) {
      renderLoggedOut();
      return;
    }
    if (loading) return;
    loading = true;
    if (!silent) say('正在读取签到和任务…');
    try {
      const data = await rpc('tafei_task_status', {});
      render(data);
      if (!silent) say('');
    } catch (error) {
      console.warn('任务状态读取失败：', error);
      if (!silent || !panel.hidden) say(friendlyError(error), 'err');
      state = null;
      updateBadge();
    } finally {
      loading = false;
    }
  }

  async function doCheckin() {
    if (!checkinBtn) return;
    checkinBtn.disabled = true;
    checkinBtn.textContent = '签到中…';
    say('正在签到…');
    try {
      const result = await rpc('tafei_checkin', {});
      if (result && result.already) say('今天已经签到过了，明天再来。');
      else say('签到成功：+' + Number(result.total || 0) + ' 额度，连续 ' + Number(result.streak || 0) + ' 天。', 'ok');
      await refreshStatus(true);
    } catch (error) {
      say(friendlyError(error), 'err');
      checkinBtn.disabled = false;
      checkinBtn.textContent = '签到 +1';
    }
  }

  async function claimTask(key, button) {
    if (!key || !button) return;
    button.disabled = true;
    button.textContent = '领取中…';
    say('正在领取奖励…');
    try {
      const result = await rpc('tafei_claim_task', { p_task_key: key });
      if (result && result.already) say('这个任务今天已经领过了。');
      else say('领取成功：+' + Number(result.reward || 0) + ' 额度。', 'ok');
      await refreshStatus(true);
    } catch (error) {
      say(friendlyError(error), 'err');
      button.disabled = false;
      button.textContent = '领取';
    }
  }

  async function sendEvent(taskKey, eventKey) {
    if (!taskKey || !token()) return false;
    try {
      const result = await rpc('tafei_task_event', {
        p_task_key: taskKey,
        p_event_key: String(eventKey || '').slice(0, 80)
      });
      if (panel) refreshStatus(true);
      return !!result;
    } catch (error) {
      if (!warnedMissing) {
        console.warn('任务事件上报失败：', error);
        warnedMissing = true;
      }
      return false;
    }
  }

  window.TAFEI_TASKS = {
    event: sendEvent,
    refresh: refreshStatus
  };

  function setPanel(open) {
    if (!panel || !openBtn) return;
    panel.hidden = !open;
    openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) return;
    if (window.TAFEIViews) window.TAFEIViews.showPage('community');
    if (token()) refreshStatus(false);
    else renderLoggedOut();
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  if (openBtn) openBtn.addEventListener('click', () => setPanel(panel ? panel.hidden : true));
  if (closeBtn) closeBtn.addEventListener('click', () => setPanel(false));
  if (checkinBtn) checkinBtn.addEventListener('click', doCheckin);
  if (loginBtn) loginBtn.addEventListener('click', () => {
    const toggle = document.getElementById('communityProfileToggle');
    if (toggle) toggle.click();
  });
  if (taskList) {
    taskList.addEventListener('click', (event) => {
      const claim = event.target.closest('[data-claim]');
      if (claim) {
        claimTask(claim.getAttribute('data-claim'), claim);
        return;
      }
      if (event.target.closest('[data-open-profile]')) {
        const toggle = document.getElementById('communityProfileToggle');
        if (toggle) toggle.click();
        return;
      }
      if (event.target.closest('[data-open-help]')) {
        const fab = document.getElementById('helpFab');
        if (fab) fab.click();
      }
    });
  }

  function checkAuth() {
    if (!panel) return;
    const email = String(document.body.dataset.tafeiEmail || '').toLowerCase();
    if (email === lastEmail) return;
    lastEmail = email;
    if (email && token()) refreshStatus(true);
    else renderLoggedOut();
  }

  if (panel) {
    renderWeek(null);
    setTimeout(checkAuth, 700);
    setTimeout(checkAuth, 1800);
    new MutationObserver(checkAuth).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-tafei-email']
    });
  }
})();
