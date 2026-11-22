(function () {
  'use strict';

  var KEY = 'tafei-pet-v1';
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (n, min, max) { return Math.max(min, Math.min(max, n)); };
  var todayKey = function () {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  var DEFAULT = {
    version: 1,
    bond: 0,
    care: { mood: 80, hunger: 70, energy: 80 },
    daily: { date: '', pet: false, feed: false, play: false },
    lastSeen: 0
  };

  var state = load();
  var forcedMood = '';
  var moodTimer = 0;
  var speechTimer = 0;
  var actionTimer = 0;
  var lastActionAt = 0;

  var panel = $('petPanel');
  var button = $('communityPetBtn');
  var mini = $('miniPet');
  var speech = $('petMiniSpeech');
  var status = $('petStatus');
  var badge = $('petBadge');

  function load() {
    var next = JSON.parse(JSON.stringify(DEFAULT));
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved) {
          next.bond = Number(saved.bond) || 0;
          if (saved.care) {
            next.care.mood = Number(saved.care.mood);
            next.care.hunger = Number(saved.care.hunger);
            next.care.energy = Number(saved.care.energy);
          }
          if (saved.daily && saved.daily.date) next.daily = saved.daily;
          next.lastSeen = Number(saved.lastSeen) || 0;
        }
      }
    } catch (error) {
      console.warn('魔法伙伴读取存档失败', error);
    }
    next.care.mood = clamp(next.care.mood || 80, 0, 100);
    next.care.hunger = clamp(next.care.hunger || 70, 0, 100);
    next.care.energy = clamp(next.care.energy || 80, 0, 100);
    if (next.daily.date !== todayKey()) {
      next.daily = { date: todayKey(), pet: false, feed: false, play: false };
    }
    return next;
  }

  function save() {
    try {
      state.lastSeen = Date.now();
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('魔法伙伴保存失败', error);
    }
  }

  function decay() {
    if (!state.lastSeen) return;
    var hours = (Date.now() - state.lastSeen) / 3600000;
    if (hours < 1.5) return;
    var steps = Math.min(10, Math.floor(hours));
    state.care.hunger = clamp(state.care.hunger - steps * 1.4, 0, 100);
    state.care.energy = clamp(state.care.energy - steps * 1.1, 0, 100);
    state.care.mood = clamp(state.care.mood - steps * 0.7, 0, 100);
  }

  function autoMood() {
    if (state.care.energy < 22) return 'sleepy';
    if (state.care.hunger < 26) return 'hungry';
    return 'happy';
  }

  function idleLine() {
    if (state.care.energy < 22) return '小挞有点困了，想靠一会儿。';
    if (state.care.hunger < 26) return '小挞的星糖罐空了。';
    return '今天也来看看小挞吗？';
  }

  function refreshMood() {
    if (mini) mini.dataset.mood = forcedMood || autoMood();
  }

  function forceMood(mood, hold) {
    forcedMood = mood;
    refreshMood();
    clearTimeout(moodTimer);
    moodTimer = setTimeout(function () {
      forcedMood = '';
      refreshMood();
    }, hold || 2200);
  }

  function actionAnim(name) {
    if (!mini) return;
    mini.dataset.action = name;
    clearTimeout(actionTimer);
    actionTimer = setTimeout(function () { mini.dataset.action = ''; }, 700);
  }

  function speak(text, hold) {
    if (!speech) return;
    speech.textContent = text;
    clearTimeout(speechTimer);
    speechTimer = setTimeout(function () { speech.textContent = idleLine(); }, hold || 3000);
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function level() {
    return Math.floor(state.bond / 5) + 1;
  }

  function dailyDone() {
    return [state.daily.pet, state.daily.feed, state.daily.play].filter(Boolean).length;
  }

  function markDaily(key) {
    state.daily[key] = true;
  }

  function render() {
    if (!mini) return;
    mini.dataset.outfit = state.bond >= 6 ? 'moon' : state.bond >= 3 ? 'sakura' : 'starlight';
    refreshMood();

    var mood = clamp(state.care.mood, 0, 100);
    var hunger = clamp(state.care.hunger, 0, 100);
    var energy = clamp(state.care.energy, 0, 100);
    setText('petMoodVal', Math.round(mood));
    setText('petHungerVal', Math.round(hunger));
    setText('petEnergyVal', Math.round(energy));
    setBar('petMoodBar', mood);
    setBar('petHungerBar', hunger);
    setBar('petEnergyBar', energy);

    setText('petBond', state.bond);
    setText('petLevel', 'Lv.' + level());
    var need = 5 - (state.bond % 5);
    setText('petBondHint', '再互动 ' + need + ' 次升级');

    var done = dailyDone();
    if (badge) {
      var left = 3 - done;
      badge.hidden = left <= 0;
      badge.textContent = left > 0 ? String(left) : '';
    }
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = String(value);
  }

  function setBar(id, value) {
    var el = $(id);
    if (el) el.style.width = clamp(value, 0, 100) + '%';
  }

  function canAct() {
    var now = Date.now();
    if (now - lastActionAt < 700) return false;
    lastActionAt = now;
    return true;
  }

  function doPet() {
    if (!canAct()) return;
    actionAnim('pet');
    forceMood('happy', 2100);
    if (!state.daily.pet) {
      state.bond += 1;
      state.care.mood = clamp(state.care.mood + 4, 0, 100);
      state.care.energy = clamp(state.care.energy - 1, 0, 100);
      markDaily('pet');
      speak('唔，小挞的魔法帽都歪了。');
      setStatus('亲密度 +1 · 今日第一次互动');
    } else {
      state.care.mood = clamp(state.care.mood + 1, 0, 100);
      speak('今天已经摸过一次啦，再摸摸也很开心。');
      setStatus('今天已经摸过小挞了');
    }
    save();
    render();
  }

  function doFeed() {
    if (!canAct()) return;
    actionAnim('feed');
    forceMood('happy', 2100);
    if (state.care.hunger >= 98) {
      speak('小挞已经吃得饱饱的了。');
      setStatus('饱食度已满');
      return;
    }
    state.care.hunger = clamp(state.care.hunger + 16, 0, 100);
    if (!state.daily.feed) {
      state.bond += 1;
      markDaily('feed');
      speak('星糖是草莓味的，饱腹感回来了。');
      setStatus('饱食度 +16 · 亲密度 +1');
    } else {
      speak('再吃一颗也装得下。');
      setStatus('饱食度 +16');
    }
    save();
    render();
  }

  function doPlay() {
    if (!canAct()) return;
    if (state.care.energy < 18) {
      actionAnim('feed');
      forceMood('sleepy', 2400);
      speak('体力不太够，先让小挞睡一会儿。');
      setStatus('体力不足，先休息');
      return;
    }
    actionAnim('play');
    forceMood('happy', 2100);
    state.care.energy = clamp(state.care.energy - 8, 0, 100);
    state.care.mood = clamp(state.care.mood + 8, 0, 100);
    if (!state.daily.play) {
      state.bond += 2;
      markDaily('play');
      speak('接住这颗星光！再来一次——');
      setStatus('心情 +8 · 亲密度 +2');
    } else {
      speak('和你玩多少次都不会腻。');
      setStatus('心情 +8 · 体力 -8');
    }
    save();
    render();
  }

  function openPanel() {
    if (!panel) return;
    var taskPanel = $('taskCenter');
    var taskBtn = $('communityTaskBtn');
    if (taskPanel) taskPanel.hidden = true;
    if (taskBtn) taskBtn.setAttribute('aria-expanded', 'false');
    panel.hidden = false;
    document.body.classList.add('pet-panel-open');
    if (button) button.setAttribute('aria-expanded', 'true');
    refreshMood();
    if (panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    document.body.classList.remove('pet-panel-open');
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (!panel) return;
    if (panel.hidden) openPanel();
    else closePanel();
  }

  function bind() {
    if (button) button.addEventListener('click', togglePanel);
    if ($('petPanelClose')) $('petPanelClose').addEventListener('click', closePanel);
    if ($('communityTaskBtn')) {
      $('communityTaskBtn').addEventListener('click', function () {
        if (panel) panel.hidden = true;
        document.body.classList.remove('pet-panel-open');
        if (button) button.setAttribute('aria-expanded', 'false');
      });
    }
    if ($('petPetBtn')) $('petPetBtn').addEventListener('click', doPet);
    if ($('petFeedBtn')) $('petFeedBtn').addEventListener('click', doFeed);
    if ($('petPlayBtn')) $('petPlayBtn').addEventListener('click', doPlay);
    if (mini) mini.addEventListener('click', doPet);
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') save();
    });
  }

  function init() {
    decay();
    bind();
    render();
    if (speech) speech.textContent = idleLine();
    save();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
