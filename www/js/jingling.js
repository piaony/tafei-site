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
  var galleryModal = $('spiritGalleryModal');
  var toastTimer = 0;
  var currentModal = null;
  var busy = false;
  var CONTACT_QQ = '3659229103';
  var gridSig = '';
  var shopSig = '';
  var widgetLoader = null;
  var overlayPending = false;

  function loadWidgetScript() {
    if (window.TafeiSpiritWidgetLoaded) return Promise.resolve();
    if (widgetLoader) return widgetLoader;
    widgetLoader = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'js/spirit-widget.js?v=20';
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
    var list = core.SPIRITS.filter(function (spirit) {
      return core.isSpiritEnabled(spirit.id) || core.isUnlocked(spirit.id);
    });
    var signature = selected + '|' + selectedLevel + '|' + list.map(function (spirit) {
      return spirit.id + ':' + (core.isUnlocked(spirit.id) ? 1 : 0) + ':'
        + (core.isSpiritEnabled(spirit.id) ? 1 : 0) + ':' + core.modeOfSpirit(spirit.id) + ':' + core.priceOfSpirit(spirit.id);
    }).join(',');
    if (signature === gridSig) return;
    gridSig = signature;
    grid.innerHTML = list.map(function (spirit) {
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
    var countText = list.length + ' 位伙伴可获取';
    var countNode = $('galleryCount');
    if (countNode) countNode.textContent = String(list.length);
    var modalCount = $('galleryModalCount');
    if (modalCount) modalCount.textContent = countText;
    var faceNode = $('galleryFace');
    var faceSpirit = (selected && core.spiritById(selected)) || list[0];
    if (faceNode && faceSpirit) {
      var faceSkin = core.skinsOf(faceSpirit.id)[0];
      if (faceSkin) faceNode.src = webpGrid(faceSkin.img);
      try {
        if (window.TafeiNative && typeof TafeiNative.setOverlaySpirit === 'function') {
          TafeiNative.setOverlaySpirit(faceSpirit.id);
        }
      } catch (e) {}
    }
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
    var listed = skins.filter(function (skin) { return core.isSkinEnabled(skin.id) || core.isSkinOwned(skin.id); });
    forms.innerHTML = '<div class="spirit-skins-head"><span>皮肤选择</span><em>' + listed.length + ' 款 · 点选换装 · 后续可加</em></div>'
      + '<div class="spirit-skin-list">'
      + listed.map(function (skin) { return skinOptionHtml(skin, skin.id === selectedSkin); }).join('')
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

  function openGallery() {
    if (!galleryModal) return;
    galleryModal.hidden = false;
    document.body.classList.add('spirit-modal-open');
    renderGrid();
  }
  function closeGallery() {
    if (!galleryModal) return;
    galleryModal.hidden = true;
    if (!modal || modal.hidden) document.body.classList.remove('spirit-modal-open');
  }

  function openSpirit(id) {
    closeGallery();
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
      return item.id + ':' + (core.isItemEnabled(item.id) ? 1 : 0) + ':' + core.inventoryOf(item.id) + ':' + used;
    }).join(',');
    if (signature !== shopSig) {
      shopSig = signature;
      var shopItems = core.ITEMS.filter(function (i) { return core.isItemEnabled(i.id) || core.inventoryOf(i.id) > 0; });
      if (foodGrid) foodGrid.innerHTML = shopItems.filter(function (i) { return i.kind === 'food'; }).map(itemCard).join('');
      if (toyGrid) toyGrid.innerHTML = shopItems.filter(function (i) { return i.kind === 'toy'; }).map(itemCard).join('');
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

  $('galleryOpen')?.addEventListener('click', openGallery);
  $('galleryClose')?.addEventListener('click', closeGallery);
  $('galleryCloseBottom')?.addEventListener('click', closeGallery);
  galleryModal?.addEventListener('click', function (event) { if (event.target === galleryModal) closeGallery(); });
  $('spiritModalClose')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', function (event) { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (!$('memorialModal')?.hidden) closeMemorial();
      else if (galleryModal && !galleryModal.hidden) closeGallery();
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
      openGallery();
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

  /* 桌面精灵：只在 App 内出现，调用 TafeiNative 原生悬浮窗 */
  function nativeOverlayCall(name, fallback) {
    try {
      if (!window.TafeiNative || typeof TafeiNative[name] !== 'function') return fallback;
      var args = Array.prototype.slice.call(arguments, 2);
      var value = TafeiNative[name].apply(TafeiNative, args);
      return value == null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function refreshNativeOverlay() {
    var card = $('nativeOverlayCard');
    if (!card || card.hidden) return;
    var status = String(nativeOverlayCall('overlayStatus', 'off'));
    var isOn = status === 'on';
    var toggle = $('nativeOverlayToggle');
    var state = $('nativeOverlayState');
    if (toggle) {
      toggle.classList.toggle('on', isOn);
      toggle.setAttribute('aria-checked', String(isOn));
    }
    if (state) state.textContent = status === 'denied' ? '需要悬浮窗权限' : (isOn ? '已开启 · 退出 App 后生效' : '未开启');
    card.classList.toggle('on', isOn);
  }

  function initNativeOverlay() {
    var card = $('nativeOverlayCard');
    if (!card) return;
    if (String(nativeOverlayCall('overlaySupported', '0')) !== '1') return;
    card.hidden = false;
    var settings = $('nativeOverlaySettings');
    if (settings) settings.hidden = false;
    var size = $('noSize');
    var opacity = $('noOpacity');
    if (size) {
      size.value = String(nativeOverlayCall('overlaySize', 100));
      var sizeVal = $('noSizeVal');
      if (sizeVal) sizeVal.textContent = size.value + '%';
    }
    if (opacity) {
      opacity.value = String(nativeOverlayCall('overlayOpacity', 100));
      var opacityVal = $('noOpacityVal');
      if (opacityVal) opacityVal.textContent = opacity.value + '%';
    }
    var autonomy = $('noAutonomy');
    if (autonomy) autonomy.checked = String(nativeOverlayCall('overlayAutonomy', '1')) !== '0';
    var doodle = $('noDoodle');
    if (doodle) doodle.checked = String(nativeOverlayCall('overlayDoodle', '1')) !== '0';
    refreshNativeOverlay();
  }

  function renderDesktopProbe(raw) {
    var out = $('desktopProbeOut');
    if (!out) return;
    var data = null;
    try { data = JSON.parse(raw || '{}'); } catch (e) { data = null; }
    if (!data || !data.ok) {
      out.textContent = '探测失败：' + ((data && data.dbError) || '没有拿到原生返回。');
      updateDesktopProbeActions(null);
      return;
    }
    window.__tafeiLastProbe = data;
    dmState.pageCount = dmPageCount(data);
    var grid = dmGridSize(data);
    dmState.cols = grid.cols;
    dmState.rows = grid.rows;
    dmState.folderIds = dmBuildFolders(data);
    if (dmState.page >= dmState.pageCount) dmState.page = -1;
    renderPageTabs();
    renderDesktopIconList(data);
    updateDesktopProbeActions();
    var lines = [];
    var diagLines = data.diag || [];
    if (!Array.isArray(diagLines)) diagLines = String(diagLines).split(/\r?\n/);
    lines.push('系统：Android ' + (data.android || '?') + '（SDK ' + (data.sdk || '?') + '）');
    if (data.coloros) lines.push('ColorOS：' + data.coloros);
    if (data.model) lines.push('机型：' + data.model);
    if (data.display) lines.push('版本号：' + data.display);
    lines.push('');
    lines.push('桌面：' + (data.launcherPackage || '未识别') + (data.launcherVersion ? ' · ' + data.launcherVersion : ''));
    if (data.launcherLabel) lines.push('名称：' + data.launcherLabel);
    lines.push('Root：' + ({granted: '已授权', denied: '未授权 / 被拒绝', 'no-su': '没有找到 su'}[data.root] || data.root || '未知'));
    if (data.rootOutput) lines.push('Root 返回：' + data.rootOutput);
    lines.push('无障碍：' + (data.accessibility === 'on' ? '已开启' : '未开启'));
    lines.push('');
    if (data.dbPath) {
      lines.push('数据库：' + data.dbPath);
      lines.push('字段：' + (data.columns || []).join(', '));
      lines.push('快捷方式：' + (data.appShortcutCount || 0) + ' 个 / 总记录 ' + (data.totalRows || 0));
      var containers = data.containers || {};
      var keys = Object.keys(containers);
      if (keys.length) lines.push('容器分布：' + keys.map(function (k) { return k + '×' + containers[k]; }).join('  '));
      lines.push('');
      lines.push('样例：');
      (data.samples || []).slice(0, 12).forEach(function (item, index) {
        lines.push((index + 1) + '. ' + (item.label || item.package || '未命名') + ' · ' + (item.package || '?') + ' · 屏' + item.screen + ' (' + item.cellX + ',' + item.cellY + ')');
      });
      if (!(data.samples || []).length) lines.push('（没有读到 itemType=0 的桌面快捷方式）');
      lines.push('');
      lines.push('诊断：');
      if (diagLines.length) {
        diagLines.slice(0, 80).forEach(function (line, index) {
          lines.push((index + 1) + '. ' + String(line).slice(0, 320));
        });
      } else {
        lines.push('（没有诊断数据，请重新检测）');
      }
    } else {
      lines.push('数据库：未读取');
      lines.push('原因：' + (data.dbError || '未知'));
      lines.push('');
      lines.push('诊断：');
      if (diagLines.length) {
        diagLines.slice(0, 80).forEach(function (line, index) {
          lines.push((index + 1) + '. ' + String(line).slice(0, 320));
        });
      } else {
        lines.push('（没有诊断数据，请重新检测）');
      }
    }
    out.textContent = lines.join('\n');
  }

  var dmState = {
    data: null,
    selected: [],
    page: -1,
    search: '',
    pageCount: 1,
    cols: 4,
    rows: 6,
    folderIds: {},
    iconCache: {},
    iconQueue: [],
    iconLoading: false,
    target: null,
    actionTimer: 0,
    actionStartedAt: 0
  };

  function dmKey(item) {
    if (!item) return '';
    if (item.id && item.id > 0) return 'id:' + item.id;
    return [item.package || '', item.label || '', item.screen, item.cellX, item.cellY].join('|');
  }

  function dmSelectedItems() {
    var icons = (dmState.data && dmState.data.samples) || [];
    var map = {};
    icons.forEach(function (item) { map[dmKey(item)] = item; });
    return dmState.selected.map(function (key) { return map[key]; }).filter(Boolean);
  }

  function dmPageCount(data) {
    var max = 0;
    ((data && data.samples) || []).forEach(function (item) { if (item.screen > max) max = item.screen; });
    ((data && data.slots) || []).forEach(function (slot) { if (slot.screen > max) max = slot.screen; });
    return max + 1;
  }

  function dmGridSize(data) {
    var cols = 4;
    var rows = 6;
    ((data && data.samples) || []).forEach(function (item) {
      if (item.cellX + 1 > cols) cols = item.cellX + 1;
      if (item.cellY + 1 > rows) rows = item.cellY + 1;
    });
    ((data && data.slots) || []).forEach(function (slot) {
      if (slot.cellX + 1 > cols) cols = slot.cellX + 1;
      if (slot.cellY + 1 > rows) rows = slot.cellY + 1;
    });
    return {cols: Math.max(4, cols), rows: Math.max(6, rows)};
  }

  function dmBuildFolders(data) {
    var ids = {};
    ((data && data.slots) || []).forEach(function (slot) {
      if (slot.itemType === 2) ids['id:' + slot.id] = true;
      if (slot.container > 0) ids['id:' + slot.container] = true;
    });
    return ids;
  }

  function dmSlotAt(page, row, col) {
    var slots = (dmState.data && dmState.data.slots) || [];
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (slot.container === -100 && slot.screen === page && slot.cellY === row && slot.cellX === col) return slot;
    }
    return null;
  }

  function dmIsFolder(slot) {
    if (!slot) return false;
    return slot.itemType === 2 || !!dmState.folderIds['id:' + slot.id];
  }

  function dmPageLabel(page) {
    return page < 0 ? '全部' : ('第' + (page + 1) + '页');
  }

  function dmQueueIcon(pkg, el) {
    if (!pkg || !el) return;
    if (dmState.iconCache[pkg]) {
      el.innerHTML = '<img alt="" src="data:image/png;base64,' + dmState.iconCache[pkg] + '">';
      return;
    }
    if (el.getAttribute('data-icon-pkg') === pkg && el.getAttribute('data-icon-queued') === '1') return;
    el.setAttribute('data-icon-pkg', pkg);
    el.setAttribute('data-icon-queued', '1');
    dmState.iconQueue.push({pkg: pkg, el: el});
    if (!dmState.iconLoading) {
      dmState.iconLoading = true;
      setTimeout(dmLoadNextIcon, 0);
    }
  }

  function dmLoadNextIcon() {
    var next = dmState.iconQueue.shift();
    if (!next) {
      dmState.iconLoading = false;
      return;
    }
    var data = String(nativeOverlayCall('appIconData', '', next.pkg) || '');
    if (data) {
      dmState.iconCache[next.pkg] = data;
      if (next.el && next.el.isConnected) {
        next.el.innerHTML = '<img alt="" src="data:image/png;base64,' + data + '">';
      }
    }
    setTimeout(dmLoadNextIcon, 14);
  }

  function renderPageTabs() {
    var box = $('desktopPageTabs');
    if (!box) return;
    var html = ['<button type="button" class="dm-page-tab' + (dmState.page < 0 ? ' on' : '') + '" data-dm-page="-1">全部</button>'];
    for (var i = 0; i < dmState.pageCount; i++) {
      html.push('<button type="button" class="dm-page-tab' + (dmState.page === i ? ' on' : '') + '" data-dm-page="' + i + '">第' + (i + 1) + '页</button>');
    }
    box.innerHTML = html.join('');
  }

  function renderDesktopIconList(data) {
    var list = $('desktopIconList');
    var empty = $('desktopEmpty');
    var summary = $('dmSummary');
    if (!list) return;
    if (data) dmState.data = data;
    var icons = (dmState.data && dmState.data.samples) || [];
    var query = (dmState.search || '').trim().toLowerCase();
    var visible = icons.filter(function (item) {
      if (dmState.page >= 0 && item.screen !== dmState.page) return false;
      if (!query) return true;
      return String(item.label || '').toLowerCase().indexOf(query) >= 0
        || String(item.package || '').toLowerCase().indexOf(query) >= 0;
    });
    visible.sort(function (a, b) {
      return (a.screen - b.screen) || (a.cellY - b.cellY) || (a.cellX - b.cellX);
    });
    if (summary) summary.textContent = icons.length + ' 个应用 · ' + dmState.pageCount + ' 页';
    if (!visible.length) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
    } else {
      if (empty) empty.hidden = true;
      var html = [];
      visible.forEach(function (item) {
        var key = dmKey(item);
        var on = dmState.selected.indexOf(key) >= 0;
        var letter = String(item.label || item.package || '?').slice(0, 1);
        html.push('<button type="button" class="dm-app' + (on ? ' on' : '') + '" data-dm-key="' + encodeURIComponent(key) + '">'
          + '<span class="dm-check">✓</span>'
          + '<span class="dm-icon" data-icon-box="1">' + esc(letter) + '</span>'
          + '<b>' + esc(item.label || item.package || '未命名') + '</b>'
          + '<small>第' + (item.screen + 1) + '页 · ' + (item.cellY + 1) + '行' + (item.cellX + 1) + '列</small>'
          + '</button>');
      });
      list.innerHTML = html.join('');
      var boxes = list.querySelectorAll('.dm-app');
      for (var i = 0; i < boxes.length && i < visible.length; i++) {
        var box = boxes[i].querySelector('.dm-icon');
        dmQueueIcon(visible[i].package, box);
      }
    }
    updateDesktopProbeActions(dmState.data);
  }

  function selectedDesktopIcon() {
    return dmSelectedItems()[0] || null;
  }

  function updateDesktopProbeActions() {
    var items = dmSelectedItems();
    var count = items.length;
    var title = $('desktopSelectionTitle');
    var meta = $('desktopSelectionMeta');
    var eat = $('desktopEatBtn');
    var move = $('desktopMoveBtn');
    var swap = $('desktopSwapBtn');
    var folder = $('desktopFolderBtn');
    if (title) title.textContent = count === 0 ? '未选择应用' : (count === 1 ? (items[0].label || items[0].package || '已选择') : ('已选择 ' + count + ' 个应用'));
    if (meta) meta.textContent = count === 0 ? '点图标可多选' : (count === 1 ? '吃掉 / 移动' : '交换 / 文件夹');
    if (eat) eat.disabled = count !== 1;
    if (move) move.disabled = count !== 1;
    if (swap) swap.disabled = count !== 2;
    if (folder) folder.disabled = count < 2;
  }

  function dmSetSelected(keys) {
    dmState.selected = keys || [];
    renderDesktopIconList();
    updateDesktopProbeActions();
  }

  function dmFail(text) {
    toast(text, true);
  }

  function pollDesktopEat(item) {
    var eat = $('desktopEatBtn');
    var startedAt = Date.now();
    if (eat) eat.disabled = true;
    var timer = setInterval(function () {
      var raw = String(nativeOverlayCall('desktopEatStatus', 'idle||'));
      var parts = raw.split('|');
      var state = parts[0] || 'idle';
      var eventRaw = String(nativeOverlayCall('desktopEatEvent', 'idle|||||0'));
      var eventParts = eventRaw.split('|');
      var phase = eventParts[0] || '';
      if (eat && state === 'running') {
        if (phase === 'scan') eat.textContent = '瑶正在扫桌面…';
        else if (phase === 'found' || phase === 'removing') eat.textContent = '正在移除「' + (item.label || item.package || '图标') + '」…';
        else eat.textContent = '瑶正在动手…';
      }
      if (state === 'success') {
        clearInterval(timer);
        if (eat) eat.textContent = '吃掉';
        toast('已吃掉「' + (item.label || item.package) + '」，应用还在抽屉里。');
        var key = dmKey(item);
        dmState.selected = dmState.selected.filter(function (v) { return v !== key; });
        var data = window.__tafeiLastProbe;
        if (data && Array.isArray(data.samples)) {
          data.samples = data.samples.filter(function (v) { return dmKey(v) !== key; });
        }
        renderDesktopIconList(data);
        updateDesktopProbeActions();
      } else if (state === 'failed') {
        clearInterval(timer);
        if (eat) eat.textContent = '吃掉';
        updateDesktopProbeActions();
        var detail = parts[2] || '';
        var failureText = detail;
        if (detail.indexOf('not-found') === 0) failureText = '没扫到目标，请手动滑到那一页再试';
        else if (detail === 'not-launcher') failureText = '请先回到桌面再试';
        else if (detail === 'no-root') failureText = '桌面还没准备好，请稍后重试';
        else if (detail === 'long-press-failed') failureText = '长按发送失败，请重试';
        else if (detail === 'root-still-open') failureText = '移除弹窗没有关闭，请重试';
        toast('吃掉失败：' + (failureText || '请重试'), true);
      } else if (Date.now() - startedAt > 24000) {
        clearInterval(timer);
        if (eat) eat.textContent = '吃掉';
        updateDesktopProbeActions();
        toast('操作超时，请确认桌面弹窗状态。', true);
      }
    }, 400);
  }

  function dmPayload(type, items, target, folderName) {
    var empty = [];
    for (var r = 0; r < dmState.rows; r++) {
      for (var c = 0; c < dmState.cols; c++) {
        if (!dmSlotAt(target.screen, r, c)) empty.push({row: r, col: c});
      }
    }
    var folderSlot = target.slot && dmIsFolder(target.slot) ? target.slot : null;
    return {
      items: items.map(function (item) {
        return {id: item.id || -1, label: item.label || '', package: item.package || '', screen: item.screen, cellX: item.cellX, cellY: item.cellY};
      }),
      target: {screen: target.screen, row: target.row, col: target.col},
      targetFolder: folderSlot ? {id: folderSlot.id, title: folderSlot.title || ''} : null,
      folderName: folderName || '',
      cols: dmState.cols,
      rows: dmState.rows,
      emptyCells: empty,
      db: String(nativeOverlayCall('desktopDbExperimental', '0')) === '1'
    };
  }

  function pollDesktopAction(type, baseline) {
    var startedAt = Date.now();
    if (dmState.actionTimer) clearInterval(dmState.actionTimer);
    dmState.actionTimer = setInterval(function () {
      var raw = String(nativeOverlayCall('desktopActionResult', 'idle|||0'));
      var p = raw.split('|');
      var state = p[0] || 'idle';
      var action = p[1] || '';
      var detail = p[2] || '';
      var eventId = parseInt(p[3] || '0', 10) || 0;
      if (eventId <= baseline) return;
      if (state === 'success') {
        clearInterval(dmState.actionTimer);
        dmState.actionTimer = 0;
        toast('桌面操作完成，正在刷新列表。');
        setTimeout(refreshDesktopProbe, 700);
      } else if (state === 'failed') {
        clearInterval(dmState.actionTimer);
        dmState.actionTimer = 0;
        toast('桌面操作失败：' + (detail || '请重试'), true);
      } else if (Date.now() - startedAt > 30000) {
        clearInterval(dmState.actionTimer);
        dmState.actionTimer = 0;
        toast('桌面操作超时，请查看桌面状态。', true);
      }
    }, 500);
  }

  function startDesktopAction(type, payload) {
    var baseline = parseInt(String(nativeOverlayCall('desktopActionEventId', '0')), 10) || 0;
    var result = String(nativeOverlayCall('desktopAction', 'off', type, JSON.stringify(payload)));
    if (result !== 'started') {
      dmFail('操作启动失败：' + result);
      return false;
    }
    toast(type === 'move' ? '瑶正在把图标搬过去…' : (type === 'swap' ? '瑶正在交换两个图标…' : '瑶正在整理文件夹…'));
    pollDesktopAction(type, baseline);
    return true;
  }

  function renderTargetPageTabs() {
    var box = $('dmTargetPageTabs');
    if (!box || !dmState.target) return;
    var html = [];
    for (var i = 0; i < dmState.pageCount; i++) {
      html.push('<button type="button" class="dm-page-tab' + (dmState.target.page === i ? ' on' : '') + '" data-dm-target-page="' + i + '">第' + (i + 1) + '页</button>');
    }
    box.innerHTML = html.join('');
  }

  function renderTargetGrid() {
    var grid = $('dmTargetGrid');
    if (!grid || !dmState.target) return;
    var target = dmState.target;
    var html = [];
    for (var r = 0; r < dmState.rows; r++) {
      for (var c = 0; c < dmState.cols; c++) {
        var slot = dmSlotAt(target.page, r, c);
        var cls = 'dm-cell';
        var text = (r + 1) + '行' + (c + 1) + '列';
        var folder = dmIsFolder(slot);
        var disabled = false;
        if (!slot) {
          cls += ' free';
        } else if (folder) {
          cls += ' folder';
          text = '文件夹<br>' + esc(slot.title || '');
          disabled = target.mode !== 'folder';
        } else {
          cls += ' occupied';
          text = esc(slot.title || slot.package || '占用');
          disabled = true;
        }
        if (target.row === r && target.col === c) cls += ' on';
        html.push('<button type="button" class="' + cls + '" data-dm-row="' + r + '" data-dm-col="' + c + '"' + (disabled ? ' disabled' : '') + '>' + text + '</button>');
      }
    }
    grid.innerHTML = html.join('');
    var nameRow = $('dmFolderNameRow');
    if (nameRow) nameRow.hidden = target.mode !== 'folder' || (target.slot && dmIsFolder(target.slot));
  }

  function openTargetModal(mode, preset) {
    var items = dmSelectedItems();
    if (mode === 'move' && items.length !== 1) { dmFail('移动只能选 1 个应用。'); return; }
    if (mode === 'folder' && items.length < 2) { dmFail('文件夹至少要选 2 个应用。'); return; }
    var page = preset && typeof preset.page === 'number' ? preset.page : items[0].screen;
    dmState.target = {mode: mode, page: page, row: preset && preset.row, col: preset && preset.col, slot: null};
    var modal = $('dmTargetModal');
    if (modal) modal.hidden = false;
    var title = modal && modal.querySelector('.dm-target-head b');
    if (title) title.textContent = mode === 'move' ? '移动到哪一格' : '文件夹放在哪一格';
    var hint = $('dmTargetHint');
    if (hint) hint.textContent = mode === 'move' ? '只能选空位；跨页需要数据库兜底实验开启。' : '选空位会新建文件夹；选已有文件夹会并入。';
    var folderInput = $('dmFolderName');
    if (folderInput) folderInput.value = '';
    renderTargetPageTabs();
    renderTargetGrid();
    var summary = $('dmTargetSummary');
    if (summary) summary.textContent = '第' + (page + 1) + '页 · 未选择位置';
    var confirm = $('dmTargetConfirm');
    if (confirm) confirm.disabled = true;
  }

  function closeTargetModal() {
    var modal = $('dmTargetModal');
    if (modal) modal.hidden = true;
    dmState.target = null;
  }

  function confirmTarget() {
    var target = dmState.target;
    if (!target || target.row == null || target.col == null) return;
    var items = dmSelectedItems();
    var slot = dmSlotAt(target.page, target.row, target.col);
    if (target.mode === 'move' && slot) { dmFail('目标格被占用了，请换一个空位。'); return; }
    if (target.mode === 'folder' && slot && !dmIsFolder(slot)) { dmFail('目标格是普通应用，不是文件夹；请换空位或已有文件夹。'); return; }
    var payload = dmPayload(target.mode, items, {screen: target.page, row: target.row, col: target.col, slot: slot}, ($('dmFolderName') || {}).value || '');
    var action = target.mode === 'move' ? 'move' : 'folder';
    closeTargetModal();
    startDesktopAction(action, payload);
  }

  function dmChineseNumber(value) {
    var text = String(value || '').trim();
    if (/^\d+$/.test(text)) return parseInt(text, 10);
    var digits = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10};
    if (text === '十') return 10;
    if (text.length === 1) return digits[text] || 0;
    if (text.indexOf('十') === 0) return 10 + (digits[text.slice(1)] || 0);
    if (text.indexOf('十') > 0) return (digits[text.slice(0, 1)] || 0) * 10 + (digits[text.slice(2)] || 0);
    return 0;
  }

  function dmFindMentioned(text) {
    var icons = (dmState.data && dmState.data.samples) || [];
    var candidates = [];
    icons.forEach(function (item) {
      var label = String(item.label || '').trim();
      if (!label) return;
      var at = text.indexOf(label);
      if (at >= 0) candidates.push({item: item, start: at, end: at + label.length, len: label.length});
    });
    candidates.sort(function (a, b) { return b.len - a.len || a.start - b.start; });
    var taken = [];
    var picked = [];
    candidates.forEach(function (cand) {
      var overlap = taken.some(function (range) { return cand.start < range.end && cand.end > range.start; });
      if (overlap) return;
      taken.push({start: cand.start, end: cand.end});
      picked.push(cand.item);
    });
    picked.sort(function (a, b) {
      return text.indexOf(a.label) - text.indexOf(b.label);
    });
    return picked;
  }

  function dmParseLocation(text) {
    var m = text.match(/第\s*([0-9一二三四五六七八九十]+)\s*页[^0-9第]{0,14}?([0-9]+)\s*行[^0-9]{0,8}?([0-9]+)\s*列/);
    if (!m) m = text.match(/第\s*([0-9一二三四五六七八九十]+)\s*页.*?([0-9]+)\s*行.*?([0-9]+)\s*列/);
    if (!m) return null;
    var page = dmChineseNumber(m[1]) - 1;
    var row = parseInt(m[2], 10) - 1;
    var col = parseInt(m[3], 10) - 1;
    if (page < 0 || row < 0 || col < 0) return null;
    if (page >= dmState.pageCount || row >= dmState.rows || col >= dmState.cols) return null;
    return {page: page, row: row, col: col};
  }

  function dmParseFolderName(text) {
    var m = text.match(/(?:叫|命名为)\s*[“"「']?([^”"」'，。,\s]+)/);
    return m ? m[1] : '';
  }

  function executeDesktopCommand() {
    var input = $('desktopCommand');
    var text = String((input && input.value) || '').trim();
    if (!text) { dmFail('先输入一条指令。'); return; }
    if (!dmState.data || !(dmState.data.samples || []).length) { dmFail('先点“重新扫描”读取桌面。'); return; }
    var items = dmFindMentioned(text);
    var location = dmParseLocation(text);
    var folderName = dmParseFolderName(text);
    var isFolder = text.indexOf('文件夹') >= 0 || text.indexOf('合并') >= 0;
    var isSwap = text.indexOf('交换') >= 0 || text.indexOf('换位置') >= 0;
    var isMove = text.indexOf('移到') >= 0 || text.indexOf('放到') >= 0 || text.indexOf('移动') >= 0;
    if (isFolder) {
      if (items.length < 2) { dmFail('文件夹指令至少要有 2 个应用名。'); return; }
      if (!location) { dmState.selected = items.map(dmKey); renderDesktopIconList(); updateDesktopProbeActions(); openTargetModal('folder'); dmFail('已选中应用，请再补一个目标页/行/列。'); return; }
      var slot = dmSlotAt(location.page, location.row, location.col);
      if (slot && !dmIsFolder(slot)) { dmFail('目标格是普通应用，不能直接做成文件夹。'); return; }
      dmState.selected = items.map(dmKey);
      renderDesktopIconList();
      updateDesktopProbeActions();
      startDesktopAction('folder', dmPayload('folder', items, {screen: location.page, row: location.row, col: location.col, slot: slot}, folderName));
      return;
    }
    if (isSwap) {
      if (items.length !== 2) { dmFail('交换指令必须正好提到 2 个应用。'); return; }
      dmState.selected = items.map(dmKey);
      renderDesktopIconList();
      updateDesktopProbeActions();
      startDesktopAction('swap', dmPayload('swap', items, {screen: items[0].screen, row: items[0].cellY, col: items[0].cellX, slot: null}));
      return;
    }
    if (isMove) {
      if (items.length !== 1) { dmFail('移动指令必须正好提到 1 个应用。'); return; }
      if (!location) { dmState.selected = items.map(dmKey); renderDesktopIconList(); updateDesktopProbeActions(); openTargetModal('move'); dmFail('已选中应用，请再选目标位置。'); return; }
      dmState.selected = items.map(dmKey);
      renderDesktopIconList();
      updateDesktopProbeActions();
      startDesktopAction('move', dmPayload('move', items, {screen: location.page, row: location.row, col: location.col, slot: dmSlotAt(location.page, location.row, location.col)}));
      return;
    }
    dmFail('没认出指令。可用：交换位置 / 移动到第X页第Y行第Z列 / 做成文件夹。');
  }

  function refreshDesktopProbe() {
    var raw = String(nativeOverlayCall('desktopProbe', ''));
    renderDesktopProbe(raw);
  }

  function initDesktopProbe() {
    var box = $('desktopProbe');
    var button = $('desktopProbeBtn');
    if (!box || !button) return;
    if (String(nativeOverlayCall('desktopProbeSupported', '0')) !== '1') return;
    box.hidden = false;

    var dbToggle = $('desktopDbToggle');
    var dbState = $('desktopDbState');
    var dbAvailable = String(nativeOverlayCall('desktopDbAvailable', '0')) === '1';
    if (dbToggle) {
      dbToggle.disabled = !dbAvailable;
      dbToggle.checked = dbAvailable && String(nativeOverlayCall('desktopDbExperimental', '0')) === '1';
      dbToggle.addEventListener('change', function () {
        if (dbToggle.checked) {
          if (!window.confirm('数据库兜底实验：拖动失败时会直接写 launcher.db，并先备份。\n只在你知道风险时开启。')) {
            dbToggle.checked = false;
            return;
          }
          nativeOverlayCall('setDesktopDbExperimental', null, '1');
          if (dbState) dbState.textContent = '已开启（实验）';
          toast('数据库兜底已开启；失败会尝试备份回滚。', true);
        } else {
          nativeOverlayCall('setDesktopDbExperimental', null, '0');
          if (dbState) dbState.textContent = '已关闭';
          toast('数据库兜底已关闭。');
        }
      });
    }
    if (dbState) {
      if (!dbAvailable) dbState.textContent = '当前设备没有 sqlite3，实验不可用';
      else dbState.textContent = (dbToggle && dbToggle.checked) ? '已开启（实验）' : '已关闭';
    }

    function refresh() {
      var out = $('desktopProbeOut');
      button.disabled = true;
      if (out) out.textContent = '正在读取桌面环境…\n首次检测可能会在 KernelSU 里弹出授权。';
      setTimeout(function () {
        refreshDesktopProbe();
        button.disabled = false;
        if (out) out.textContent = out.textContent || '桌面扫描完成。';
      }, 120);
    }
    button.addEventListener('click', refresh);
    var didAuto = false;
    setTimeout(function () {
      if (!didAuto && !window.__tafeiLastProbe) {
        didAuto = true;
        refresh();
      }
    }, 300);

    var access = $('desktopAccessBtn');
    if (access) access.addEventListener('click', function () {
      nativeOverlayCall('openAccessibility', null);
      toast('请在系统设置里找到「挞飞桌面互动」并开启；首次可能需要先允许受限设置。');
    });

    var search = $('desktopSearch');
    if (search) search.addEventListener('input', function () {
      dmState.search = search.value || '';
      renderDesktopIconList();
    });

    var tabs = $('desktopPageTabs');
    if (tabs) tabs.addEventListener('click', function (event) {
      var target = event.target.closest && event.target.closest('[data-dm-page]');
      if (!target) return;
      dmState.page = parseInt(target.getAttribute('data-dm-page'), 10);
      renderPageTabs();
      renderDesktopIconList();
    });

    var list = $('desktopIconList');
    if (list) list.addEventListener('click', function (event) {
      var target = event.target.closest && event.target.closest('[data-dm-key]');
      if (!target) return;
      var key = decodeURIComponent(target.getAttribute('data-dm-key') || '');
      if (!key) return;
      var at = dmState.selected.indexOf(key);
      if (at >= 0) dmState.selected.splice(at, 1);
      else dmState.selected.push(key);
      renderDesktopIconList();
      updateDesktopProbeActions();
    });

    var eat = $('desktopEatBtn');
    if (eat) eat.addEventListener('click', function () {
      var item = selectedDesktopIcon();
      if (!item) { dmFail('请先选择一个应用。'); return; }
      if (String(nativeOverlayCall('accessibilityReady', '0')) !== '1') {
        nativeOverlayCall('openAccessibility', null);
        dmFail('无障碍还没连接，请先开启「挞飞桌面互动」。');
        return;
      }
      if (!window.confirm('吃掉「' + (item.label || item.package) + '」？\n只会从桌面移除，应用仍保留在抽屉。')) return;
      var result = String(nativeOverlayCall('eatDesktopIcon', 'off', item.label, item.package, item.screen, item.cellX, item.cellY));
      if (result === 'accessibility-off') dmFail('请先开启无障碍服务。');
      else if (result === 'started') pollDesktopEat(item);
      else dmFail('吃掉启动失败：' + result);
    });

    var move = $('desktopMoveBtn');
    if (move) move.addEventListener('click', function () { openTargetModal('move'); });
    var folder = $('desktopFolderBtn');
    if (folder) folder.addEventListener('click', function () { openTargetModal('folder'); });
    var swap = $('desktopSwapBtn');
    if (swap) swap.addEventListener('click', function () {
      var items = dmSelectedItems();
      if (items.length !== 2) { dmFail('交换必须正好选 2 个应用。'); return; }
      if (!window.confirm('交换「' + (items[0].label || items[0].package) + '」和「' + (items[1].label || items[1].package) + '」？')) return;
      startDesktopAction('swap', dmPayload('swap', items, {screen: items[0].screen, row: items[0].cellY, col: items[0].cellX, slot: null}));
    });

    var commandBtn = $('desktopCommandBtn');
    if (commandBtn) commandBtn.addEventListener('click', executeDesktopCommand);
    var command = $('desktopCommand');
    if (command) command.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') executeDesktopCommand();
    });

    var targetClose = $('dmTargetClose');
    if (targetClose) targetClose.addEventListener('click', closeTargetModal);
    var targetTabs = $('dmTargetPageTabs');
    if (targetTabs) targetTabs.addEventListener('click', function (event) {
      var target = event.target.closest && event.target.closest('[data-dm-target-page]');
      if (!target || !dmState.target) return;
      dmState.target.page = parseInt(target.getAttribute('data-dm-target-page'), 10);
      dmState.target.row = null;
      dmState.target.col = null;
      dmState.target.slot = null;
      renderTargetPageTabs();
      renderTargetGrid();
      var summary = $('dmTargetSummary');
      if (summary) summary.textContent = '第' + (dmState.target.page + 1) + '页 · 未选择位置';
      var confirm = $('dmTargetConfirm');
      if (confirm) confirm.disabled = true;
    });
    var targetGrid = $('dmTargetGrid');
    if (targetGrid) targetGrid.addEventListener('click', function (event) {
      var target = event.target.closest && event.target.closest('[data-dm-row]');
      if (!target || !dmState.target) return;
      var row = parseInt(target.getAttribute('data-dm-row'), 10);
      var col = parseInt(target.getAttribute('data-dm-col'), 10);
      if (isNaN(row) || isNaN(col)) return;
      dmState.target.row = row;
      dmState.target.col = col;
      dmState.target.slot = dmSlotAt(dmState.target.page, row, col);
      renderTargetGrid();
      var summary = $('dmTargetSummary');
      if (summary) summary.textContent = '第' + (dmState.target.page + 1) + '页 · 第' + (row + 1) + '行第' + (col + 1) + '列';
      var confirm = $('dmTargetConfirm');
      if (confirm) confirm.disabled = false;
    });
    var confirm = $('dmTargetConfirm');
    if (confirm) confirm.addEventListener('click', confirmTarget);
  }

  $('nativeOverlayToggle')?.addEventListener('click', function () {
    var status = String(nativeOverlayCall('overlayStatus', 'off'));
    if (status === 'on') {
      nativeOverlayCall('stopOverlay', 'off');
      refreshNativeOverlay();
      toast('桌面精灵已收起。');
      return;
    }
    if (status === 'denied') {
      overlayPending = true;
      nativeOverlayCall('requestOverlayPermission', null);
      toast('请允许「显示在其他应用上层」，回来后会自动开启。');
      return;
    }
    var result = String(nativeOverlayCall('startOverlay', 'off'));
    refreshNativeOverlay();
    if (result === 'on') toast('已开启，退出 App 后她会留在桌面上。');
    else if (result === 'denied') toast('还没有悬浮窗权限，请先在系统设置里允许。', true);
    else toast('开启失败，请稍后再试。', true);
  });

  [['noAutonomy', 'setOverlayAutonomy'], ['noDoodle', 'setOverlayDoodle']].forEach(function (row) {
    var box = $(row[0]);
    if (!box) return;
    box.addEventListener('change', function () {
      nativeOverlayCall(row[1], null, box.checked ? 1 : 0);
    });
  });

  [['noSize', 'setOverlaySize', 'noSizeVal'], ['noOpacity', 'setOverlayOpacity', 'noOpacityVal']].forEach(function (row) {
    var input = $(row[0]);
    if (!input) return;
    input.addEventListener('input', function () {
      var out = $(row[2]);
      if (out) out.textContent = input.value + '%';
    });
    input.addEventListener('change', function () {
      nativeOverlayCall(row[1], null, Number(input.value));
    });
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    refreshNativeOverlay();
    if (!overlayPending) return;
    var status = String(nativeOverlayCall('overlayStatus', 'off'));
    if (status === 'off') {
      overlayPending = false;
      var result = String(nativeOverlayCall('startOverlay', 'off'));
      refreshNativeOverlay();
      if (result === 'on') toast('权限拿到了，桌面精灵已开启。');
    } else if (status === 'on') {
      overlayPending = false;
    }
  });

  core.subscribe(function () {
    renderAll();
    primeWidget();
  });
  core.refreshWallet().finally(renderAll);

  // 初次渲染
  renderAll();
  primeWidget();
  initNativeOverlay();
  initDesktopProbe();
})();
