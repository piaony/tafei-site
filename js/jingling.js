/* TAFEI SPIRIT HOUSE v23.0
   精灵小屋：伙伴坞、十级成长、纪念卡（750×1000 空白底图 + 动态文字）。 */
(function () {
  'use strict';

  var core = window.TafeiSpirits;
  if (!core) return;

  var $ = function (id) { return document.getElementById(id); };
  var grid = $('spiritGrid');
  var foodGrid = $('foodGrid');
  var toyGrid = $('toyGrid');
  var modal = $('spiritModal');
  var toastTimer = 0;
  var currentModal = null;
  var busy = false;
  var CONTACT_QQ = '3659229103';
  var gridSig = '';
  var shopSig = '';
  var widgetLoader = null;

  function loadWidgetScript() {
    if (window.TafeiSpiritWidgetLoaded) return Promise.resolve();
    if (widgetLoader) return widgetLoader;
    widgetLoader = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'js/spirit-widget.js?v=19';
      script.async = true;
      script.onload = function () {
        window.TafeiSpiritWidgetLoaded = true;
        resolve();
      };
      script.onerror = function () {
        widgetLoader = null;
        reject(new Error('widget script failed'));
      };
      document.body.appendChild(script);
    });
    return widgetLoader;
  }

  function primeWidget() {
    if (window.TafeiSpiritWidgetLoaded) return;
    if (!core.state() || !core.state().widget || !core.state().widget.on) return;
    var run = function () {
      loadWidgetScript().then(function () { renderAll(); }).catch(function () {});
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 700);
    }
  }

  function num(value) { return Math.round(Number(value) || 0); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(text, isError) {
    var node = $('spiritToast');
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('err', !!isError);
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 2800);
  }
  function walletInfo() {
    var snap = core.snapshot();
    return snap.wallet || { amount: 0, real: false };
  }
  function walletText() {
    var wallet = walletInfo();
    return (wallet.real ? '账户额度 ' : '演示额度 ') + num(wallet.amount);
  }
  function renderWallet() {
    var wallet = walletInfo();
    var text = walletText();
    ['partnerWallet', 'gridWallet'].forEach(function (id) {
      var node = $(id);
      if (!node) return;
      node.hidden = !wallet.real;
      if (wallet.real) node.textContent = text;
      node.classList.toggle('demo', !wallet.real);
    });
    var shop = $('shopWallet');
    if (shop) shop.textContent = num(wallet.amount);
    var topups = ['demoTopup', 'shopTopup'];
    topups.forEach(function (id) {
      var node = $(id);
      if (node) node.hidden = true;
    });
    var mode = $('modeBadge');
    if (mode) mode.hidden = true;
  }

  function renderWidgetSwitch() {
    var toggle = $('widgetToggle');
    var state = $('widgetStateText');
    if (!toggle) return;
    var has = !!core.current();
    var on = has && !!(core.state() && core.state().widget && core.state().widget.on);
    toggle.hidden = false;
    toggle.disabled = false;
    toggle.classList.toggle('on', on);
    toggle.setAttribute('aria-checked', on ? 'true' : 'false');
    var pending = has && on && !window.TafeiSpiritWidgetLoaded;
    if (state) state.textContent = has ? (pending ? '正在放出…' : (on ? '已放出' : '未放出')) : '先领一个伙伴';
  }

  function renderStats() {
    var stats = core.stats ? core.stats() : {interactions: 0, pets: 0, drags: 0, bumps: 0, days: []};
    var days = Array.isArray(stats.days) ? stats.days.length : 0;
    if ($('statInteractions')) $('statInteractions').textContent = String(stats.interactions || 0);
    if ($('statDays')) $('statDays').textContent = String(days);
    if ($('statBumps')) $('statBumps').textContent = String(stats.bumps || 0);
    if ($('statDrags')) $('statDrags').textContent = String(stats.drags || 0);
    if ($('companionDays')) $('companionDays').textContent = '陪伴 ' + days + ' 天';
    var badges = $('companionBadges');
    if (!badges || !core.achievements) return;
    badges.innerHTML = core.achievements().map(function (item) {
      return '<span class="cs-badge' + (item.done ? ' done' : '') + '" title="' + item.desc + '">'
        + (item.done ? '✓ ' : '') + item.title
        + '<i>' + Math.min(item.current, item.need) + '/' + item.need + '</i></span>';
    }).join('');
  }

  function renderWidgetSettings() {
    var w = (core.state() && core.state().widget) || {};
    var size = Number(w.size) || 1;
    var opacity = w.opacity == null ? 1 : Number(w.opacity);
    var sizeInput = $('wsSize');
    var opacityInput = $('wsOpacity');
    if (sizeInput) sizeInput.value = String(Math.round(size * 100));
    if (opacityInput) opacityInput.value = String(Math.round(opacity * 100));
    if ($('wsSizeVal')) $('wsSizeVal').textContent = Math.round(size * 100) + '%';
    if ($('wsOpacityVal')) $('wsOpacityVal').textContent = Math.round(opacity * 100) + '%';
    if ($('wsAutoWalk')) $('wsAutoWalk').checked = w.autoWalk !== false;
    if ($('wsParticles')) $('wsParticles').checked = w.particles !== false;
    if ($('wsSpeech')) $('wsSpeech').checked = w.speech !== false;
    if ($('wsSound')) $('wsSound').checked = w.sound === true;
    if ($('wsEdgeHide')) $('wsEdgeHide').checked = w.edgeHide !== false;
    document.querySelectorAll('[data-ws-mode]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-ws-mode') === (w.mode || 'lively'));
    });
  }

  function setMeter(prefix, key, value) {
    var bar = $(prefix + key + 'Bar');
    var val = $(prefix + key + 'Val');
    if (bar) bar.style.width = clamp(value, 0, 100) + '%';
    if (val) val.textContent = String(num(value));
  }
  function renderMeters(prefix) {
    var s = core.status();
    setMeter(prefix, 'Satiety', s.satiety);
    setMeter(prefix, 'Mood', s.mood);
    setMeter(prefix, 'Anger', s.anger);
    setMeter(prefix, 'Sleep', s.sleepiness);
  }

  function webpAvatar(src) {
    return src && /avatar\.png(?:\?.*)?$/i.test(src) ? src.replace(/avatar\.png(?:\?.*)?$/i, 'avatar.webp') : src;
  }

  function webpGrid(src) {
    return src && /main\.png(?:\?.*)?$/i.test(src) ? src.replace(/main\.png(?:\?.*)?$/i, 'grid.webp') : src;
  }

  function skinImage(skin) {
    var src = skin && (skin.avatar || skin.img);
    return src ? '<img src="' + esc(webpAvatar(src)) + '" alt="" loading="lazy" decoding="async">' : '<span class="skin-swatch-fallback">✦</span>';
  }

  function skinOptionHtml(skin, active) {
    var owned = core.isSkinOwned(skin.id);
    var price = core.priceOfSkin(skin.id);
    var meta = active ? '当前穿着' : owned ? '已拥有' : (price > 0 ? price + ' 额度' : '待解锁');
    return '<button type="button" class="skin-option' + (active ? ' active' : '') + (owned ? '' : ' locked') + '"'
      + ' data-skin="' + esc(skin.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '">'
      + skinImage(skin)
      + '<i class="skin-option-copy"><b>' + esc(skin.name) + '</b><em>' + esc(meta) + '</em></i>'
      + '</button>';
  }

  function skinMoreHtml() {
    return '<div class="skin-more" aria-hidden="true"><span>+</span><b>更多皮肤</b><em>后续上新</em></div>';
  }

  function renderPartnerSkins(spirit, skin) {
    var wrap = $('partnerSkins');
    var list = $('partnerSkinList');
    var meta = $('partnerSkinMeta');
    if (!wrap || !list) return;
    if (!spirit || !skin) {
      wrap.hidden = true;
      list.innerHTML = '';
      return;
    }
    var skins = core.skinsOf(spirit.id);
    wrap.hidden = false;
    if (meta) meta.textContent = skins.length + ' 款 · 点选换装';
    list.innerHTML = skins.map(function (item) {
      return skinOptionHtml(item, item.id === skin.id);
    }).join('') + skinMoreHtml();
  }

  function renderDock() {
    var snap = core.snapshot();
    var spirit = snap.current;
    var skin = snap.skin;
    var dock = document.querySelector('.partner-dock');
    var img = $('partnerDockImg');
    var tag = $('partnerDockTag');
    var name = $('partnerDockName');
    var line = $('partnerDockLine');
    var condition = $('partnerCondition');
    var bond = $('partnerBond');
    var toggle = $('widgetToggle');
    if (!spirit || !skin) {
      if (dock) dock.classList.add('is-empty');
      if (img) {
        img.src = 'assets/spirits/xiaota-v23/avatar.png';
        img.alt = '还没有伙伴';
      }
      if (tag) tag.textContent = '待领取';
      if (name) name.textContent = '还没有伙伴';
      if (line) line.textContent = '先在下面的图鉴里免费领取小挞飞；其他款式按后台设置获取。';
      if (condition) condition.textContent = '还没有伙伴';
      if (bond) bond.textContent = '—';
      var emptyBondLevel = $('partnerBondLevel');
      if (emptyBondLevel) emptyBondLevel.textContent = '—';
      renderWidgetSwitch();
      renderPartnerSkins(null, null);
      renderWallet();
      return;
    }
    if (dock) dock.classList.remove('is-empty');
    if (img) {
      var avatar = skin.avatar || skin.img;
      var avatarSrc = webpAvatar(avatar);
      img.onerror = function () {
        img.onerror = null;
        if (avatar) img.src = avatar;
      };
      if (img.getAttribute('src') !== avatarSrc) img.src = avatarSrc;
      img.alt = spirit.name + ' · ' + skin.name;
    }
    if (tag) tag.textContent = spirit.tag;
    if (name) name.textContent = spirit.name;
    if (line) line.textContent = skin.quote || spirit.line;
    if (condition) condition.textContent = snap.conditionText;
    renderMeters('dock');
    if (bond) bond.textContent = String(num(core.state().bond[spirit.id]));
    var bondInfo = snap.bondLevel || core.bondInfo(spirit.id);
    var bondLevel = $('partnerBondLevel');
    if (bondLevel) bondLevel.textContent = 'Lv.' + bondInfo.level + ' ' + bondInfo.title;
    var avatarBox = $('partnerAvatarBox');
    if (avatarBox) {
      avatarBox.classList.toggle('has-bond-ring', bondInfo.level >= 3);
      avatarBox.classList.toggle('has-bond-frame', bondInfo.level >= 7);
    }
    if (toggle) {
      renderWidgetSwitch();
    }
    renderPartnerSkins(spirit, skin);
    renderWallet();
  }

  function renderBond() {
    var panel = $('bondPanel');
    var snap = core.snapshot();
    if (!panel) return;
    if (!snap.current) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    var info = core.bondInfo(snap.current.id);
    var badge = $('bondLevelBadge');
    var title = $('bondLevelTitle');
    var total = $('bondTotal');
    var progress = $('bondProgressBar');
    var nextText = $('bondNextText');
    var currentReward = $('bondCurrentReward');
    var nextReward = $('bondNextReward');
    var levels = $('bondLevels');
    if (badge) badge.textContent = 'Lv.' + info.level;
    if (title) title.textContent = info.title;
    if (total) total.textContent = String(info.bond);
    if (progress) progress.style.width = info.progress + '%';
    if (nextText) nextText.textContent = info.next
      ? '再互动 ' + info.toNext + ' 点亲密度，升到 Lv.' + info.next.level + ' ' + info.next.title
      : '已满级，所有等级权益已解锁';
    if (currentReward) currentReward.textContent = info.reward;
    if (nextReward) nextReward.textContent = info.next ? info.next.reward : '已满级';
    var sigWrap = $('bondSignatureWrap');
    var sigText = $('bondSignatureText');
    if (sigWrap && sigText) {
      sigWrap.hidden = !info.signature;
      sigText.textContent = info.signature || '';
    }
    var memorialBtn = $('bondMemorialBtn');
    if (memorialBtn) memorialBtn.hidden = info.level < 10;
    if (levels) {
      levels.innerHTML = info.levels.map(function (row) {
        var stateClass = info.level === row.level ? ' current' : (info.level > row.level ? ' done' : '');
        return '<div class="bond-chip' + stateClass + '"' + (info.level === row.level ? ' aria-current="true"' : '') + '>'
          + '<b>Lv.' + row.level + '</b><span>' + esc(row.title) + '</span><em>' + esc(row.reward) + '</em></div>';
      }).join('');
    }
    var booking = $('bondBooking');
    if (booking) {
      var issue = snap.current.name + ' Lv.' + info.level + ' · ' + info.title + ' · 精灵权益';
      if (info.level >= 5) issue += '，申请优先排期';
      booking.href = 'service.html?from=spirit&service=' + encodeURIComponent('还不确定，先咨询') + '&issue=' + encodeURIComponent(issue);
    }
  }

  function cardButton(spirit, unlocked, selected) {
    if (selected) return '<button class="spirit-open is-current" type="button" disabled>当前全站伙伴</button>';
    if (unlocked) return '<button class="spirit-open is-select" type="button" data-card-action="select" data-id="' + esc(spirit.id) + '">设为全站伙伴</button>';
    var mode = core.modeOfSpirit(spirit.id);
    var price = core.priceOfSpirit(spirit.id);
    if (mode === 'request') return '<button class="spirit-open is-contact" type="button" data-card-action="open" data-id="' + esc(spirit.id) + '">联系站长获取<span class="price-mini">私人上架</span></button>';
    if (mode === 'free' || price === 0) return '<button class="spirit-open is-claim" type="button" data-card-action="claim" data-id="' + esc(spirit.id) + '">免费领取<span class="price-mini">挞飞原创</span></button>';
    return '<button class="spirit-open is-locked" type="button" data-card-action="open" data-id="' + esc(spirit.id) + '">查看并解锁<span class="price-mini">' + price + ' 额度</span></button>';
  }

  function renderGrid() {
    if (!grid) return;
    var selected = core.state().selected;
    var selectedLevel = selected ? core.bondInfo(selected).level : 0;
    var signature = selected + '|' + selectedLevel + '|' + core.SPIRITS.map(function (spirit) {
      return spirit.id + ':' + (core.isUnlocked(spirit.id) ? 1 : 0) + ':' + core.modeOfSpirit(spirit.id) + ':' + core.priceOfSpirit(spirit.id);
    }).join(',');
    if (signature === gridSig) return;
    gridSig = signature;
    grid.innerHTML = core.SPIRITS.map(function (spirit) {
      var unlocked = core.isUnlocked(spirit.id);
      var isSelected = selected === spirit.id;
      var frame = isSelected && selectedLevel >= 7 ? ' is-bond-frame' : '';
      var price = core.priceOfSpirit(spirit.id);
      var mode = core.modeOfSpirit(spirit.id);
      var skin = core.skinsOf(spirit.id)[0];
      var priceLabel = unlocked ? '<span class="spirit-price free">已解锁</span>' : mode === 'request' ? '<span class="spirit-price request">私人上架</span>' : (mode === 'free' || price === 0 ? '<span class="spirit-price free">免费</span>' : '<span class="spirit-price">' + price + ' 额度</span>');
      return '<article class="spirit-card' + (unlocked ? '' : ' is-locked') + (isSelected ? ' is-selected' : '') + frame + '">'
        + '<div class="spirit-flag' + (spirit.original ? ' original' : '') + '">' + esc(spirit.tag) + '</div>'
        + '<button class="spirit-cover" type="button" data-card-action="open" data-id="' + esc(spirit.id) + '" aria-label="查看' + esc(spirit.name) + '">'
        + '<img src="' + esc(webpGrid(skin.img)) + '" data-fallback="' + esc(skin.img) + '" alt="' + esc(spirit.name) + ' Q 版角色卡" width="512" height="512" loading="lazy" decoding="async" fetchpriority="low"></button>'
        + '<div class="spirit-info"><span class="spirit-game">' + esc(spirit.game) + '</span><h2>' + esc(spirit.name) + '</h2><p>' + esc(spirit.intro) + '</p>'
        + '<div class="spirit-price-line"><span>' + (unlocked ? '已在小屋里' : '未解锁') + '</span>' + priceLabel + '</div>'
        + cardButton(spirit, unlocked, isSelected)
        + '</div></article>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('img[data-fallback]'), function (img) {
      img.addEventListener('error', function () {
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = '1';
        img.src = img.dataset.fallback;
      });
    });
  }

  function renderSkins() {
    var spirit = currentModal ? core.spiritById(currentModal) : null;
    var forms = $('spiritForms');
    if (!spirit || !core.isUnlocked(spirit.id)) {
      if (forms) { forms.innerHTML = ''; forms.hidden = true; }
      return;
    }
    var skins = core.skinsOf(spirit.id);
    if (!forms) return;
    forms.hidden = false;
    forms.classList.add('spirit-skin-gallery');
    var selectedSkin = core.state().selectedSkin;
    if (core.state().selected !== spirit.id) {
      selectedSkin = (core.skinById(spirit.defaultSkin) || skins[0] || {}).id;
    }
    forms.innerHTML = '<div class="spirit-skins-head"><span>皮肤选择</span><em>' + skins.length + ' 款 · 点选换装 · 后续可加</em></div>'
      + '<div class="spirit-skin-list">'
      + skins.map(function (skin) { return skinOptionHtml(skin, skin.id === selectedSkin); }).join('')
      + '</div>';
  }

  function renderModal() {
    if (!currentModal) return;
    var spirit = core.spiritById(currentModal);
    if (!spirit) return;
    var unlocked = core.isUnlocked(spirit.id);
    var selected = core.state().selected === spirit.id;
    var skin = unlocked ? (selected ? core.skin() : (core.skinById(spirit.defaultSkin) || core.skinsOf(spirit.id)[0])) : core.skinsOf(spirit.id)[0];
    if (selected) skin = core.skin();
    $('spiritModalImg').src = skin.img;
    $('spiritModalImg').alt = spirit.name + ' · ' + skin.name;
    $('spiritModalName').textContent = spirit.name;
    $('spiritModalGame').textContent = spirit.game;
    $('spiritModalTag').textContent = spirit.tag;
    var line = skin.quote || spirit.quote;
    if (unlocked && selected) {
      var liveLine = core.bondLine(spirit.id);
      if (liveLine) line = liveLine;
    }
    $('spiritModalLine').textContent = unlocked ? line : spirit.intro;
    var modalInfo = core.bondInfo(spirit.id);
    $('spiritBond').textContent = String(num(core.state().bond[spirit.id]));
    $('spiritBondHint').textContent = modalInfo.next
      ? 'Lv.' + modalInfo.level + ' ' + modalInfo.title + ' · 还差 ' + modalInfo.toNext + ' 点升 Lv.' + modalInfo.next.level
      : 'Lv.' + modalInfo.level + ' ' + modalInfo.title + ' · 已满级';
    if (modalInfo.honor && modalInfo.level >= 9) {
      $('spiritBondHint').textContent += ' · 专属称号「' + modalInfo.honor + '」';
    }
    var note = $('spiritModalNote');
    if (note) note.textContent = core.modeOfSpirit(spirit.id) === 'request' ? '这款不开放额度购买；把账号和款式发给站长，由后台私下发放。' : '同人 Q 版展示，非官方原画；额度以站内账户为准。';
    renderMeters('modal');
    renderSkins();
    var unlock = $('spiritUnlock');
    var set = $('spiritSet');
    unlock.classList.remove('show');
    set.classList.remove('show', 'current');
    if (!unlocked) {
      unlock.classList.add('show');
      unlock.disabled = false;
      var mode = core.modeOfSpirit(spirit.id);
      var price = mode === 'free' ? 0 : core.priceOfSpirit(spirit.id);
      if (mode === 'request') {
        unlock.textContent = '联系站长获取';
      } else {
        unlock.textContent = price > 0 ? '解锁 · ' + price + ' 额度' : '免费解锁';
        if (walletInfo().amount < price) {
          unlock.textContent = '额度不足 · 还差 ' + (price - walletInfo().amount);
          unlock.disabled = true;
        }
      }
      $('spiritPet').disabled = true;
      $('spiritFeed').disabled = true;
      $('spiritPlay').disabled = true;
    } else {
      $('spiritPet').disabled = false;
      $('spiritFeed').disabled = false;
      $('spiritPlay').disabled = false;
      set.classList.add('show');
      if (selected) {
        set.classList.add('current');
        set.textContent = '当前全站伙伴';
        set.disabled = true;
      } else {
        set.textContent = '设为全站伙伴';
        set.disabled = false;
      }
    }
    var feedCount = core.ITEMS.filter(function (i) { return i.kind === 'food' && core.inventoryOf(i.id) > 0; }).length;
    var toyCount = core.ITEMS.filter(function (i) { return i.kind === 'toy' && core.inventoryOf(i.id) > 0; }).length;
    $('spiritFeed').textContent = feedCount ? '喂点东西 · ' + feedCount + ' 种' : '喂点东西';
    $('spiritPlay').textContent = toyCount ? '玩玩具 · ' + toyCount + ' 种' : '玩玩具';
  }

  function openSpirit(id) {
    currentModal = id;
    modal.hidden = false;
    document.body.classList.add('spirit-modal-open');
    renderModal();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('spirit-modal-open');
    currentModal = null;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawMemorial() {
    var canvas = $('memorialCanvas');
    if (!canvas || !canvas.getContext) return;
    var spirit = core.current();
    var skin = core.skin();
    if (!spirit || !skin) return;
    var info = core.bondInfo(spirit.id);
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var base = new Image();
    var portrait = new Image();
    var baseReady = false;
    var portraitReady = false;
    var loaded = 0;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    function drawFallback() {
      var gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, '#081126');
      gradient.addColorStop(0.48, '#152447');
      gradient.addColorStop(1, '#3a2240');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,211,110,.55)';
      ctx.lineWidth = 2;
      roundRect(ctx, 24, 24, w - 48, h - 48, 28);
      ctx.stroke();
    }

    function drawPortrait() {
      if (!portraitReady) return;
      ctx.save();
      ctx.shadowColor = 'rgba(255,196,92,.28)';
      ctx.shadowBlur = 26;
      drawImageContain(ctx, portrait, 54, 108, w - 108, 470);
      ctx.restore();
    }

    function paint() {
      ctx.clearRect(0, 0, w, h);
      if (baseReady) ctx.drawImage(base, 0, 0, w, h);
      else drawFallback();

      // 底部渐暗，保证动态文字在星云和浪纹上仍然可读
      var fade = ctx.createLinearGradient(0, h * 0.52, 0, h * 0.97);
      fade.addColorStop(0, 'rgba(5,10,24,0)');
      fade.addColorStop(0.34, 'rgba(5,10,24,.58)');
      fade.addColorStop(0.62, 'rgba(5,10,24,.88)');
      fade.addColorStop(1, 'rgba(5,10,24,.92)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, h * 0.5, w, h * 0.5);

      drawPortrait();

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd36e';
      ctx.font = '600 22px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('TAFEI · SPIRIT HOUSE', 74, 72);
      ctx.fillStyle = 'rgba(236,244,255,.64)';
      ctx.font = '400 15px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('永久纪念卡 · PERMANENT MEMORY', 74, 96);

      ctx.fillStyle = 'rgba(255,211,110,.92)';
      ctx.font = '500 20px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('永远的伙伴', 72, 646);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 44px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(spirit.name, 72, 696);

      ctx.fillStyle = '#ffd36e';
      ctx.font = '500 18px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('Lv.' + info.level + ' · ' + info.title + ' · 亲密度 ' + info.bond, 72, 736);

      if (info.honor) {
        ctx.fillStyle = '#8ce8ff';
        ctx.font = '500 16px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('专属称号 · ' + info.honor, 72, 768);
      }

      ctx.strokeStyle = 'rgba(255,211,110,.36)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(72, 790);
      ctx.lineTo(w - 72, 790);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = '400 17px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      wrapText(ctx, '「' + (info.line || spirit.quote || spirit.line) + '」', 72, 824, w - 144, 28);

      var now = new Date();
      var date = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0');
      ctx.fillStyle = 'rgba(236,244,255,.46)';
      ctx.font = '400 13px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('记录于 ' + date + ' · 挞飞精灵小屋', 72, h - 50);
      ctx.restore();

      var link = $('memorialDownload');
      if (link) {
        try { link.href = canvas.toDataURL('image/png'); }
        catch (error) { link.hidden = true; }
      }
    }

    function ready() {
      loaded += 1;
      if (loaded >= 2) paint();
    }

    base.onload = function () { baseReady = true; ready(); };
    base.onerror = function () { baseReady = false; ready(); };
    portrait.onload = function () { portraitReady = true; ready(); };
    portrait.onerror = function () { portraitReady = false; ready(); };
    base.src = 'assets/spirits/xiaota-v23/memorial-blank.jpg';
    portrait.src = skin.img;
  }

  function drawImageContain(ctx, img, x, y, maxWidth, maxHeight) {
    var ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
    var width = img.width * ratio;
    var height = img.height * ratio;
    ctx.drawImage(img, x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var line = '';
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = text[i];
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y);
  }

  function openMemorial() {
    var snap = core.snapshot();
    if (!snap.current) { toast('先领取一个伙伴。', true); return; }
    var info = core.bondInfo(snap.current.id);
    if (info.level < 10) {
      toast('Lv.10「永远的伙伴」才会解锁永久纪念卡，现在是 Lv.' + info.level + '。', true);
      return;
    }
    var node = $('memorialModal');
    if (!node) return;
    node.hidden = false;
    document.body.classList.add('spirit-memorial-open');
    drawMemorial();
  }

  function closeMemorial() {
    var node = $('memorialModal');
    if (node) node.hidden = true;
    document.body.classList.remove('spirit-memorial-open');
  }

  function copySignature() {
    var snap = core.snapshot();
    if (!snap.current) return;
    var text = core.signature(snap.current.id);
    if (!text) { toast('Lv.6「重要的人」才会解锁私信签名。', true); return; }
    var done = function () { toast('私信签名已复制。'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try { document.execCommand('copy'); done(); } catch (error) { toast('复制失败，请手动选中签名。', true); }
    document.body.removeChild(input);
  }

  function itemCard(item) {
    var count = core.inventoryOf(item.id);
    var price = core.priceOfItem(item.id);
    var used = 0;
    if (item.kind === 'toy') used = Number(core.state().today.toys[item.id]) || 0;
    var limit = item.dailyLimit || 0;
    var canUse = count > 0 && (item.kind !== 'toy' || !limit || used < limit);
    var effect = [];
    if (item.effect.satiety) effect.push('饱腹 ' + (item.effect.satiety > 0 ? '+' : '') + item.effect.satiety);
    if (item.effect.mood) effect.push('心情 ' + (item.effect.mood > 0 ? '+' : '') + item.effect.mood);
    if (item.effect.anger) effect.push('怒气 ' + item.effect.anger);
    if (item.effect.sleepiness) effect.push('困意 ' + (item.effect.sleepiness > 0 ? '+' : '') + item.effect.sleepiness);
    if (item.effect.bond) effect.push('亲密 +' + item.effect.bond);
    var meta = effect.map(function (e) { return '<span>' + esc(e) + '</span>'; }).join('');
    if (item.kind === 'toy') meta += '<span>今日 ' + used + '/' + limit + '</span>';
    return '<article class="item-card" data-kind="' + esc(item.kind) + '">'
      + '<div class="item-card-top"><div class="item-icon">' + esc(item.icon) + '</div><div class="item-copy"><h4>' + esc(item.name) + '</h4><p>' + esc(item.desc) + '</p><div class="item-meta">' + meta + '</div></div></div>'
      + '<div class="item-foot"><span class="item-price">' + (price > 0 ? price + ' 额度' : '免费') + ' <small>· 库存 ' + count + '</small></span>'
      + '<span class="item-actions"><button type="button" class="buy" data-item-buy="' + esc(item.id) + '">买一个</button>'
      + '<button type="button" data-item-use="' + esc(item.id) + '"' + (canUse ? '' : ' disabled') + '>' + (item.kind === 'toy' ? '玩' : '吃') + '</button></span></div>'
      + '</article>';
  }

  function renderShop() {
    var signature = core.ITEMS.map(function (item) {
      var used = item.kind === 'toy' ? (Number(core.state().today.toys[item.id]) || 0) : 0;
      return item.id + ':' + core.inventoryOf(item.id) + ':' + used;
    }).join(',');
    if (signature !== shopSig) {
      shopSig = signature;
      if (foodGrid) foodGrid.innerHTML = core.ITEMS.filter(function (i) { return i.kind === 'food'; }).map(itemCard).join('');
      if (toyGrid) toyGrid.innerHTML = core.ITEMS.filter(function (i) { return i.kind === 'toy'; }).map(itemCard).join('');
    }
    renderWallet();
  }

  function renderAll() {
    renderDock();
    renderBond();
    renderGrid();
    renderShop();
    renderStats();
    renderWidgetSettings();
    if (currentModal) renderModal();
  }

  function firstItem(kind) {
    var list = core.ITEMS.filter(function (item) {
      return item.kind === kind && core.inventoryOf(item.id) > 0;
    });
    return list.length ? list[0] : null;
  }

  function handleBuySpirit(id) {
    if (busy) return;
    var spirit = core.spiritById(id);
    if (!spirit) return;
    if (core.modeOfSpirit(id) === 'request') {
      toast('这款由站长后台私下发放，不扣额度。联系站长 QQ ' + CONTACT_QQ + '，备注账号和「' + spirit.name + '」。');
      return;
    }
    var price = core.priceOfSpirit(id);
    if (price > 0 && !window.confirm('用 ' + price + ' 额度解锁「' + spirit.name + '」？')) return;
    busy = true;
    Promise.resolve(core.buySpirit(id)).then(function () {
      core.selectSpirit(id, core.spiritById(id).defaultSkin);
      toast('已解锁 ' + spirit.name + '，并设成全站伙伴。');
      if (currentModal === id) { currentModal = id; renderModal(); }
    }).catch(function (error) {
      toast(error.message || '解锁失败。', true);
    }).finally(function () { busy = false; renderAll(); });
  }

  function handleBuySkin(id) {
    if (busy) return;
    var skin = core.skinById(id);
    if (!skin) return;
    var price = core.priceOfSkin(id);
    if (price > 0 && !window.confirm('用 ' + price + ' 额度解锁「' + skin.name + '」？')) return;
    busy = true;
    Promise.resolve(core.buySkin(id)).then(function () {
      core.selectSkin(id);
      toast('已换上「' + skin.name + '」。');
    }).catch(function (error) {
      toast(error.message || '皮肤解锁失败。', true);
    }).finally(function () { busy = false; renderAll(); });
  }

  function handleBuyItem(id) {
    if (busy) return;
    var item = core.itemById(id);
    if (!item) return;
    busy = true;
    Promise.resolve(core.buyItem(id, 1)).then(function () {
      toast('买到了「' + item.name + '」。');
    }).catch(function (error) {
      toast(error.message || '购买失败。', true);
    }).finally(function () { busy = false; renderAll(); });
  }

  function handleUseItem(id) {
    var item = core.itemById(id);
    if (!item) return;
    try {
      var beforeLevel = core.bondInfo(core.state().selected).level;
      core.useItem(id, core.state().selected);
      var afterInfo = core.bondInfo(core.state().selected);
      if (afterInfo.level > beforeLevel) {
        toast('亲密度升级！现在是 Lv.' + afterInfo.level + ' ' + afterInfo.title + '，' + afterInfo.reward + '。');
      } else {
        toast('用了「' + item.name + '」，' + (item.kind === 'food' ? '她吃得很认真。' : '她玩得很开心。'));
      }
      if (currentModal) renderModal();
      renderAll();
    } catch (error) {
      toast(error.message || '使用失败。', true);
    }
  }

  // 卡片和皮肤事件
  document.addEventListener('click', function (event) {
    var claim = event.target.closest('[data-card-action="claim"]');
    if (claim) {
      handleBuySpirit(claim.getAttribute('data-id'));
      return;
    }
    var open = event.target.closest('[data-card-action="open"]');
    if (open) {
      openSpirit(open.getAttribute('data-id'));
      return;
    }
    var select = event.target.closest('[data-card-action="select"]');
    if (select) {
      try {
        core.selectSpirit(select.getAttribute('data-id'));
        toast('已换成 ' + core.current().name + '，全站伙伴会同步更新。');
        renderAll();
      } catch (error) { toast(error.message || '切换失败。', true); }
      return;
    }
    var buyItem = event.target.closest('[data-item-buy]');
    if (buyItem) { handleBuyItem(buyItem.getAttribute('data-item-buy')); return; }
    var useItem = event.target.closest('[data-item-use]');
    if (useItem) { handleUseItem(useItem.getAttribute('data-item-use')); return; }
    var skin = event.target.closest('[data-skin]');
    if (skin) {
      var skinId = skin.getAttribute('data-skin');
      if (core.isSkinOwned(skinId)) {
        try {
          core.selectSkin(skinId);
          toast('已换上「' + core.skinById(skinId).name + '」。');
          renderAll();
        } catch (error) { toast(error.message || '换装失败。', true); }
      } else {
        handleBuySkin(skinId);
      }
    }
  });

  $('spiritModalClose')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', function (event) { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (!$('memorialModal')?.hidden) closeMemorial();
      else if (!$('spiritModal')?.hidden) closeModal();
    }
  });

  $('bondMemorialBtn')?.addEventListener('click', openMemorial);
  $('bondSignatureCopy')?.addEventListener('click', copySignature);
  $('memorialClose')?.addEventListener('click', closeMemorial);
  $('memorialCloseBottom')?.addEventListener('click', closeMemorial);
  $('memorialModal')?.addEventListener('click', function (event) {
    if (event.target === $('memorialModal')) closeMemorial();
  });

  $('spiritPet')?.addEventListener('click', function () {
    if (!currentModal || !core.isUnlocked(currentModal)) return;
    try {
      var beforeLevel = core.bondInfo(currentModal).level;
      core.pet(currentModal);
      var afterInfo = core.bondInfo(currentModal);
      toast(afterInfo.level > beforeLevel
        ? '亲密度升级！现在是 Lv.' + afterInfo.level + ' ' + afterInfo.title + '，' + afterInfo.reward + '。'
        : '她轻轻蹭了蹭你的手，亲密度 +1。');
      renderAll();
    } catch (error) { toast(error.message || '互动失败。', true); }
  });

  $('spiritFeed')?.addEventListener('click', function () {
    if (!currentModal || !core.isUnlocked(currentModal)) return;
    var item = firstItem('food');
    if (!item) { toast('零食铺还没有食物，先买一个。'); return; }
    handleUseItem(item.id);
  });

  $('spiritPlay')?.addEventListener('click', function () {
    if (!currentModal || !core.isUnlocked(currentModal)) return;
    var item = firstItem('toy');
    if (!item) { toast('玩具架还没有玩具，先买一个。'); return; }
    handleUseItem(item.id);
  });

  $('spiritUnlock')?.addEventListener('click', function () {
    if (currentModal) handleBuySpirit(currentModal);
  });
  $('spiritSet')?.addEventListener('click', function () {
    if (!currentModal) return;
    try {
      core.selectSpirit(currentModal, core.spiritById(currentModal).defaultSkin);
      toast('已设成全站伙伴，首页和她站里的位置会同步更新。');
      renderAll();
    } catch (error) { toast(error.message || '切换失败。', true); }
  });

  function addDemoCredits() {
    core.setDemoCredits(core.state().credits + 100);
    toast('测试额度 +100，只用于本地原型。');
    renderAll();
  }
  $('demoTopup')?.addEventListener('click', addDemoCredits);
  $('shopTopup')?.addEventListener('click', addDemoCredits);

  $('widgetToggle')?.addEventListener('click', function () {
    if (!core.current()) {
      toast('先在图鉴里免费领取小挞飞，再放出全站挂件。');
      document.getElementById('spiritGrid')?.scrollIntoView({behavior: 'smooth', block: 'start'});
      return;
    }
    var nextOn = !core.state().widget.on;
    var wasLoaded = !!window.TafeiSpiritWidgetLoaded;
    core.setWidget(nextOn);
    renderAll();
    if (nextOn) {
      if (!wasLoaded) toast('正在放出全站挂件…');
      loadWidgetScript().then(function () {
        renderAll();
        if (core.state().widget.on) toast('全站挂件已出现：电脑端会出现在页面右下角，也能拖到任意位置。');
      }).catch(function () {
        if (!core.state().widget.on) return;
        core.setWidget(false);
        renderAll();
        toast('挂件加载失败，请刷新页面再试。', true);
      });
    } else {
      toast('全站挂件已收起。');
    }
  });

  $('widgetSettingsToggle')?.addEventListener('click', function () {
    var panel = $('widgetSettings');
    if (!panel) return;
    var open = panel.hidden;
    panel.hidden = !open;
    this.setAttribute('aria-expanded', String(open));
    var widget = document.getElementById('spiritWidget');
    if (widget) widget.classList.toggle('settings-open', open);
    if (open) renderWidgetSettings();
  });

  function saveWidgetInput(key, value) {
    var patch = {};
    patch[key] = value;
    core.setWidgetOptions(patch);
  }

  ['wsSize', 'wsOpacity'].forEach(function (id) {
    var input = $(id);
    if (!input) return;
    input.addEventListener('input', function () {
      var out = $(id === 'wsSize' ? 'wsSizeVal' : 'wsOpacityVal');
      if (out) out.textContent = Math.round(Number(input.value)) + '%';
    });
    input.addEventListener('change', function () {
      saveWidgetInput(id === 'wsSize' ? 'size' : 'opacity', Number(input.value) / 100);
    });
  });

  [['wsAutoWalk', 'autoWalk'], ['wsParticles', 'particles'], ['wsSpeech', 'speech'], ['wsSound', 'sound'], ['wsEdgeHide', 'edgeHide']].forEach(function (row) {
    var input = $(row[0]);
    if (!input) return;
    input.addEventListener('change', function () { saveWidgetInput(row[1], input.checked); });
  });

  document.querySelectorAll('[data-ws-mode]').forEach(function (button) {
    button.addEventListener('click', function () {
      var mode = button.getAttribute('data-ws-mode');
      if (mode === 'quiet') core.setWidgetOptions({mode: 'quiet', particles: false, speech: false});
      else core.setWidgetOptions({mode: 'lively', particles: true, speech: true});
      renderWidgetSettings();
    });
  });

  core.subscribe(function () {
    renderAll();
    primeWidget();
  });
  core.refreshWallet().finally(renderAll);

  // 初次渲染
  renderAll();
  primeWidget();
})();
