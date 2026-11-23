/* TAFEI SPIRIT WIDGET v2
   全站当前伙伴：只保留角色本体，不固定四角；支持用户拖拽和自主闲逛。
   位置、开关、皮肤仍由 tafei-spirit-v2 统一保存。 */
(function () {
  'use strict';
  var core = window.TafeiSpirits;
  if (!core) return;

  var CSS_HREF = 'css/spirit-widget.css?v=8';
  var ART_FILES = {
    idle: 'action-idle.png',
    pet: 'action-pet.png',
    jump: 'action-upgrade.png',
    sit: 'action-sit.png',
    hit: 'action-hit.png',
    dizzy: 'action-dizzy.png',
    happy: 'emotion-happy.png',
    shy: 'emotion-shy.png',
    sad: 'emotion-sad.png',
    angry: 'emotion-angry.png',
    sleepy: 'emotion-sleepy.png',
    surprised: 'emotion-surprised.png'
  };

  var root = null;
  var body = null;
  var art = null;
  var speech = null;
  var zzz = null;
  var fx = null;
  var aura = null;
  var drag = null;
  var moved = false;
  var pressTimer = 0;
  var holdTimer = 0;
  var speechTimer = 0;
  var actionTimer = 0;
  var autoTimer = 0;
  var idleTimer = 0;
  var sparkTimer = 0;
  var alertTimer = 0;
  var started = false;
  var mode = 'auto';
  var currentAction = '';
  var baseArt = '';
  var lastFxAction = '';
  var lastSpark = 0;
  var BUMP_LINES = ['好疼……撞到啦。', '呜，撞得好疼。', '角角撞疼了。', '慢一点，好疼呀。'];
  var DIZZY_LINES = ['慢一点……好晕呀。', '要转晕啦……', '飞太快了，星星都在转。', '等我缓一缓。'];
  var DROP_LINES = ['这里不错，我记住啦。', '就放这里吧。', '呼……稳稳落地。'];

  function ensureCss() {
    if (!document.querySelector('link[data-spirit-widget]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS_HREF;
      link.setAttribute('data-spirit-widget', '1');
      document.head.appendChild(link);
    }
  }

  function widgetOn() {
    return !!(core.state() && core.state().widget && core.state().widget.on);
  }

  function build() {
    if (document.getElementById('spiritWidget')) {
      root = document.getElementById('spiritWidget');
      body = root.querySelector('.sw-body');
      art = root.querySelector('#swArtImg');
      speech = root.querySelector('#swSpeech');
      zzz = root.querySelector('.sw-zzz');
      fx = root.querySelector('#swFx');
      aura = root.querySelector('.sw-aura');
      if (!art) {
        root.remove();
        root = null;
      } else {
        if (!root.dataset.bound) {
          root.dataset.bound = '1';
          bind();
        }
        return;
      }
    }
    root = document.createElement('div');
    root.id = 'spiritWidget';
    root.className = 'spirit-widget';
    root.hidden = true;
    root.setAttribute('aria-live', 'polite');
    root.innerHTML = '<span class="sw-speech" id="swSpeech" aria-hidden="true"></span>'
      + '<span class="sw-aura" aria-hidden="true"></span>'
      + '<button type="button" class="sw-body" aria-label="和当前伙伴互动">'
      + '<span class="sw-shadow" aria-hidden="true"></span>'
      + '<span class="sw-zzz" aria-hidden="true">z z</span>'
      + '<img class="sw-art" id="swArtImg" alt="">'
      + '</button>'
      + '<span class="sw-fx" id="swFx" aria-hidden="true"></span>';
    document.body.appendChild(root);
    body = root.querySelector('.sw-body');
    art = root.querySelector('#swArtImg');
    speech = root.querySelector('#swSpeech');
    zzz = root.querySelector('.sw-zzz');
    fx = root.querySelector('#swFx');
    aura = root.querySelector('.sw-aura');
    root.dataset.bound = '1';
    bind();
  }

  function insetTop() {
    var header = document.querySelector('header, .topbar, .navlinks');
    if (!header) return 8;
    var box = header.getBoundingClientRect();
    var style = getComputedStyle(header);
    if (!box.height || style.display === 'none' || style.visibility === 'hidden') return 8;
    if (box.top > 8) return 8;
    return Math.max(8, box.bottom + 8);
  }

  function insetBottom() {
    var nav = document.querySelector('.mobile-bottom-nav, .bottom-nav, .tf-bottom-nav');
    if (!nav) return 10;
    var box = nav.getBoundingClientRect();
    var style = getComputedStyle(nav);
    if (!box.height || style.display === 'none' || style.visibility === 'hidden') return 10;
    if (box.top < innerHeight * 0.55) return 10;
    return Math.max(12, innerHeight - box.top + 12);
  }

  function dims() {
    var w = root ? (root.offsetWidth || 112) : 112;
    var h = root ? (root.offsetHeight || 112) : 112;
    return {
      w: w,
      h: h,
      maxLeft: Math.max(8, innerWidth - w - 8),
      minTop: insetTop(),
      maxTop: Math.max(insetTop(), innerHeight - h - insetBottom())
    };
  }

  function setPixel(left, top) {
    if (!root) return;
    var d = dims();
    var rawLeft = left;
    var rawTop = top;
    var hitWall = left < 8 || left > d.maxLeft || top > d.maxTop;
    if (drag && drag.active) {
      if (rawTop <= d.minTop + 10) drag.topEdge = true;
      if (hitWall && !drag.dizzy && (drag.speed || 0) > 0.4) bumpWall();
    }
    left = Math.max(8, Math.min(d.maxLeft, left));
    top = Math.max(d.minTop, Math.min(d.maxTop, top));
    root.style.left = Math.round(left) + 'px';
    root.style.top = Math.round(top) + 'px';
    root.classList.toggle('flip', left + d.w / 2 > innerWidth / 2);
    root.classList.toggle('near-bottom', top > d.maxTop - 46);
  }

  function applyPosition() {
    if (!root) return;
    var d = dims();
    var state = core.state();
    var x = Number(state.widget && state.widget.x);
    var y = Number(state.widget && state.widget.y);
    if (!Number.isFinite(x)) x = 0.86;
    if (!Number.isFinite(y)) y = 0.72;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    setPixel(8 + x * Math.max(1, d.maxLeft - 8), d.minTop + y * Math.max(1, d.maxTop - d.minTop));
  }

  function savePosition() {
    if (!root) return;
    var d = dims();
    var x = (parseFloat(root.style.left || '0') - 8) / Math.max(1, d.maxLeft - 8);
    var y = (parseFloat(root.style.top || '0') - d.minTop) / Math.max(1, d.maxTop - d.minTop);
    core.setWidgetPosition(
      Math.max(0, Math.min(1, x)),
      Math.max(0, Math.min(1, y)),
      'free'
    );
  }

  function say(text, hold) {
    if (!speech || !root) return;
    speech.textContent = text;
    var d = dims();
    root.classList.toggle('speech-below', parseFloat(root.style.top || '0') < 84);
    root.classList.toggle('speech-right', parseFloat(root.style.left || '0') + d.w / 2 > innerWidth / 2);
    speech.classList.add('show');
    clearTimeout(speechTimer);
    speechTimer = setTimeout(function () { speech.classList.remove('show'); }, hold || 2600);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function burst(kind, count, origin) {
    if (!root || !widgetOn()) return;
    var box = root.getBoundingClientRect();
    var x = origin && Number.isFinite(origin.x) ? origin.x : box.left + box.width / 2;
    var y = origin && Number.isFinite(origin.y) ? origin.y : box.top + box.height * 0.42;
    count = count || 4;
    for (var i = 0; i < count; i++) {
      var item = document.createElement('span');
      item.className = 'sw-effect sw-fx-' + kind;
      item.setAttribute('aria-hidden', 'true');
      if (kind === 'bump' || kind === 'land') {
        item.textContent = '';
      } else {
        item.textContent = kind === 'heart' ? '♥' : (kind === 'drop' ? '•' : (kind === 'cloud' ? '☁' : (kind === 'z' ? 'z' : (kind === 'step' ? '✧' : '✦'))));
      }
      item.style.left = Math.round(x + (kind === 'trail' ? (Math.random() * 18 - 9) : 0)) + 'px';
      item.style.top = Math.round(y + (kind === 'trail' ? (Math.random() * 12 - 6) : 0)) + 'px';
      item.style.setProperty('--dx', Math.round(Math.random() * 64 - 32) + 'px');
      item.style.setProperty('--dy', Math.round(-18 - Math.random() * 42) + 'px');
      item.style.setProperty('--rot', Math.round(Math.random() * 100 - 50) + 'deg');
      item.style.animationDelay = Math.round(i * 35) + 'ms';
      document.body.appendChild(item);
      (function (node) {
        setTimeout(function () { if (node.parentNode) node.remove(); }, 1050);
      })(item);
    }
  }

  function showAlert(text, hold) {
    if (!root) return;
    root.classList.add('sw-alert');
    say(text, hold || 1600);
    clearTimeout(alertTimer);
    alertTimer = setTimeout(function () {
      if (root) root.classList.remove('sw-alert');
    }, (hold || 1600) + 180);
  }

  function bumpWall() {
    if (!root || !drag) return;
    var now = Date.now();
    if (now - (drag.lastBump || 0) < 850) return;
    drag.lastBump = now;
    drag.bumped = true;
    setAction('hit', 700);
    showAlert(pick(BUMP_LINES), 1550);
    root.classList.add('sw-bump');
    burst('bump', 1);
    burst('dizzy', 4);
    setTimeout(function () { if (root) root.classList.remove('sw-bump'); }, 620);
  }

  function dizzyNow() {
    if (!root || !drag || drag.dizzy) return;
    drag.dizzy = true;
    setAction('dizzy', 0);
    showAlert(pick(DIZZY_LINES), 2200);
    burst('dizzy', 6);
  }

  function footSpark() {
    if (!root) return;
    var box = root.getBoundingClientRect();
    burst('step', 1, { x: box.left + box.width / 2, y: box.top + box.height - 8 });
  }

  function startSparkles() {
    clearInterval(sparkTimer);
    sparkTimer = setInterval(function () {
      if (!root || !widgetOn() || drag || document.hidden) return;
      if (Date.now() - lastSpark < 2200) return;
      lastSpark = Date.now();
      var box = root.getBoundingClientRect();
      burst('idle', 2, { x: box.left + box.width * 0.5, y: box.top + box.height * 0.82 });
    }, 2600);
  }

  function baseImage() {
    var skin = core.skin();
    if (!skin) return '';
    return skin.img || skin.avatar || skin.widget || '';
  }

  function setAction(action, hold) {
    if (!root || !art) return;
    var nextBase = baseImage();
    if (nextBase) baseArt = nextBase;
    if (!baseArt) return;
    var spirit = core.current();
    var skin = core.skin();
    var extraActions = (skin && skin.extraActions) || (spirit && spirit.extraActions) || [];
    if (action === 'hit' && extraActions.indexOf('hit') === -1) action = 'pet';
    if (action === 'dizzy' && extraActions.indexOf('dizzy') === -1) action = 'sad';
    var previousAction = currentAction;
    var file = ART_FILES[action];
    var src = baseArt;
    var actionDir = (skin && skin.actionDir) || (spirit && spirit.actionDir) || '';
    if (actionDir && file) src = actionDir + file;
    if (art.getAttribute('src') !== src) {
      art.dataset.fallback = '0';
      art.src = src;
    }
    art.dataset.action = action;
    currentAction = action;
    root.classList.remove('act-idle', 'act-pet', 'act-jump', 'act-sit', 'act-hit', 'act-dizzy', 'act-happy', 'act-shy', 'act-sad', 'act-angry', 'act-sleepy', 'act-surprised', 'act-look');
    root.classList.add('act-' + action);
    if (root.classList.contains('is-alpha')) root.classList.remove('is-photo');
    else root.classList.add('is-photo');
    if (previousAction !== action) {
      if (action === 'pet' || action === 'happy' || action === 'shy') burst('heart', action === 'happy' ? 3 : 2);
      else if (action === 'jump') burst('star', 5);
      else if (action === 'sleepy') burst('z', 2);
      else if (action === 'sad') burst('drop', 2);
      else if (action === 'angry') burst('cloud', 2);
      else if (action === 'surprised') burst('star', 3);
    }
    clearTimeout(actionTimer);
    if (hold) actionTimer = setTimeout(function () { setAction('idle'); }, hold);
  }

  function armAuto(delay) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (!widgetOn() || drag || document.hidden) return;
      mode = 'auto';
      scheduleIdle(3500);
    }, delay == null ? 30000 : delay);
  }

  function scheduleIdle(delay) {
    clearTimeout(idleTimer);
    if (!widgetOn() || mode !== 'auto' || drag || document.hidden) return;
    idleTimer = setTimeout(idleBeat, delay == null ? 7000 + Math.random() * 5000 : delay);
  }

  function idleBeat() {
    if (!widgetOn() || mode !== 'auto' || drag || document.hidden) return;
    var condition = core.condition();
    if (condition === 'sleep') {
      setAction('sleepy', 3600);
      say('唔……让我趴一会儿。', 1900);
      scheduleIdle(6000);
      return;
    }
    if (condition === 'angry') {
      setAction('angry', 2400);
      scheduleIdle(5000);
      return;
    }
    if (condition === 'hungry') {
      setAction('sad', 2600);
      say('有一点点饿……', 1900);
      scheduleIdle(5500);
      return;
    }
    if (condition === 'sad') {
      setAction('sad', 2600);
      scheduleIdle(6000);
      return;
    }
    var roll = Math.random();
    if (roll < 0.44) {
      walkStep();
      scheduleIdle(1600);
    } else if (roll < 0.56) {
      setAction('happy', 2600);
      scheduleIdle(5000);
    } else if (roll < 0.7) {
      setAction('look', 2400);
      scheduleIdle(5000);
    } else if (roll < 0.82) {
      setAction('sit', 3200);
      scheduleIdle(6000);
    } else {
      setAction('idle');
      scheduleIdle(7000);
    }
  }

  function walkStep() {
    if (!root || !widgetOn() || mode !== 'auto' || drag || document.hidden) return;
    var d = dims();
    var left = parseFloat(root.style.left || '0');
    var top = parseFloat(root.style.top || '0');
    var step = Math.min(100, Math.max(36, innerWidth * 0.13));
    var dir = Math.random() < 0.5 ? -1 : 1;
    left = left + dir * (step + Math.random() * 36);
    top = top + (Math.random() * 26 - 13);
    if (left < 8 || left > d.maxLeft) left = 8 + Math.random() * Math.max(1, d.maxLeft - 8);
    root.classList.add('walking', 'act-walk');
    setAction('idle');
    setPixel(left, top);
    setTimeout(footSpark, 80);
    setTimeout(function () {
      if (!root) return;
      root.classList.remove('walking', 'act-walk');
      savePosition();
      setAction('idle');
      scheduleIdle(4500);
    }, 980);
  }

  function interact() {
    if (!root || !widgetOn()) return;
    var spirit = core.current();
    if (!spirit) { say('还没有伙伴，先去精灵小屋领取一个。'); return; }
    var beforeLevel = core.bondInfo(spirit.id).level;
    core.pet(spirit.id);
    var afterInfo = core.bondInfo(spirit.id);
    var leveled = afterInfo.level > beforeLevel;
    setAction('pet', 720);
    setTimeout(function () {
      if (!root || !widgetOn()) return;
      setAction(leveled ? 'jump' : 'happy', leveled ? 2600 : 1800);
    }, 720);
    var condition = core.condition();
    if (leveled) say('亲密度升到 Lv.' + afterInfo.level + '，' + afterInfo.title + '。', 3400);
    else if (condition === 'sleep') say('唔……再睡一小会儿。');
    else if (condition === 'angry') say('哼，先让我冷静一下。');
    else if (condition === 'hungry') say('肚子有点饿了，想吃点东西。');
    else say('被你摸到了，亲密度 +1。');
    mode = 'manual';
    armAuto();
    clearTimeout(actionTimer);
  }

  function bind() {
    body.addEventListener('pointerdown', function (event) {
      if (event.button != null && event.button !== 0) return;
      if (!widgetOn()) return;
      event.preventDefault();
      document.body.classList.add('sw-dragging');
      root.classList.remove('walking', 'act-walk');
      clearTimeout(idleTimer);
      var d = dims();
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        lastT: Date.now(),
        left: parseFloat(root.style.left || '0'),
        top: parseFloat(root.style.top || '0'),
        dim: d,
        active: false,
        speed: 0,
        fastMs: 0,
        lastTrail: 0,
        lastBump: 0,
        topEdge: false,
        dizzy: false,
        bumped: false,
        longPress: false,
        lastAngle: null,
        angleAccum: 0,
        dance: false
      };
      moved = false;
      clearTimeout(pressTimer);
      clearTimeout(holdTimer);
      pressTimer = setTimeout(function () {
        if (!drag || moved) return;
        drag.active = true;
        root.classList.add('dragging');
        say('拖我去任意位置吧。', 1800);
        mode = 'manual';
        clearTimeout(idleTimer);
      }, 160);
      holdTimer = setTimeout(function () {
        if (!drag || moved) return;
        drag.longPress = true;
        setAction('shy', 2200);
        showAlert('唔…要带我去哪里呀。', 1800);
        burst('heart', 2);
        mode = 'manual';
        clearTimeout(idleTimer);
      }, 2000);
      try { body.setPointerCapture(event.pointerId); } catch (error) {}
    });

    body.addEventListener('pointermove', function (event) {
      if (!drag || drag.id !== event.pointerId) return;
      var dx = event.clientX - drag.startX;
      var dy = event.clientY - drag.startY;
      if (!drag.active && Math.abs(dx) + Math.abs(dy) > 6) {
        clearTimeout(pressTimer);
        clearTimeout(holdTimer);
        drag.active = true;
        moved = true;
        root.classList.add('dragging');
        root.classList.remove('walking', 'act-walk');
        mode = 'manual';
        clearTimeout(idleTimer);
      }
      if (!drag.active) return;
      event.preventDefault();
      var now = Date.now();
      var stepX = event.clientX - drag.lastX;
      var stepY = event.clientY - drag.lastY;
      var dt = Math.max(1, Math.min(90, now - drag.lastT));
      var speed = Math.sqrt(stepX * stepX + stepY * stepY) / dt;
      drag.speed = speed;
      if (speed > 0.4) drag.fastMs = Math.min(1800, drag.fastMs + dt);
      else drag.fastMs = Math.max(0, drag.fastMs - dt * 0.7);
      if (drag.fastMs > 900) dizzyNow();
      if (speed > 0.3 && now - drag.lastTrail > 55) {
        drag.lastTrail = now;
        var trailBox = root.getBoundingClientRect();
        burst('trail', 1, {
          x: trailBox.left + trailBox.width * 0.5,
          y: trailBox.top + trailBox.height * 0.56
        });
      }
      var angle = Math.atan2(event.clientY - drag.startY, event.clientX - drag.startX);
      if (drag.lastAngle == null) drag.lastAngle = angle;
      var angleDelta = angle - drag.lastAngle;
      while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
      while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
      if (Math.sqrt(dx * dx + dy * dy) > 40) drag.angleAccum = (drag.angleAccum || 0) + Math.abs(angleDelta);
      drag.lastAngle = angle;
      if (drag.angleAccum > Math.PI * 5 && !drag.dance) {
        drag.dance = true;
        setAction('jump', 1800);
        showAlert('转圈圈~', 1600);
        burst('star', 7);
      }
      drag.lastT = now;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      root.style.setProperty('--sw-tilt', Math.max(-6, Math.min(6, stepX * 0.15)) + 'deg');
      setPixel(drag.left + dx, drag.top + dy);
    });

    function release(event) {
      if (!drag || drag.id !== event.pointerId) return;
      clearTimeout(pressTimer);
      clearTimeout(holdTimer);
      var wasActive = drag.active;
      var wasMoved = moved;
      var wasDizzy = drag.dizzy;
      var wasTop = drag.topEdge;
      var wasLong = drag.longPress;
      root.classList.remove('dragging', 'sw-bump');
      root.style.removeProperty('--sw-tilt');
      document.body.classList.remove('sw-dragging');
      if (window.getSelection) { try { window.getSelection().removeAllRanges(); } catch (error) {} }
      try { body.releasePointerCapture(event.pointerId); } catch (error) {}
      drag = null;
      if (!wasActive && !wasMoved) {
        interact();
        return;
      }
      savePosition();
      clearTimeout(alertTimer);
      root.classList.remove('sw-alert');
      if (wasDizzy) {
        setAction('dizzy', 0);
        showAlert('松手啦……让我缓一缓。', 1800);
        setTimeout(function () {
          if (root && !drag && currentAction === 'dizzy') setAction('happy', 1000);
        }, 1650);
      } else if (wasTop) {
        setAction('happy', 1800);
        showAlert('哇……看得好远呀。', 1800);
      } else if (wasLong) {
        setAction('shy', 2000);
        showAlert('唔……要带我去哪里呀。', 1800);
      } else {
        setAction('happy', 1200);
        root.classList.add('sw-land');
        burst('land', 1);
        say(pick(DROP_LINES), 2000);
        setTimeout(function () { if (root) root.classList.remove('sw-land'); }, 560);
      }
      mode = 'manual';
      armAuto();
    }

    body.addEventListener('pointerup', release);
    body.addEventListener('pointercancel', release);
    body.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    window.addEventListener('blur', function () { document.body.classList.remove('sw-dragging'); });
    body.addEventListener('dblclick', function (event) {
      event.preventDefault();
      window.location.href = 'jingling.html';
    });

    window.addEventListener('resize', function () {
      applyPosition();
      savePosition();
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { applyPosition(); savePosition(); }, 180);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        clearTimeout(idleTimer);
        clearTimeout(autoTimer);
      } else if (widgetOn()) {
        mode = 'auto';
        scheduleIdle(3500);
      }
    });
    core.subscribe(render);
  }

  function render() {
    if (!root) return;
    var state = core.state();
    var spirit = core.current();
    var skin = core.skin();
    if (!spirit || !skin) {
      root.classList.remove('show');
      root.hidden = true;
      return;
    }
    var nextBase = skin.img || skin.avatar || skin.widget;
    var isAlpha = /\.png($|\?)/i.test(nextBase || '');
    root.classList.toggle('is-alpha', isAlpha);
    root.classList.toggle('is-photo', !isAlpha);
    art.alt = spirit.name + ' · ' + skin.name;
    if (!state.widget.on) {
      root.classList.remove('show');
      root.hidden = true;
      clearTimeout(idleTimer);
      clearTimeout(autoTimer);
      return;
    }
    if (baseArt !== nextBase) {
      baseArt = nextBase;
      currentAction = '';
    }
    if (!currentAction) setAction('idle');
    root.hidden = false;
    applyPosition();
    requestAnimationFrame(function () {
      if (!root) return;
      applyPosition();
      root.classList.add('show');
    });
    if (!started) {
      started = true;
      mode = 'auto';
      scheduleIdle(3500);
    }
  }

  function init() {
    ensureCss();
    if (!document.body) return;
    build();
    render();
    startSparkles();
    art.addEventListener('error', function () {
      if (art.dataset.fallback === '1') return;
      art.dataset.fallback = '1';
      if (baseArt) art.src = baseArt;
      currentAction = 'idle';
      root.classList.remove('act-pet', 'act-jump', 'act-sit', 'act-hit', 'act-dizzy', 'act-happy', 'act-shy', 'act-sad', 'act-angry', 'act-sleepy', 'act-surprised');
      root.classList.add('act-idle');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
