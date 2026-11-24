(function () {
  'use strict';

  var core = window.TafeiSpirits;
  var $ = function (id) { return document.getElementById(id); };
  var panel = $('petPanel');
  var button = $('communityPetBtn');
  var mini = $('miniPet');
  var miniPhoto = $('petMiniPhoto');
  var speech = $('petMiniSpeech');
  var status = $('petStatus');
  var badge = $('petBadge');
  var widgetBtn = $('petWidgetToggle');
  var actionTimer = 0;
  var speechTimer = 0;
  var lastAction = 0;

  if (!core) return;

  function num(value) { return Math.round(Number(value) || 0); }
  function conditionMood(condition) {
    if (condition === 'sleep') return 'sleepy';
    if (condition === 'angry') return 'angry';
    if (condition === 'hungry') return 'hungry';
    if (condition === 'sad') return 'sad';
    return 'happy';
  }
  function idleLine() {
    var spirit = core.current();
    if (!spirit) return '还没有伙伴。先去精灵小屋免费领取小挞飞吧。';
    var condition = core.condition();
    if (condition === 'sleep') return spirit.name + '已经靠在你旁边睡着了。';
    if (condition === 'angry') return spirit.name + '有点生气，先别逗她。';
    if (condition === 'hungry') return spirit.name + '饿了，去补给站找点吃的吧。';
    if (condition === 'happy') return spirit.name + '今天心情很好，想和你待在一起。';
    if (condition === 'sad') return spirit.name + '有点低落，陪她坐一会儿吧。';
    return spirit.quote || spirit.line;
  }
  function speak(text, hold) {
    if (!speech) return;
    speech.textContent = text;
    clearTimeout(speechTimer);
    speechTimer = setTimeout(function () { speech.textContent = idleLine(); }, hold || 3000);
  }
  function setStatus(text) { if (status) status.textContent = text || ''; }
  function syncWidgetButton() {
    if (!widgetBtn) return;
    var has = !!core.current();
    var on = has && !!(core.state() && core.state().widget && core.state().widget.on);
    widgetBtn.textContent = has ? (on ? '收起全站挂件' : '放出全站挂件') : '先领一个伙伴';
    widgetBtn.classList.toggle('on', on);
    widgetBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function actionAnim(name) {
    if (!mini) return;
    mini.dataset.action = name;
    clearTimeout(actionTimer);
    actionTimer = setTimeout(function () { mini.dataset.action = ''; }, 680);
  }
  function setBar(id, value) {
    var node = $(id);
    if (node) node.style.width = Math.max(0, Math.min(100, value)) + '%';
  }

  function render() {
    if (!mini || !core) return;
    var snap = core.snapshot();
    var spirit = snap.current;
    var skin = snap.skin;
    var s = snap.state.status;
    if (!spirit || !skin) {
      mini.classList.add('is-empty');
      if (miniPhoto) { miniPhoto.hidden = true; miniPhoto.removeAttribute('src'); miniPhoto.removeAttribute('alt'); }
      var emptyTitle = $('petPanelTitle');
      if (emptyTitle) emptyTitle.textContent = '魔法伙伴';
      var emptyCopy = $('petPanelCopy');
      if (emptyCopy) emptyCopy.textContent = '还没有领取伙伴。去精灵小屋免费领取小挞飞，或者用额度解锁其他角色。';
      var emptyName = $('petPartnerName');
      if (emptyName) emptyName.textContent = '还没有伙伴';
      var emptyDesc = $('petPartnerDesc');
      if (emptyDesc) emptyDesc.textContent = '先去小屋里挑一个。';
      if (speech) speech.textContent = idleLine();
      if (badge) { badge.hidden = true; badge.textContent = ''; }
      if (button) button.setAttribute('aria-expanded', panel && !panel.hidden ? 'true' : 'false');
      syncWidgetButton();
      return;
    }
    mini.classList.remove('is-empty');
    var isOriginal = spirit.id === 'xiaota';
    if (miniPhoto) {
      var art = skin.img || skin.avatar || '';
      miniPhoto.hidden = false;
      if (art && miniPhoto.getAttribute('src') !== art) miniPhoto.src = art;
      miniPhoto.alt = spirit.name + ' · ' + skin.name;
      var isAlpha = /\.png($|\?)/i.test(art);
      miniPhoto.classList.toggle('is-alpha', isAlpha);
      mini.classList.toggle('has-alpha', isAlpha);
      mini.classList.toggle('is-photo', !isAlpha);
    }
    mini.dataset.mood = conditionMood(snap.condition);
    mini.dataset.outfit = '';
    mini.setAttribute('aria-label', spirit.name + '，' + skin.name);

    var title = $('petPanelTitle');
    if (title) title.textContent = '魔法伙伴 · ' + spirit.name;
    var copy = $('petPanelCopy');
    if (copy) copy.textContent = isOriginal
      ? '小挞飞是挞飞原创伙伴。摸摸、喂食、玩玩具都会消耗补给站的道具，状态和亲密度与精灵小屋同步。'
      : '当前展示的是 ' + spirit.name + '。她的食物、玩具、皮肤和亲密度都在精灵小屋里管理。';
    var kicker = $('petPartnerKicker');
    if (kicker) kicker.textContent = isOriginal ? 'ORIGINAL PARTNER' : 'CURRENT PARTNER';
    var name = $('petPartnerName');
    if (name) name.textContent = spirit.name;
    var desc = $('petPartnerDesc');
    if (desc) desc.textContent = skin.quote || spirit.intro;
    var info = core.bondInfo(spirit.id);
    var levelNode = $('petLevel');
    if (levelNode) levelNode.textContent = 'Lv.' + info.level;

    var bond = num(info.bond);
    var bondNode = $('petBond');
    if (bondNode) bondNode.textContent = String(bond);
    var hint = $('petBondHint');
    if (hint) hint.textContent = info.next ? '再互动 ' + info.toNext + ' 次到 Lv.' + info.next.level : '已经是最高等级';

    var mood = s.mood;
    var hunger = s.satiety;
    var sleep = s.sleepiness;
    var moodVal = $('petMoodVal');
    var hungerVal = $('petHungerVal');
    var energyVal = $('petEnergyVal');
    if (moodVal) moodVal.textContent = String(num(mood));
    if (hungerVal) hungerVal.textContent = String(num(hunger));
    if (energyVal) energyVal.textContent = String(num(sleep));
    setBar('petMoodBar', mood);
    setBar('petHungerBar', hunger);
    setBar('petEnergyBar', sleep);
    if (badge) { badge.hidden = true; badge.textContent = ''; }
    if (button) button.setAttribute('aria-expanded', panel && !panel.hidden ? 'true' : 'false');
    syncWidgetButton();
    if (!panel || panel.hidden) return;
    if (speech) speech.textContent = idleLine();
  }

  function firstItem(kind) {
    var list = core.ITEMS.filter(function (item) {
      return item.kind === kind && core.inventoryOf(item.id) > 0;
    });
    return list.length ? list[0] : null;
  }

  function canAct() {
    var now = Date.now();
    if (now - lastAction < 800) return false;
    lastAction = now;
    return true;
  }

  function doPet() {
    if (!canAct()) return;
    if (!core.current()) {
      speak('还没有伙伴，先去精灵小屋领取一个吧。');
      setStatus('还没有伙伴：去精灵小屋免费领取小挞飞。');
      return;
    }
    actionAnim('pet');
    core.pet(core.state().selected);
    speak('唔，被摸到了。');
    setStatus('亲密度 +1，心情也上来了一点。');
    render();
  }

  function doFeed() {
    if (!canAct()) return;
    if (!core.current()) {
      speak('还没有伙伴，先去精灵小屋领取一个吧。');
      setStatus('还没有伙伴：去精灵小屋免费领取小挞飞。');
      return;
    }
    var item = firstItem('food');
    if (!item) {
      actionAnim('feed');
      speak('肚子饿了，先去精灵小屋补给站买点吃的。');
      setStatus('没有食物：去精灵小屋零食铺购买。');
      return;
    }
    try {
      core.useItem(item.id, core.state().selected);
      actionAnim('feed');
      speak('吃掉了「' + item.name + '」，看起来很满足。');
      setStatus('已使用 ' + item.name + '，库存 ' + core.inventoryOf(item.id));
      render();
    } catch (error) {
      setStatus(error.message || '喂食失败。');
    }
  }

  function doPlay() {
    if (!canAct()) return;
    if (!core.current()) {
      speak('还没有伙伴，先去精灵小屋领取一个吧。');
      setStatus('还没有伙伴：去精灵小屋免费领取小挞飞。');
      return;
    }
    var item = firstItem('toy');
    if (!item) {
      actionAnim('play');
      speak('玩具架还是空的，先去补给站挑一个。');
      setStatus('没有玩具：去精灵小屋玩具架购买。');
      return;
    }
    try {
      core.useItem(item.id, core.state().selected);
      actionAnim('play');
      speak('玩了一会儿「' + item.name + '」，心情变好了。');
      setStatus('已使用 ' + item.name + '，剩余次数 ' + (item.dailyLimit ? item.dailyLimit - (Number(core.state().today.toys[item.id]) || 0) : '不限'));
      render();
    } catch (error) {
      setStatus(error.message || '玩耍失败。');
    }
  }

  function openPanel() {
    if (!panel) return;
    var taskPanel = $('taskCenter');
    var taskBtn = $('communityTaskBtn');
    if (taskPanel) taskPanel.hidden = true;
    if (taskBtn) taskBtn.setAttribute('aria-expanded', 'false');
    panel.hidden = false;
    document.body.classList.add('pet-panel-open');
    if (button) button.setAttribute('aria-expanded', 'true');
    render();
  }
  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    document.body.classList.remove('pet-panel-open');
    if (button) button.setAttribute('aria-expanded', 'false');
  }
  function togglePanel() {
    if (!panel) return;
    if (panel.hidden) openPanel();
    else closePanel();
  }

  function bind() {
    if (button) button.addEventListener('click', togglePanel);
    if ($('petPanelClose')) $('petPanelClose').addEventListener('click', closePanel);
    if ($('communityTaskBtn')) {
      $('communityTaskBtn').addEventListener('click', function () {
        if (panel) panel.hidden = true;
        document.body.classList.remove('pet-panel-open');
        if (button) button.setAttribute('aria-expanded', 'false');
      });
    }
    if ($('petPetBtn')) $('petPetBtn').addEventListener('click', doPet);
    if ($('petFeedBtn')) $('petFeedBtn').addEventListener('click', doFeed);
    if ($('petPlayBtn')) $('petPlayBtn').addEventListener('click', doPlay);
    if (widgetBtn) {
      widgetBtn.addEventListener('click', function () {
        if (!core.current()) {
          window.open('jingling.html?from=tafei', '_blank', 'noopener');
          setStatus('先去精灵小屋领一个伙伴，再放出全站挂件。');
          return;
        }
        core.setWidget(!(core.state().widget && core.state().widget.on));
        syncWidgetButton();
        setStatus(core.state().widget.on ? '全站挂件已放出：电脑端会出现在页面右下角，可以拖动。' : '全站挂件已收起。');
        render();
      });
    }
    if (mini) mini.addEventListener('click', doPet);
    core.subscribe(render);
  }

  function init() {
    bind();
    render();
    if (speech) speech.textContent = idleLine();
  }

  init();
})();
