/* TAFEI SPIRIT WIDGET v2
   全站当前伙伴：只保留角色本体，不固定四角；支持用户拖拽和自主闲逛。
   位置、开关、皮肤仍由 tafei-spirit-v2 统一保存。 */
(function () {
  'use strict';
  var core = window.TafeiSpirits;
  if (!core) return;

  var CSS_HREF = 'css/spirit-widget.css?v=6';
  var ART_FILES = {
    idle: 'action-idle.png',
    pet: 'action-pet.png',
    jump: 'action-upgrade.png',
    sit: 'action-sit.png',
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
  var drag = null;
  var moved = false;
  var pressTimer = 0;
  var speechTimer = 0;
  var actionTimer = 0;
  var autoTimer = 0;
  var idleTimer = 0;
  var started = false;
  var mode = 'auto';
  var currentAction = '';
  var baseArt = '';

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
      + '<button type="button" class="sw-body" aria-label="和当前伙伴互动">'
      + '<span class="sw-shadow" aria-hidden="true"></span>'
      + '<span class="sw-zzz" aria-hidden="true">z z</span>'
      + '<img class="sw-art" id="swArtImg" alt="">'
      + '</button>';
    document.body.appendChild(root);
    body = root.querySelector('.sw-body');
    art = root.querySelector('#swArtImg');
    speech = root.querySelector('#swSpeech');
    zzz = root.querySelector('.sw-zzz');
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
    var file = ART_FILES[action];
    var src = baseArt;
    if (spirit && spirit.id === 'xiaota' && file) {
      src = baseArt.replace(/[^/]+$/, file);
    }
    if (art.getAttribute('src') !== src) {
      art.dataset.fallback = '0';
      art.src = src;
    }
    art.dataset.action = action;
    currentAction = action;
    root.classList.remove('act-idle', 'act-pet', 'act-jump', 'act-sit', 'act-happy', 'act-shy', 'act-sad', 'act-angry', 'act-sleepy', 'act-surprised', 'act-look');
    root.classList.add('act-' + action);
    if (root.classList.contains('is-alpha')) root.classList.remove('is-photo');
    else root.classList.add('is-photo');
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
        left: parseFloat(root.style.left || '0'),
        top: parseFloat(root.style.top || '0'),
        dim: d,
        active: false
      };
      moved = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(function () {
        if (!drag || moved) return;
        drag.active = true;
        root.classList.add('dragging');
        say('拖我去任意位置吧。', 1800);
        mode = 'manual';
        clearTimeout(idleTimer);
      }, 160);
      try { body.setPointerCapture(event.pointerId); } catch (error) {}
    });

    body.addEventListener('pointermove', function (event) {
      if (!drag || drag.id !== event.pointerId) return;
      var dx = event.clientX - drag.startX;
      var dy = event.clientY - drag.startY;
      if (!drag.active && Math.abs(dx) + Math.abs(dy) > 6) {
        clearTimeout(pressTimer);
        drag.active = true;
        moved = true;
        root.classList.add('dragging');
        root.classList.remove('walking', 'act-walk');
        mode = 'manual';
        clearTimeout(idleTimer);
      }
      if (!drag.active) return;
      event.preventDefault();
      setPixel(drag.left + dx, drag.top + dy);
    });

    function release(event) {
      if (!drag || drag.id !== event.pointerId) return;
      clearTimeout(pressTimer);
      var wasActive = drag.active;
      var wasMoved = moved;
      root.classList.remove('dragging');
      document.body.classList.remove('sw-dragging');
      if (window.getSelection) { try { window.getSelection().removeAllRanges(); } catch (error) {} }
      try { body.releasePointerCapture(event.pointerId); } catch (error) {}
      drag = null;
      if (!wasActive && !wasMoved) {
        interact();
        return;
      }
      savePosition();
      setAction('happy', 1200);
      say(wasMoved ? '这里不错，我记住啦。' : '就放这里吧。', 2000);
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
    art.addEventListener('error', function () {
      if (art.dataset.fallback === '1') return;
      art.dataset.fallback = '1';
      if (baseArt) art.src = baseArt;
      currentAction = 'idle';
      root.classList.remove('act-pet', 'act-jump', 'act-sit', 'act-happy', 'act-shy', 'act-sad', 'act-angry', 'act-sleepy', 'act-surprised');
      root.classList.add('act-idle');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
