/* TAFEI SPIRIT WIDGET
   全站当前伙伴挂件。位置、开关、皮肤由 tafei-spirit-v2 统一保存。 */
(function () {
  'use strict';
  var core = window.TafeiSpirits;
  if (!core) return;

  var CSS_HREF = 'css/spirit-widget.css?v=5';
  var root = null;
  var body = null;
  var avatar = null;
  var nameNode = null;
  var levelNode = null;
  var speech = null;
  var closeBtn = null;
  var drag = null;
  var moved = false;
  var speechTimer = 0;
  var actionTimer = 0;

  function ensureCss() {
    if (!document.querySelector('link[data-spirit-widget]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS_HREF;
      link.setAttribute('data-spirit-widget', '1');
      document.head.appendChild(link);
    }
  }

  function build() {
    if (document.getElementById('spiritWidget')) { root = document.getElementById('spiritWidget'); return; }
    root = document.createElement('div');
    root.id = 'spiritWidget';
    root.className = 'spirit-widget';
    root.hidden = true;
    root.setAttribute('aria-live', 'polite');
    root.innerHTML = '<button type="button" class="sw-close" aria-label="收起精灵挂件">×</button>'
      + '<span class="sw-speech" id="swSpeech"></span>'
      + '<button type="button" class="sw-body" aria-label="和当前伙伴互动">'
      + '<span class="sw-avatar"><img id="swAvatarImg" alt=""><span class="sw-level" id="swLevel">Lv.1</span></span>'
      + '<span class="sw-name" id="swName">小挞飞</span>'
      + '<span class="sw-status" aria-hidden="true"><i></i><i></i><i></i></span>'
      + '</button>'
      + '<span class="sw-drag-line" aria-hidden="true"></span>';
    document.body.appendChild(root);
    body = root.querySelector('.sw-body');
    avatar = root.querySelector('#swAvatarImg');
    nameNode = root.querySelector('#swName');
    levelNode = root.querySelector('#swLevel');
    speech = root.querySelector('#swSpeech');
    closeBtn = root.querySelector('.sw-close');
    bind();
  }

  function usable() {
    var width = root ? root.offsetWidth || 94 : 94;
    var height = root ? root.offsetHeight || 120 : 120;
    return { w: width, h: height, uw: Math.max(1, innerWidth - width), uh: Math.max(1, innerHeight - height) };
  }

  function applyPosition() {
    if (!root) return;
    var dim = usable();
    var x = Number(core.state().widget.x);
    var y = Number(core.state().widget.y);
    if (!Number.isFinite(x)) x = 0.86;
    if (!Number.isFinite(y)) y = 0.72;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    var left = 8 + x * (dim.uw - 8);
    var top = 8 + y * (dim.uh - 8);
    root.style.left = left + 'px';
    root.style.top = top + 'px';
    root.classList.toggle('flip', left + dim.w / 2 > innerWidth / 2);
  }

  function say(text) {
    if (!speech) return;
    speech.textContent = text;
    speech.classList.add('show');
    clearTimeout(speechTimer);
    speechTimer = setTimeout(function () { speech.classList.remove('show'); }, 2600);
  }

  function interact() {
    if (!root) return;
    var spirit = core.current();
    if (!spirit) { say('还没有伙伴，先去精灵小屋领取一个。'); return; }
    var beforeLevel = core.bondInfo(spirit.id).level;
    core.pet(spirit.id);
    var afterInfo = core.bondInfo(spirit.id);
    var leveled = afterInfo.level > beforeLevel;
    root.classList.remove('action');
    void root.offsetWidth;
    root.classList.add('action');
    clearTimeout(actionTimer);
    actionTimer = setTimeout(function () { root.classList.remove('action'); }, 500);
    var condition = core.condition();
    if (leveled) say('亲密度升到 Lv.' + afterInfo.level + '，' + afterInfo.title + '。');
    else if (condition === 'sleep') say('唔……再睡一小会儿。');
    else if (condition === 'angry') say('哼，先让我冷静一下。');
    else if (condition === 'hungry') say('肚子有点饿了，想吃点东西。');
    else say('被你摸到了，亲密度 +1。');
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
    var condition = core.condition();
    avatar.src = skin.widget || skin.avatar || skin.img;
    avatar.alt = spirit.name + ' · ' + skin.name;
    nameNode.textContent = spirit.name;
    var bond = core.bondInfo(spirit.id);
    if (levelNode) levelNode.textContent = 'Lv.' + bond.level;
    root.classList.toggle('has-bond-frame', bond.level >= 7);
    root.classList.remove('mood-sleep', 'mood-angry', 'mood-hungry', 'mood-happy', 'mood-sad');
    root.classList.add('mood-' + condition);
    if (!state.widget.on) {
      root.classList.remove('show');
      root.hidden = true;
      return;
    }
    root.hidden = false;
    applyPosition();
    requestAnimationFrame(function () { applyPosition(); root.classList.add('show'); });
  }

  function closeWidget() {
    core.setWidget(false);
    if (root) {
      root.classList.remove('show');
      setTimeout(function () { if (root && !core.state().widget.on) root.hidden = true; }, 180);
    }
    say('挂件收到小屋里了。');
  }

  function bind() {
    body.addEventListener('pointerdown', function (event) {
      if (event.button != null && event.button !== 0) return;
      if (!core.state().widget.on) return;
      event.preventDefault();
      var dim = usable();
      var startLeft = root.offsetLeft;
      var startTop = root.offsetTop;
      drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, left: startLeft, top: startTop, dim: dim };
      moved = false;
      root.classList.add('dragging');
      try { body.setPointerCapture(event.pointerId); } catch (error) {}
    });

    body.addEventListener('pointermove', function (event) {
      if (!drag || drag.id !== event.pointerId) return;
      var dx = event.clientX - drag.startX;
      var dy = event.clientY - drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (!moved) return;
      var left = drag.left + dx;
      var top = drag.top + dy;
      left = Math.max(8, Math.min(drag.dim.uw - 8, left));
      top = Math.max(8, Math.min(drag.dim.uh - 8, top));
      root.style.left = left + 'px';
      root.style.top = top + 'px';
      root.classList.toggle('flip', left + drag.dim.w / 2 > innerWidth / 2);
    });

    function release(event) {
      if (!drag || drag.id !== event.pointerId) return;
      root.classList.remove('dragging');
      try { body.releasePointerCapture(event.pointerId); } catch (error) {}
      if (!moved) {
        drag = null;
        interact();
        return;
      }
      var dim = drag.dim;
      var uw = Math.max(1, dim.uw);
      var uh = Math.max(1, dim.uh);
      var x = (root.offsetLeft - 8) / Math.max(1, uw - 8);
      var y = (root.offsetTop - 8) / Math.max(1, uh - 8);
      var corner = (x < 0.5 ? 'l' : 'r') + (y < 0.5 ? 't' : 'b');
      x = x < 0.5 ? 0 : 1;
      y = y < 0.5 ? 0 : 1;
      core.setWidgetPosition(x, y, corner);
      applyPosition();
      root.classList.remove('action');
      void root.offsetWidth;
      root.classList.add('action');
      say('呀——别把我甩出去！');
      setTimeout(function () { root.classList.remove('action'); }, 520);
      drag = null;
    }

    body.addEventListener('pointerup', release);
    body.addEventListener('pointercancel', release);
    body.addEventListener('dblclick', function () { window.location.href = 'jingling.html'; });
    closeBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeWidget();
    });
    window.addEventListener('resize', applyPosition);
    core.subscribe(render);
  }

  function init() {
    ensureCss();
    if (!document.body) return;
    build();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
