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
      node.textContent = text;
      node.classList.toggle('demo', !wallet.real);
    });
    var shop = $('shopWallet');
    if (shop) shop.textContent = num(wallet.amount);
    var topups = ['demoTopup', 'shopTopup'];
    topups.forEach(function (id) {
      var node = $(id);
      if (node) node.hidden = !!wallet.real;
    });
    var mode = $('modeBadge');
    if (mode) mode.textContent = wallet.real ? '账户额度' : '本地原型';
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
        img.src = 'assets/spirits/xiaota.jpg';
        img.alt = '还没有伙伴';
      }
      if (tag) tag.textContent = '待领取';
      if (name) name.textContent = '还没有伙伴';
      if (line) line.textContent = '先在下面的图鉴里免费领取小挞飞；其他款式按后台设置获取。';
      if (condition) condition.textContent = '还没有伙伴';
      if (bond) bond.textContent = '—';
      if (toggle) { toggle.hidden = true; toggle.disabled = true; }
      renderWallet();
      return;
    }
    if (dock) dock.classList.remove('is-empty');
    if (toggle) { toggle.hidden = false; toggle.disabled = false; }
    if (img) {
      img.src = skin.img;
      img.alt = spirit.name + ' · ' + skin.name;
    }
    if (tag) tag.textContent = spirit.tag;
    if (name) name.textContent = spirit.name;
    if (line) line.textContent = skin.quote || spirit.line;
    if (condition) condition.textContent = snap.conditionText;
    renderMeters('dock');
    if (bond) bond.textContent = String(num(core.state().bond[spirit.id]));
    if (toggle) {
      toggle.textContent = core.state().widget.on ? '关闭全站挂件' : '开启全站挂件';
      toggle.classList.toggle('on', !!core.state().widget.on);
    }
    renderWallet();
  }

  function cardButton(spirit, unlocked, selected) {
    if (selected) return '<button class="spirit-open is-current" type="button" disabled>当前伙伴</button>';
    if (unlocked) return '<button class="spirit-open is-select" type="button" data-card-action="select" data-id="' + esc(spirit.id) + '">设为伙伴</button>';
    var mode = core.modeOfSpirit(spirit.id);
    var price = core.priceOfSpirit(spirit.id);
    if (mode === 'request') return '<button class="spirit-open is-contact" type="button" data-card-action="open" data-id="' + esc(spirit.id) + '">联系站长获取<span class="price-mini">私人上架</span></button>';
    if (mode === 'free' || price === 0) return '<button class="spirit-open is-claim" type="button" data-card-action="claim" data-id="' + esc(spirit.id) + '">免费领取<span class="price-mini">挞飞原创</span></button>';
    return '<button class="spirit-open is-locked" type="button" data-card-action="open" data-id="' + esc(spirit.id) + '">查看并解锁<span class="price-mini">' + price + ' 额度</span></button>';
  }

  function renderGrid() {
    if (!grid) return;
    var selected = core.state().selected;
    grid.innerHTML = core.SPIRITS.map(function (spirit) {
      var unlocked = core.isUnlocked(spirit.id);
      var isSelected = selected === spirit.id;
      var price = core.priceOfSpirit(spirit.id);
      var mode = core.modeOfSpirit(spirit.id);
      var skin = core.skinsOf(spirit.id)[0];
      var priceLabel = unlocked ? '<span class="spirit-price free">已解锁</span>' : mode === 'request' ? '<span class="spirit-price request">私人上架</span>' : (mode === 'free' || price === 0 ? '<span class="spirit-price free">免费</span>' : '<span class="spirit-price">' + price + ' 额度</span>');
      return '<article class="spirit-card' + (unlocked ? '' : ' is-locked') + (isSelected ? ' is-selected' : '') + '">'
        + '<div class="spirit-flag' + (spirit.original ? ' original' : '') + '">' + esc(spirit.tag) + '</div>'
        + '<button class="spirit-cover" type="button" data-card-action="open" data-id="' + esc(spirit.id) + '" aria-label="查看' + esc(spirit.name) + '">'
        + '<img src="' + esc(skin.img) + '" alt="' + esc(spirit.name) + ' Q 版角色卡" loading="lazy"></button>'
        + '<div class="spirit-info"><span class="spirit-game">' + esc(spirit.game) + '</span><h2>' + esc(spirit.name) + '</h2><p>' + esc(spirit.intro) + '</p>'
        + '<div class="spirit-price-line"><span>' + (unlocked ? '已在小屋里' : '未解锁') + '</span>' + priceLabel + '</div>'
        + cardButton(spirit, unlocked, isSelected)
        + '</div></article>';
    }).join('');
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
    if (skins.length <= 1) {
      forms.innerHTML = '';
      forms.hidden = true;
      return;
    }
    forms.hidden = false;
    forms.innerHTML = skins.map(function (skin) {
      var owned = core.isSkinOwned(skin.id);
      var active = core.state().selectedSkin === skin.id && core.state().selected === spirit.id;
      var price = core.priceOfSkin(skin.id);
      return '<button type="button" data-skin="' + esc(skin.id) + '" class="' + (active ? 'active' : '') + (owned ? '' : ' locked') + '" aria-pressed="' + (active ? 'true' : 'false') + '">'
        + esc(skin.name) + (!owned ? '<span>' + price + ' 额度</span>' : '')
        + '</button>';
    }).join('');
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
    $('spiritModalLine').textContent = unlocked ? line : spirit.intro;
    $('spiritBond').textContent = String(num(core.state().bond[spirit.id]));
    $('spiritBondHint').textContent = core.state().bond[spirit.id] >= 6 ? '把你当成老朋友了' : core.state().bond[spirit.id] >= 3 ? '再互动几次会更亲近' : '先摸摸她，认识一下';
    var note = $('spiritModalNote');
    if (note) note.textContent = core.modeOfSpirit(spirit.id) === 'request' ? '这款不开放额度购买；把账号和款式发给站长，由后台私下发放。' : '同人 Q 版展示，非官方原画；本地原型使用演示额度，云端表启用后自动切换为站内额度。';
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
        set.textContent = '当前伙伴';
        set.disabled = true;
      } else {
        set.textContent = '设为当前伙伴';
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
    if (foodGrid) foodGrid.innerHTML = core.ITEMS.filter(function (i) { return i.kind === 'food'; }).map(itemCard).join('');
    if (toyGrid) toyGrid.innerHTML = core.ITEMS.filter(function (i) { return i.kind === 'toy'; }).map(itemCard).join('');
    renderWallet();
  }

  function renderAll() {
    renderDock();
    renderGrid();
    renderShop();
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
      toast('已解锁 ' + spirit.name + '，并设成当前伙伴。');
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
      core.useItem(id, core.state().selected);
      toast('用了「' + item.name + '」，' + (item.kind === 'food' ? '她吃得很认真。' : '她玩得很开心。'));
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
        toast('已换成 ' + core.current().name + '，挂件会同步更新。');
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
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !modal.hidden) closeModal(); });

  $('spiritPet')?.addEventListener('click', function () {
    if (!currentModal || !core.isUnlocked(currentModal)) return;
    try {
      core.pet(currentModal);
      toast('她轻轻蹭了蹭你的手，亲密度 +1。');
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
      toast('已设成当前伙伴。');
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
    core.setWidget(!core.state().widget.on);
    toast(core.state().widget.on ? '全站挂件已打开，拖一拖她试试。' : '全站挂件已收起。');
    renderAll();
  });

  core.subscribe(renderAll);
  core.refreshWallet().finally(renderAll);

  // 初次渲染
  renderAll();
})();
