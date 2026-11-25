/* TAFEI 精灵 · 第三阶段（v1）
   1) 默认伙伴固定为「瑶 · 时之祈愿」Q 版（不是原画还原款）
   2) 升级 / 领任务时的星光庆祝动画
   3) 按页面语境给一句贴合当下场景的提示 */
(function () {
  'use strict';

  var CORE = window.TafeiSpirits;
  if (!CORE) return;
  if (window.TafeiStage3) return;

  var SPIRIT = 'yao';
  var SKIN = 'yao-default';          /* Q 版「时之祈愿」，原画 yao-art 只作为可选皮肤 */

  /* ---------- 1. 默认形象 ---------- */
  function ensureDefault() {
    var st = CORE.state();
    if (st.selected) return;                 /* 已经选过伙伴的用户不动 */
    try {
      if (!CORE.isUnlocked(SPIRIT)) CORE.buySpirit(SPIRIT);
      CORE.selectSpirit(SPIRIT, SKIN);
      if (!st.widget.on) CORE.setWidget(true); /* 有了默认伙伴，就让她站在那儿 */
    } catch (e) {}
  }

  /* 若当前就是瑶，但皮肤被换成原画，又没有别的偏好，退回 Q 版 */
  function preferQ() {
    var st = CORE.state();
    if (st.selected !== SPIRIT) return;
    if (!st.selectedSkin) {
      try { CORE.selectSkin(SKIN); } catch (e) {}
    }
  }

  /* ---------- 2. 庆祝动画 ---------- */
  var CSS =
    '@keyframes swStarFly{0%{transform:translate(0,0) scale(.4);opacity:0}'
    + '25%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1.15);opacity:0}}'
    + '#swCelebrate{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none;z-index:9}'
    + '#swCelebrate i{position:absolute;left:0;top:0;width:7px;height:7px;border-radius:2px;'
    + 'background:linear-gradient(135deg,#bff3ff,#8fb4ff 60%,#d6b4ff);'
    + 'box-shadow:0 0 10px rgba(140,200,255,.9);animation:swStarFly 1.05s ease-out forwards}'
    + '#swCelebrate b{position:absolute;left:50%;top:-34px;transform:translateX(-50%);'
    + 'font:900 12px/1 -apple-system,"PingFang SC",sans-serif;color:#a8f0ff;white-space:nowrap;'
    + 'text-shadow:0 2px 10px rgba(6,20,40,.7)}';

  function injectCss() {
    if (document.querySelector('style[data-tf-stage3]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-tf-stage3', '1');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function celebrate(text) {
    var root = document.getElementById('spiritWidget');
    if (!root || root.hidden) return;
    injectCss();
    var old = document.getElementById('swCelebrate');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var wrap = document.createElement('span');
    wrap.id = 'swCelebrate';
    var bubbles = ['#bfefff', '#a9c2ff', '#d6b4ff', '#9ff0d6', '#ffe6a8'];
    for (var i = 0; i < 11; i++) {
      var star = document.createElement('i');
      var ang = (Math.PI * 2 * i) / 11 + Math.random() * 0.4;
      var dist = 42 + Math.random() * 46;
      star.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
      star.style.setProperty('--dy', (Math.sin(ang) * dist - 8).toFixed(0) + 'px');
      star.style.background = 'linear-gradient(135deg,' + bubbles[i % bubbles.length] + ',#8fb4ff)';
      star.style.animationDelay = (Math.random() * 0.14).toFixed(2) + 's';
      wrap.appendChild(star);
    }
    if (text) {
      var label = document.createElement('b');
      label.textContent = text;
      wrap.appendChild(label);
    }
    root.appendChild(wrap);
    root.classList.add('sw-bump');
    setTimeout(function () { root.classList.remove('sw-bump'); }, 640);
    setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 1500);
  }

  /* 只在“变强”的时候庆祝：等级上升 / 新领任务 */
  var lastKey = '';
  function watchGrowth() {
    var G = window.TafeiGrowth;
    if (!G) return false;
    var s = G.state();
    var claimed = s.tasks.filter(function (t) { return t.claimed; }).length;
    var key = s.level + ':' + claimed;
    if (!lastKey) {
      lastKey = key;
      window.addEventListener(G.changedEvent || 'tafei-growth-changed', function () { onGrowth(G); });
      return true;
    }
    onGrowth(G);
    return true;
  }

  function onGrowth(G) {
    var s = G.state();
    var claimed = s.tasks.filter(function (t) { return t.claimed; }).length;
    var key = s.level + ':' + claimed;
    if (key === lastKey) return;
    var prevLv = Number(String(lastKey).split(':')[0] || 0);
    lastKey = key;
    if (s.level > prevLv) celebrate('Lv.' + s.level + ' ' + s.title);
    else celebrate('任务完成 +1 亲密度');
  }

  /* ---------- 3. 页面语境提示 ---------- */
  var LINES = {
    'index.html': ['今天要先去社区看看，还是挑个小配件？', '页面往下滑，工具都在四宫格里。'],
    'shop.html': ['买之前先看额度，别一时上头。', '配件我帮你记着库存。'],
    'service.html': ['手机有问题就先别慌，把现象说清楚。', '预约写清楚机型，省一趟来回。'],
    'fix.html': ['先说说它怎么坏的，我陪你一起排查。'],
    'jingling.html': ['这里的任务每天 0 点刷新，别忘了领。', '换皮肤的地方在下面，原画那套只是备选。'],
    'my.html': ['账号里的收藏和进度，都在这儿同步。'],
    'about.html': ['想知道我为什么叫小挞飞，这页有答案。'],
    'angela.html': ['书页别翻太快，魔法会跑出来。'],
    'xiaota.html': ['这是我的小房间，随便坐。']
  };

  function pageName() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return p || 'index.html';
  }

  function contextualTip() {
    var say = window.TafeiSpiritSay;
    if (!say) return false;
    var key = pageName();
    if (/#community/.test(location.hash)) key = 'index.html';
    var list = LINES[key];
    if (!list) return true;
    var root = document.getElementById('spiritWidget');
    if (!root || root.hidden) return true;
    say(list[Math.floor(Math.random() * list.length)], 4200);
    return true;
  }

  function boot() {
    ensureDefault();
    preferQ();
    var tries = 0;
    (function waitGrowth() {
      if (watchGrowth() || tries > 40) return;
      tries++;
      setTimeout(waitGrowth, 250);
    })();
    setTimeout(contextualTip, 9000);
    /* 页面内跳转（社区 tab 之类）也补一句 */
    window.addEventListener('hashchange', function () { setTimeout(contextualTip, 1200); });
  }

  window.TafeiStage3 = { celebrate: celebrate, defaultSpirit: SPIRIT, defaultSkin: SKIN };

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 400);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
})();
