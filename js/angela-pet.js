(function () {
  'use strict';

  var STORAGE_KEY = 'tafei-angela-v1';
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (n, min, max) { return Math.max(min, Math.min(max, n)); };
  var todayKey = function () {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  var DEFAULT_STATE = {
    version: 1,
    care: { mood: 80, hunger: 70, energy: 80 },
    bond: 0,
    coins: 0,
    outfit: 'starlight',
    daily: { date: '', pet: false, feed: false, play: false, claimed: false },
    muted: false,
    lastSeen: 0
  };

  var state = loadState();
  var forcedMood = '';
  var moodTimer = 0;
  var speechTimer = 0;
  var actionTimer = 0;
  var lastActionAt = 0;
  var audioCtx = null;

  var pet = $('angPet');
  var speech = $('angSpeech');
  var toastEl = $('angToast');
  var field = $('angGameField');
  var startOverlay = $('angGameStart');
  var startTitle = startOverlay ? startOverlay.querySelector('strong') : null;
  var startCopy = startOverlay ? startOverlay.querySelector('p') : null;
  var startBtn = $('angGameStartBtn');

  var game = { running: false, score: 0, time: 20, timer: 0, spawner: 0 };

  function loadState() {
    var next = JSON.parse(JSON.stringify(DEFAULT_STATE));
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          if (saved.care) {
            next.care.mood = Number(saved.care.mood);
            next.care.hunger = Number(saved.care.hunger);
            next.care.energy = Number(saved.care.energy);
          }
          next.bond = Number(saved.bond) || 0;
          next.coins = Number(saved.coins) || 0;
          next.outfit = saved.outfit || 'starlight';
          next.muted = !!saved.muted;
          next.lastSeen = Number(saved.lastSeen) || 0;
          if (saved.daily && saved.daily.date) next.daily = saved.daily;
        }
      }
    } catch (error) {
      console.warn('安琪拉小屋读取存档失败', error);
    }
    next.care.mood = clamp(next.care.mood || 80, 0, 100);
    next.care.hunger = clamp(next.care.hunger || 70, 0, 100);
    next.care.energy = clamp(next.care.energy || 80, 0, 100);
    if (['starlight', 'sakura', 'moon'].indexOf(next.outfit) === -1) next.outfit = 'starlight';
    if (next.daily.date !== todayKey()) {
      next.daily = { date: todayKey(), pet: false, feed: false, play: false, claimed: false };
    }
    return next;
  }

  function saveState() {
    try {
      state.lastSeen = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('安琪拉小屋保存失败', error);
    }
  }

  function applyOfflineDecay() {
    if (!state.lastSeen) return;
    var hours = (Date.now() - state.lastSeen) / 3600000;
    if (hours < 1.5) return;
    var steps = Math.min(12, Math.floor(hours));
    state.care.hunger = clamp(state.care.hunger - steps * 1.6, 0, 100);
    state.care.energy = clamp(state.care.energy - steps * 1.2, 0, 100);
    state.care.mood = clamp(state.care.mood - steps * 0.8, 0, 100);
  }

  function autoMood() {
    if (state.care.energy < 22) return 'sleepy';
    if (state.care.hunger < 26) return 'hungry';
    if (state.care.mood > 88) return 'love';
    return 'happy';
  }

  function idleLine() {
    if (state.care.energy < 22) return '有点困了，想睡一会儿…';
    if (state.care.hunger < 26) return '肚子咕咕叫，星糖在哪里？';
    if (state.care.mood > 88) return '今天心情超好！';
    return '今天也要一起收集星光吗？';
  }

  function refreshMood() {
    if (!pet) return;
    pet.dataset.mood = forcedMood || autoMood();
  }

  function forceMood(mood, hold) {
    forcedMood = mood;
    refreshMood();
    clearTimeout(moodTimer);
    moodTimer = setTimeout(function () {
      forcedMood = '';
      refreshMood();
    }, hold || 2300);
  }

  function actionAnim(name) {
    if (!pet) return;
    pet.dataset.action = name;
    clearTimeout(actionTimer);
    actionTimer = setTimeout(function () { pet.dataset.action = ''; }, 720);
  }

  function speak(text, hold) {
    if (!speech) return;
    speech.textContent = text;
    clearTimeout(speechTimer);
    speechTimer = setTimeout(function () { speech.textContent = idleLine(); }, hold || 3200);
  }

  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  function tone(freq, duration, type, delay, volume) {
    if (state.muted) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      var start = audioCtx.currentTime + (delay || 0);
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume || 0.06, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (duration || 0.18));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + (duration || 0.18) + 0.02);
    } catch (error) {
      /* audio is optional */
    }
  }

  function playSound(kind) {
    if (state.muted) return;
    if (kind === 'pet') {
      tone(660, 0.13, 'sine', 0, 0.045);
      tone(880, 0.16, 'sine', 0.08, 0.035);
    } else if (kind === 'feed') {
      tone(520, 0.12, 'triangle', 0, 0.05);
      tone(680, 0.15, 'triangle', 0.07, 0.04);
    } else if (kind === 'play') {
      tone(740, 0.1, 'square', 0, 0.025);
      tone(980, 0.14, 'square', 0.06, 0.02);
    } else if (kind === 'sleep') {
      tone(392, 0.22, 'sine', 0, 0.03);
      tone(330, 0.3, 'sine', 0.12, 0.025);
    } else if (kind === 'star') {
      tone(1040, 0.09, 'sine', 0, 0.03);
    } else if (kind === 'dress') {
      tone(600, 0.12, 'sine', 0, 0.035);
      tone(900, 0.18, 'sine', 0.08, 0.03);
    } else {
      tone(780, 0.18, 'sine', 0, 0.035);
    }
  }

  function burst(icon, count) {
    var stage = $('angStage');
    if (!stage) return;
    for (var i = 0; i < (count || 5); i++) {
      var span = document.createElement('span');
      span.className = 'ang-particle';
      span.textContent = icon || '✦';
      span.style.left = (44 + Math.random() * 12) + '%';
      span.style.top = (50 + Math.random() * 10) + '%';
      span.style.setProperty('--dx', (Math.random() * 130 - 65) + 'px');
      span.style.setProperty('--dy', (-50 - Math.random() * 90) + 'px');
      span.style.animationDelay = (Math.random() * 0.15) + 's';
      stage.appendChild(span);
      setTimeout(function () { span.remove(); }, 1200);
    }
  }

  function bondLevel() {
    return Math.floor(state.bond / 5) + 1;
  }

  function dailyCount() {
    return [state.daily.pet, state.daily.feed, state.daily.play].filter(Boolean).length;
  }

  function markDaily(key) {
    if (!state.daily[key]) state.daily[key] = true;
    if (dailyCount() === 3 && !state.daily.claimed) {
      state.daily.claimed = true;
      state.coins += 5;
      toast('今日三件事完成，额外 +5 星币');
      playSound('dress');
    }
  }

  function render() {
    if (!pet) return;
    pet.dataset.outfit = state.outfit;
    refreshMood();

    var mood = clamp(state.care.mood, 0, 100);
    var hunger = clamp(state.care.hunger, 0, 100);
    var energy = clamp(state.care.energy, 0, 100);

    setText('angMoodVal', Math.round(mood));
    setText('angHungerVal', Math.round(hunger));
    setText('angEnergyVal', Math.round(energy));
    setBar('angMoodBar', mood);
    setBar('angHungerBar', hunger);
    setBar('angEnergyBar', energy);

    setText('angBond', state.bond);
    setText('angBondSmall', state.bond);
    setText('angBondLevel', 'Lv.' + bondLevel());
    var need = 5 - (state.bond % 5);
    setText('angBondNext', '再互动 ' + need + ' 次升级');
    setText('angCoins', state.coins);

    var done = dailyCount();
    setText('angDailyDone', done);
    ['pet', 'feed', 'play'].forEach(function (key) {
      var item = document.querySelector('[data-daily="' + key + '"]');
      if (!item) return;
      var on = !!state.daily[key];
      item.classList.toggle('done', on);
      var tick = item.querySelector('.tick');
      if (tick) tick.textContent = on ? '✓' : '○';
    });

    renderWardrobe();
    renderSound();
    renderGameScore();
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = String(value);
  }

  function setBar(id, value) {
    var el = $(id);
    if (el) el.style.width = clamp(value, 0, 100) + '%';
  }

  function renderWardrobe() {
    var hint = $('angWardrobeHint');
    var unlocked = 0;
    document.querySelectorAll('.ang-outfit').forEach(function (btn) {
      var need = Number(btn.dataset.need) || 0;
      var locked = state.bond < need;
      btn.classList.toggle('locked', locked);
      btn.classList.toggle('active', state.outfit === btn.dataset.outfit);
      var lock = btn.querySelector('.lock');
      if (lock) lock.hidden = !locked;
      if (!locked) unlocked++;
    });
    if (hint) {
      if (unlocked >= 3) hint.textContent = '三套配色都解锁了，随时可以换。';
      else if (state.bond < 3) hint.textContent = '再摸摸她，亲密度到 3 解锁「樱花魔法」。';
      else hint.textContent = '「樱花魔法」已解锁，亲密度到 6 再解锁「月光星轨」。';
    }
  }

  function renderSound() {
    var btn = $('angSoundToggle');
    if (!btn) return;
    btn.textContent = state.muted ? '音效：关' : '音效：开';
    btn.setAttribute('aria-pressed', state.muted ? 'false' : 'true');
  }

  function renderGameScore() {
    setText('angGameScore', game.score || 0);
    setText('angGameScoreHud', game.score || 0);
    setText('angGameTime', game.time || 20);
  }

  function canAct() {
    var now = Date.now();
    if (now - lastActionAt < 750) return false;
    lastActionAt = now;
    return true;
  }

  function doPet() {
    if (!canAct()) return;
    actionAnim('pet');
    forceMood('love', 2200);
    burst('♥', 6);
    playSound('pet');
    if (state.daily.pet) {
      state.care.mood = clamp(state.care.mood + 1, 0, 100);
      speak('今天已经摸过一次啦，再摸摸也很开心。');
    } else {
      state.bond += 1;
      state.coins += 1;
      state.care.mood = clamp(state.care.mood + 4, 0, 100);
      state.care.energy = clamp(state.care.energy - 1, 0, 100);
      markDaily('pet');
      speak(['唔，好暖和。', '你今日的魔法能量，分你一点。', '再摸一下，我就把星星摘给你。'][Math.floor(Math.random() * 3)]);
    }
    saveState();
    render();
  }

  function doFeed() {
    if (!canAct()) return;
    if (state.care.hunger >= 98) {
      actionAnim('feed');
      forceMood('happy', 1800);
      speak('已经吃得饱饱的啦，星糖先收起来。');
      playSound('feed');
      return;
    }
    actionAnim('feed');
    forceMood('happy', 2200);
    burst('🍬', 5);
    playSound('feed');
    state.care.hunger = clamp(state.care.hunger + 16, 0, 100);
    if (state.daily.feed) {
      speak('星糖真甜，谢谢你。');
    } else {
      state.bond += 1;
      state.coins += 1;
      markDaily('feed');
      speak('星糖是草莓味的！饱腹感回来了。');
    }
    saveState();
    render();
  }

  function doPlay() {
    if (!canAct()) return;
    if (state.care.energy < 18) {
      actionAnim('sleep');
      forceMood('sleepy', 2500);
      speak('体力不太够，先让我睡一小会儿吧。');
      playSound('sleep');
      return;
    }
    actionAnim('play');
    forceMood('happy', 2200);
    burst('✦', 7);
    playSound('play');
    state.care.energy = clamp(state.care.energy - 8, 0, 100);
    state.care.mood = clamp(state.care.mood + 8, 0, 100);
    if (!state.daily.play) {
      state.bond += 2;
      state.coins += 2;
      markDaily('play');
      speak('接住这颗星光！再来一次——');
    } else {
      speak('和你玩多少次都不会腻。');
    }
    saveState();
    render();
  }

  function doSleep() {
    if (!canAct()) return;
    actionAnim('sleep');
    forceMood('sleepy', 2800);
    state.care.energy = clamp(state.care.energy + 28, 0, 100);
    state.care.mood = clamp(state.care.mood + 4, 0, 100);
    speak('晚安，做一个有星星的梦。');
    playSound('sleep');
    saveState();
    render();
  }

  function setOutfit(key) {
    var btn = document.querySelector('.ang-outfit[data-outfit="' + key + '"]');
    if (!btn) return;
    var need = Number(btn.dataset.need) || 0;
    if (state.bond < need) {
      forceMood('hungry', 1800);
      speak('亲密度到 ' + need + ' 才能解锁这套配色。');
      toast('还差 ' + (need - state.bond) + ' 点亲密度');
      return;
    }
    if (state.outfit === key) {
      speak('这套已经穿在身上啦。');
      return;
    }
    state.outfit = key;
    actionAnim('dress');
    forceMood('love', 2200);
    burst('✦', 8);
    playSound('dress');
    speak(key === 'sakura' ? '樱花魔法，变身！' : key === 'moon' ? '月光星轨，启动。' : '回到最初的星辉配色。');
    saveState();
    render();
  }

  function updateGameHud() {
    setText('angGameScore', game.score);
    setText('angGameScoreHud', game.score);
    setText('angGameTime', game.time);
  }

  function spawnStar() {
    if (!game.running || !field) return;
    var star = document.createElement('button');
    star.type = 'button';
    star.className = 'game-star';
    star.textContent = '✦';
    star.setAttribute('aria-label', '收集星光');
    star.style.left = (7 + Math.random() * 82) + '%';
    star.style.top = (18 + Math.random() * 64) + '%';
    star.style.fontSize = (20 + Math.random() * 10) + 'px';
    star.addEventListener('click', function () {
      if (!game.running) return;
      game.score += 1;
      updateGameHud();
      playSound('star');
      star.remove();
    });
    field.appendChild(star);
    setTimeout(function () { star.remove(); }, 1600);
  }

  function startGame() {
    if (game.running) return;
    game.running = true;
    game.score = 0;
    game.time = 20;
    field.innerHTML = '';
    if (startOverlay) startOverlay.hidden = true;
    updateGameHud();
    playSound('dress');
    var box = $('angGameBox');
    if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    game.timer = setInterval(function () {
      game.time -= 1;
      updateGameHud();
      if (game.time <= 0) endGame();
    }, 1000);
    game.spawner = setInterval(spawnStar, 480);
    spawnStar();
  }

  function endGame() {
    if (!game.running) return;
    game.running = false;
    clearInterval(game.timer);
    clearInterval(game.spawner);
    game.timer = 0;
    game.spawner = 0;
    if (field) field.innerHTML = '';
    if (startOverlay) {
      startOverlay.hidden = false;
      if (startTitle) startTitle.textContent = '收集完成';
      if (startCopy) startCopy.textContent = '本轮 ' + game.score + ' 分，星币 +' + game.score + '。继续挑战可以再快一点。';
      if (startBtn) startBtn.textContent = '再来一局';
    }
    state.coins += game.score;
    saveState();
    render();
    toast('本轮收集 ' + game.score + ' 颗星光，星币 +' + game.score);
    playSound('dress');
  }

  function initStars() {
    var fieldEl = $('angStarField');
    if (!fieldEl) return;
    for (var i = 0; i < 54; i++) {
      var dot = document.createElement('span');
      dot.style.left = (Math.random() * 100) + '%';
      dot.style.top = (Math.random() * 100) + '%';
      dot.style.animationDelay = (Math.random() * 6) + 's';
      dot.style.animationDuration = (3.5 + Math.random() * 5) + 's';
      dot.style.opacity = (0.12 + Math.random() * 0.6).toFixed(2);
      fieldEl.appendChild(dot);
    }
  }

  function bind() {
    if ($('angMainPetBtn')) $('angMainPetBtn').addEventListener('click', doPet);
    if ($('angTapHint')) $('angTapHint').addEventListener('click', doPet);
    if (pet) {
      pet.style.cursor = 'pointer';
      pet.addEventListener('click', doPet);
    }

    document.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.dataset.act;
        if (act === 'pet') doPet();
        else if (act === 'feed') doFeed();
        else if (act === 'play') doPlay();
        else if (act === 'sleep') doSleep();
        else if (act === 'game') startGame();
      });
    });

    document.querySelectorAll('.ang-outfit').forEach(function (btn) {
      btn.addEventListener('click', function () { setOutfit(btn.dataset.outfit); });
    });

    if ($('angSoundToggle')) {
      $('angSoundToggle').addEventListener('click', function () {
        state.muted = !state.muted;
        renderSound();
        saveState();
        if (!state.muted) playSound('pet');
      });
    }

    if (startBtn) startBtn.addEventListener('click', startGame);
    if ($('angGameStart')) {
      $('angGameStart').hidden = false;
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && game.running) endGame();
    });
    window.addEventListener('beforeunload', saveState);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') saveState();
    });

    if (new URLSearchParams(window.location.search).get('from') === 'tafei' && $('fromTafei')) {
      $('fromTafei').hidden = false;
    }
  }

  function init() {
    initStars();
    applyOfflineDecay();
    bind();
    render();
    speak(idleLine(), 0);
    saveState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
