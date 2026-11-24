/* TAFEI 挂件长按菜单 · 与精灵挂件的单击动作互不冲突
   交互：单击 = 原有摸摸动作（完全不动原有逻辑）；长按 0.5 秒 = 弹出快捷菜单
   菜单：查看详情 / 喂一份零食 / 收起挂件；拖动超过 8px 不触发菜单 */
(function () {
  'use strict';
  if (window.__tafeiWidgetMenu) return;
  window.__tafeiWidgetMenu = true;

  var HOLD_MS = 500;
  var MOVE_TOL = 8;
  var menu = null;
  var timer = 0;
  var startX = 0, startY = 0, pressed = false, opened = false;

  function core() { return window.TafeiSpirits || null; }

  function ownedFood() {
    var c = core();
    if (!c || !c.ITEMS || !c.state) return null;
    var inv = (c.state() && c.state().inventory) || {};
    for (var i = 0; i < c.ITEMS.length; i++) {
      var it = c.ITEMS[i];
      if (it.kind === 'food' && (Number(inv[it.id]) || 0) > 0) return it;
    }
    return null;
  }

  function toast(text) {
    var el = document.getElementById('tfWmToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tfWmToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(112px + env(safe-area-inset-bottom));transform:translateX(-50%);'
        + 'max-width:78vw;padding:10px 14px;border-radius:12px;background:rgba(9,16,30,.96);border:1px solid rgba(130,170,255,.34);'
        + 'color:#eef4ff;font:13px/1.5 -apple-system,"PingFang SC",sans-serif;z-index:100000;opacity:0;transition:opacity .2s ease;'
        + 'pointer-events:none;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(el.__t);
    el.__t = setTimeout(function () { el.style.opacity = '0'; }, 2000);
  }

  function closeMenu() {
    if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
    menu = null;
  }

  function buildMenu(anchorTop, anchorRight) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:100000;right:' + Math.max(10, anchorRight) + 'px;'
      + 'bottom:calc(100vh - ' + Math.round(anchorTop - 8) + 'px);display:flex;flex-direction:column;gap:6px;'
      + 'padding:6px;border-radius:14px;background:rgba(11,18,34,.98);border:1px solid rgba(130,170,255,.34);'
      + 'box-shadow:0 14px 34px rgba(3,9,22,.55);backdrop-filter:blur(10px)';

    var items = [
      { key: 'info', label: '查看详情', glyph: '详' },
      { key: 'feed', label: '喂一份零食', glyph: '喂' },
      { key: 'hide', label: '收起挂件', glyph: '收' }
    ];

    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-act', it.key);
      b.style.cssText = 'display:flex;align-items:center;gap:8px;padding:9px 12px;border:0;border-radius:10px;'
        + 'background:transparent;color:#eef4ff;font:13.5px/1.4 -apple-system,"PingFang SC",sans-serif;white-space:nowrap';
      b.innerHTML = '<span style="width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-size:12px;'
        + 'font-weight:800;color:#06101f;background:linear-gradient(120deg,#53ddff,#728cff)">' + it.glyph + '</span>' + it.label;
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        doAction(it.key);
      });
      box.appendChild(b);
    });

    document.body.appendChild(box);
    menu = box;
    return box;
  }

  function doAction(key) {
    var c = core();
    closeMenu();
    if (key === 'info') {
      var sid = '';
      try { var cur = c && c.current && c.current(); sid = cur ? cur.id : ''; } catch (e) {}
      location.href = 'jingling.html' + (sid ? ('?spirit=' + encodeURIComponent(sid)) : '');
      return;
    }
    if (key === 'feed') {
      var food = ownedFood();
      if (!food) { toast('背包里没有零食了，先去精灵小屋补货'); return; }
      try {
        var cur2 = c.current && c.current();
        var sid2 = cur2 ? cur2.id : '';
        c.useItem(food.id, sid2);
        toast('喂了一份' + food.name + '，亲密度上涨');
      } catch (e) {
        toast(e && e.message ? e.message : '投喂失败，请稍后再试');
      }
      return;
    }
    if (key === 'hide') {
      try {
        c.setWidget(false);
        toast('挂件已收起，可在精灵小屋重新打开');
      } catch (e) {
        toast('收起失败，请到精灵小屋设置');
      }
      return;
    }
  }

  function attach(root) {
    if (!root || root.dataset.wmBound === '1') return;
    root.dataset.wmBound = '1';

    root.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      pressed = true;
      opened = false;
      startX = e.clientX;
      startY = e.clientY;
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (!pressed || !root.isConnected) return;
        opened = true;
        var box = root.getBoundingClientRect();
        closeMenu();
        buildMenu(box.top, window.innerWidth - box.right);
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
      }, HOLD_MS);
    }, true);

    root.addEventListener('pointermove', function (e) {
      if (!pressed) return;
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > MOVE_TOL) {
        clearTimeout(timer);
        pressed = false;
        closeMenu();
      }
    }, true);

    root.addEventListener('pointerup', function (e) {
      clearTimeout(timer);
      pressed = false;
      if (opened) {
        /* 长按已弹菜单：吞掉这次点击，避免又触发摸摸动作 */
        e.stopPropagation();
        e.preventDefault();
        opened = false;
        return;
      }
      if (menu && !menu.contains(e.target)) closeMenu();
    }, true);

    root.addEventListener('pointercancel', function () {
      clearTimeout(timer);
      pressed = false;
      opened = false;
    }, true);
  }

  function watch() {
    var root = document.getElementById('spiritWidget');
    if (root) attach(root);
  }

  document.addEventListener('DOMContentLoaded', function () {
    watch();
    if (window.MutationObserver) {
      new MutationObserver(watch).observe(document.body, { childList: true });
    }
  });

  document.addEventListener('pointerdown', function (e) {
    if (menu && !menu.contains(e.target) && !(e.target.closest && e.target.closest('#spiritWidget'))) closeMenu();
  }, true);

  window.addEventListener('scroll', closeMenu, { passive: true });
})();
