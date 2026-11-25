/* TAFEI 精灵扩充 · 场景台词 / 点击互动 / 陪伴经验（v1）
   依赖 spirit-core.js（window.TafeiSpirits）与 spirit-widget.js（#spiritWidget）
   不改动原挂件逻辑，只在旁边补一层气泡与被动成长 */
(function () {
  'use strict';

  var SP = window.TafeiSpirits;
  if (!SP) return;

  var KEY = 'tafei-spirit-usage';
  var root = null, extra = null;
  var SPEECH = ['swSpeech', '#swSpeech'];

  var LINES = {
    greet: ['你来了，今天想先做哪件事？', '我一直在这儿，别急。', '刚刚把你上次的进度记住了。'],
    night: ['都快半夜了，早点睡吧。', '夜深了，明天的课还等着你呢。', '再刷十分钟就休息，好不好？'],
    click: ['诶？', '别戳我啦，痒。', '叫我做什么？', '今天心情不错嘛。', '你手气挺好。', '我在想晚饭吃什么。'],
    comfort: ['没事的，页面出个错而已。', '别慌，刷新一下就好。', '我陪你再试一次。'],
    growth: ['我们一起待了 %m 分钟，羁绊 +1。', '又靠近了一点，%m 分钟了。', '今天的陪伴也有记录哦。']
  };

  function loadUsage() {
    try {
      var raw = localStorage.getItem(KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (!o || o.day !== dayKey()) return { day: dayKey(), seconds: 0, gain: 0 };
      return o;
    } catch (e) { return { day: dayKey(), seconds: 0, gain: 0 }; }
  }

  function dayKey() { return (SP.todayKey && SP.todayKey()) || new Date().toDateString(); }

  function saveUsage(u) {
    try { localStorage.setItem(KEY, JSON.stringify(u)); } catch (e) {}
  }

  var usage = loadUsage();

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function speechBusy() {
    var s = document.getElementById('swSpeech');
    return !!(s && s.classList.contains('show'));
  }

  function ensureExtra() {
    root = document.getElementById('spiritWidget');
    if (!root) return false;
    if (!extra || !extra.parentNode) {
      extra = document.createElement('span');
      extra.id = 'swExtra';
      extra.setAttribute('aria-hidden', 'true');
      extra.style.cssText = 'position:absolute;left:50%;bottom:calc(100% - 2px);transform:translateX(-50%);'
        + 'width:max-content;max-width:min(210px,58vw);padding:7px 11px;border-radius:12px;font-size:11.5px;line-height:1.45;'
        + 'text-align:center;color:#eef4ff;background:rgba(13,26,48,.92);'
        + 'border:1px solid rgba(130,170,255,.38);box-shadow:0 8px 20px rgba(3,9,22,.42);'
        + 'opacity:0;transition:opacity .26s ease,transform .26s ease;pointer-events:none;z-index:5;'
        + 'white-space:normal;word-break:break-word';
      root.appendChild(extra);
    }
    return true;
  }

  var bubbleTimer = 0, pendingTimer = 0, bubbleTries = 0;
  function bubble(text, ms) {
    if (!text) return;
    if (!ensureExtra()) return;
    if (!root || root.hidden) return;
    if (speechBusy()) {
      /* 原生台词还在播，等它说完再插一句，最多等 8 轮 */
      if (bubbleTries >= 8) return;
      bubbleTries++;
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(function () { bubble(text, ms); }, 700);
      return;
    }
    bubbleTries = 0;
    extra.textContent = text;
    extra.style.opacity = '1';
    extra.style.transform = 'translateX(-50%) translateY(-4px)';
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      extra.style.opacity = '0';
      extra.style.transform = 'translateX(-50%)';
    }, ms || 3600);
  }

  function currentSpirit() {
    try {
      var s = SP.current && SP.current();
      return s || null;
    } catch (e) { return null; }
  }

  function spiritName() {
    var s = currentSpirit();
    return (s && (s.short || s.name)) || '伙伴';
  }

  /* ---------- 场景一：深夜提醒（原生开场白说完再补） ---------- */
  var nightDone = false, nightTries = 0;
  function nightTip() {
    if (nightDone) return;
    var h = new Date().getHours();
    if (h < 23 && h >= 5) { nightDone = true; return; }
    if (!root || root.hidden) { nightDone = true; return; }
    if (nightTries >= 12) { nightDone = true; return; }
    if (speechBusy()) { nightTries++; setTimeout(nightTip, 3500); return; }
    nightDone = true;
    bubble(pick(LINES.night), 4200);
  }

  /* ---------- 场景二：点击补一句 ---------- */
  function bindClick() {
    if (!root) return false;
    var body = root.querySelector('.sw-body');
    if (!body) return false;
    if (root.dataset.extraBound) return true;
    root.dataset.extraBound = '1';
    body.addEventListener('click', function () {
      if (Math.random() > 0.7) return;
      setTimeout(function () { bubble(pick(LINES.click), 3000); }, 900);
    });
  }

  /* ---------- 场景三：出错时安慰 ---------- */
  var comforts = 0;
  function comfort() {
    if (comforts >= 3) return;
    comforts++;
    setTimeout(function () { bubble(pick(LINES.comfort), 3000); }, 300);
  }
  window.addEventListener('error', comfort, true);
  window.addEventListener('unhandledrejection', comfort);

  /* ---------- 场景四：陪伴时长 → 羁绊 ---------- */
  var tick = 0;
  function heartbeat() {
    if (document.hidden) return;
    if (!nightDone) nightTip();
    usage.seconds += 1;
    tick += 1;
    if (tick >= 60) {
      tick = 0;
      saveUsage(usage);
    }
    if (usage.gain >= 4) return;
    if (usage.seconds % 900 !== 0) return;   /* 每 15 分钟一次，每天最多 4 次 */
    usage.gain += 1;
    saveUsage(usage);
    try {
      var s = currentSpirit();
      SP.adjustBond(s ? s.id : undefined, 1);
    } catch (e) {}
    bubble(pick(LINES.growth).replace('%m', '15'), 3600);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) saveUsage(usage);
  });

  var booted = false;
  function boot() {
    if (!ensureExtra()) {
      setTimeout(boot, 400);
      return;
    }
    if (!bindClick()) setTimeout(boot, 400);
    if (booted) return;
    booted = true;
    setTimeout(nightTip, 6000);
    setInterval(heartbeat, 1000);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 300);
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  }

  try { window.TafeiSpiritSay = bubble; } catch (e) {}

  /* 第二阶段：把成长引擎挂到有挂件的页面 */
  try {
    if (!window.TafeiGrowth && !document.querySelector('script[data-tf-growth]')) {
      var gr = document.createElement('script');
      gr.src = 'js/spirit-growth.js';
      gr.setAttribute('data-tf-growth', '1');
      document.head.appendChild(gr);
    }
    if (!window.TafeiStage3 && !document.querySelector('script[data-tf-stage3]')) {
      var st3 = document.createElement('script');
      st3.src = 'js/spirit-stage3.js';
      st3.setAttribute('data-tf-stage3', '1');
      document.head.appendChild(st3);
    }
  } catch (e) {}
})();
