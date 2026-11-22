/* TAFEI SPIRIT CORE v1
   精灵小屋共享数据层：角色、皮肤、道具、状态、解锁、挂件位置、云端接口。
   本地原型使用演示额度；Supabase 表和函数就绪后自动切到真实额度。 */
(function (window) {
  'use strict';

  var STORAGE_KEY = 'tafei-spirit-v2';
  var CONFIG_KEY = 'tafei-spirit-config-v1';
  var AUTH_KEY = 'tafei-auth-session';
  var REST = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1';
  var SUPABASE_KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  var SPIRIT_CONFIG_TABLE = 'tafei_spirit_config';
  var SPIRIT_PROFILE_TABLE = 'tafei_spirit_profiles';
  var OWNER_EMAIL = '3659229103@qq.com';
  var CHANGE_EVENT = 'tafei:spirit-change';
  var DEFAULT_DEMO_CREDITS = 120;

  function clamp(value, min, max) {
    value = Number(value);
    if (!Number.isFinite(value)) value = min;
    return Math.max(min, Math.min(max, value));
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function session() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; }
  }
  function authToken() {
    var s = session();
    return s && s.access_token ? s.access_token : '';
  }
  function authUserId() {
    var s = session();
    return s && s.user && s.user.id ? s.user.id : '';
  }
  function authEmail() {
    var s = session();
    return s && s.user && s.user.email ? String(s.user.email).toLowerCase() : '';
  }

  var SPIRITS = [
    {
      id: 'xiaota', name: '小挞飞', game: '挞飞原创 · 挞壳精灵', tag: '挞飞原创',
      original: true, img: 'assets/spirits/xiaota.jpg', accent: '#ffd36e',
      line: '挞壳是帽子，奶油是身体，围巾是青绿色的风。',
      quote: '你回来啦。今天也要一起收集糖霜吗？',
      defaultSkin: 'xiaota-default',
      intro: '挞飞原创伙伴，0 额度领取，领取后才会住进小屋。'
    },
    {
      id: 'xi-shi', name: '西施', game: '王者荣耀 · 幻纱之灵', tag: '王者荣耀',
      img: 'assets/spirits/xi-shi.jpg', accent: '#8fd7ff',
      line: '水波会记住每一次相遇。',
      quote: '今天的水面很安静，要一起看莲花吗？',
      defaultSkin: 'xi-shi-default',
      intro: '水波、莲花和一场安静的相遇。'
    },
    {
      id: 'angela', name: '安琪拉', game: '王者荣耀 · 暗夜萝莉', tag: '王者荣耀',
      img: 'assets/spirits/angela.jpg', accent: '#ff9fc2',
      line: '知识，就是力量。',
      quote: '书页翻到哪一页，魔法就从哪一页开始。',
      defaultSkin: 'angela-default',
      intro: '粉色双马尾、圆眼镜，还有一本会发光的书。'
    },
    {
      id: 'yao', name: '瑶', game: '王者荣耀 · 鹿灵守心', tag: '王者荣耀',
      img: 'assets/spirits/yao.jpg', accent: '#ffb3d9',
      line: '森林里没有陌生人，只有还没认识的朋友。',
      quote: '小鹿说，今天适合去林子里散步。',
      defaultSkin: 'yao-default',
      intro: '鹿角、森林和一只跟着她的小鹿。'
    },
    {
      id: 'gardener', name: '园丁', game: '第五人格 · 艾玛·伍兹', tag: '第五人格',
      img: 'assets/spirits/gardener.jpg', accent: '#b8e28a',
      line: '先把工具箱放好，再慢慢来。',
      quote: '你要不要看看我新种下的那棵小树？',
      defaultSkin: 'gardener-default',
      intro: '草帽、工具箱，还有一句“慢慢来”。'
    },
    {
      id: 'doctor', name: '医生', game: '第五人格 · 艾米丽·黛儿', tag: '第五人格',
      img: 'assets/spirits/doctor.jpg', accent: '#a9ddff',
      line: '别紧张，我会一直在。',
      quote: '先坐下休息一下，伤口不会自己好。',
      defaultSkin: 'doctor-default',
      intro: '浅蓝护士服，和一句“别紧张”。'
    },
    {
      id: 'mechanic', name: '机械师', game: '第五人格 · 特蕾西·列兹尼克', tag: '第五人格',
      img: 'assets/spirits/mechanic.jpg', accent: '#ffd27a',
      line: '齿轮转起来的时候，世界就安静了。',
      quote: '这个小玩偶会自己走两步，要看看吗？',
      defaultSkin: 'mechanic-default',
      intro: '护目镜、齿轮，还有会走路的小玩偶。'
    },
    {
      id: 'perfumer', name: '调香师', game: '第五人格 · 薇拉·奈尔', tag: '第五人格',
      img: 'assets/spirits/perfumer.jpg', accent: '#c5a8ff',
      line: '气味比记忆更诚实。',
      quote: '这一瓶是今天调的，前调有点甜。',
      defaultSkin: 'perfumer-default',
      intro: '黑礼帽、香水瓶，和一点紫色雾气。'
    },
    {
      id: 'tanluning', name: '昙露凝', game: '纸嫁衣9 · 罗浮梦', tag: '纸嫁衣',
      img: 'assets/spirits/tanluning-daily.jpg', accent: '#ff9d9d',
      line: '我叫昙露凝。你记得我的名字吗？',
      quote: '如果梦会醒，你还会记得我吗？',
      defaultSkin: 'tanluning-daily',
      intro: '圆框眼镜、白昙花发夹，和旧车站的梦。'
    }
  ];

  var SKINS = [
    { id: 'xiaota-default', spirit: 'xiaota', name: '挞壳精灵', img: 'assets/spirits/xiaota.jpg', price: 0, default: true, quote: '挞壳是帽子，奶油是身体，围巾是青绿色的风。' },
    { id: 'xi-shi-default', spirit: 'xi-shi', name: '幻纱之灵', img: 'assets/spirits/xi-shi.jpg', price: 0, default: true },
    { id: 'angela-default', spirit: 'angela', name: '暗夜萝莉', img: 'assets/spirits/angela.jpg', price: 0, default: true },
    { id: 'yao-default', spirit: 'yao', name: '鹿灵守心', img: 'assets/spirits/yao.jpg', price: 0, default: true },
    { id: 'gardener-default', spirit: 'gardener', name: '园丁日常', img: 'assets/spirits/gardener.jpg', price: 0, default: true },
    { id: 'doctor-default', spirit: 'doctor', name: '医生日常', img: 'assets/spirits/doctor.jpg', price: 0, default: true },
    { id: 'mechanic-default', spirit: 'mechanic', name: '机械师日常', img: 'assets/spirits/mechanic.jpg', price: 0, default: true },
    { id: 'perfumer-default', spirit: 'perfumer', name: '调香师日常', img: 'assets/spirits/perfumer.jpg', price: 0, default: true },
    { id: 'tanluning-daily', spirit: 'tanluning', name: '日常绿开衫', img: 'assets/spirits/tanluning-daily.jpg', price: 0, default: true, quote: '如果梦会醒，你还会记得我吗？' },
    { id: 'tanluning-bridal', spirit: 'tanluning', name: '红嫁衣', img: 'assets/spirits/tanluning.jpg', price: 0, default: true, quote: '红嫁衣、圆框眼镜、白昙花——都是她留下的线索。' },
    { id: 'tanluning-uniform', spirit: 'tanluning', name: '民国学生装', img: 'assets/spirits/tanluning-uniform.jpg', price: 18, default: false, test: true, quote: '月白上衣，深蓝裙摆，像从旧照片里走出来的一天。' }
  ];

  var ITEMS = [
    { id: 'sugar-cake', kind: 'food', name: '白糖糕', icon: '糕', price: 2, desc: '松软清甜，先垫一垫肚子。', effect: { satiety: 8, mood: 2 } },
    { id: 'tea', kind: 'food', name: '清茶', icon: '茶', price: 3, desc: '温热的清茶，喝完会清醒一点。', effect: { satiety: 5, sleepiness: -4 } },
    { id: 'osmanthus', kind: 'food', name: '桂花酥', icon: '酥', price: 5, desc: '一层桂花一层酥，心情也会变甜。', effect: { satiety: 12, mood: 4 } },
    { id: 'sweet-soup', kind: 'food', name: '甜汤', icon: '汤', price: 8, desc: '慢慢喝完，胃和心都暖起来。', effect: { satiety: 15, mood: 6 } },
    { id: 'tanhua-cake', kind: 'food', name: '昙花糕', icon: '花', price: 12, desc: '只在夜里开花的点心，吃完会安静下来。', effect: { satiety: 20, mood: 10, anger: -4 } },
    { id: 'anshen-soup', kind: 'food', name: '安神羹', icon: '羹', price: 15, desc: '适合困倦的时候，小口小口喝。', effect: { satiety: 18, mood: 8, sleepiness: 6 } },
    { id: 'kite', kind: 'toy', name: '纸鸢', icon: '鸢', price: 5, desc: '拉着线跑两圈，困意会被风吹走。', effect: { mood: 8, sleepiness: -3 }, dailyLimit: 2 },
    { id: 'rattle', kind: 'toy', name: '拨浪鼓', icon: '鼓', price: 8, desc: '摇一摇，坏情绪也会跟着抖落。', effect: { mood: 10, anger: -2 }, dailyLimit: 2 },
    { id: 'sandbag', kind: 'toy', name: '沙包', icon: '包', price: 10, desc: '抛起来接住，注意力就回来了。', effect: { mood: 12, sleepiness: -4 }, dailyLimit: 2 },
    { id: 'mirror', kind: 'toy', name: '琉璃手镜', icon: '镜', price: 18, desc: '镜面里有一小片会动的光。', effect: { mood: 15, anger: -6, bond: 1 }, dailyLimit: 2 },
    { id: 'lantern', kind: 'toy', name: '昙花灯', icon: '灯', price: 20, desc: '灯一亮，房间会安静下来。', effect: { mood: 20, sleepiness: 5, bond: 2 }, dailyLimit: 2 },
    { id: 'album', kind: 'toy', name: '旧相册', icon: '册', price: 25, desc: '翻到一页旧照片，她会记得很久。', effect: { mood: 18, anger: -8, bond: 3 }, dailyLimit: 2 }
  ];

  function defaultConfig() {
    var next = {
      version: 1,
      spirits: {},
      skins: {},
      items: {},
      rules: {
        satietyDecayPerHour: 1.2,
        moodDecayPerHour: 0.8,
        sleepinessGainPerHour: 1.5,
        angerGainPerHour: 0.6,
        sleepRecoverPerHour: 4,
        idleSleepMinutes: 10,
        autoSleepAt: 85,
        idleSleepAt: 65,
        angerHigh: 75,
        hungerLow: 25,
        moodHigh: 75,
        fightBondPenalty: 2,
        tickMinutes: 1
      }
    };
    SPIRITS.forEach(function (spirit) {
      next.spirits[spirit.id] = {
        price: spirit.id === 'xiaota' ? 0 : ({ 'xi-shi': 20, 'angela': 24, 'yao': 28, 'gardener': 32, 'doctor': 36, 'mechanic': 40, 'perfumer': 44, 'tanluning': 52 }[spirit.id] || 20),
        enabled: true,
        mode: spirit.id === 'xiaota' ? 'free' : 'request'
      };
    });
    SKINS.forEach(function (skin) {
      next.skins[skin.id] = { price: skin.price || 0, enabled: true };
    });
    ITEMS.forEach(function (item) {
      next.items[item.id] = { price: item.price, enabled: true };
    });
    return next;
  }

  var DEFAULT_STATE = {
    version: 2,
    selected: '',
    selectedSkin: '',
    unlocked: [],
    ownedSkins: [],
    inventory: {},
    status: { satiety: 72, mood: 76, anger: 8, sleepiness: 20 },
    bond: {},
    credits: DEFAULT_DEMO_CREDITS,
    widget: { on: false, x: 0.86, y: 0.7, corner: 'br' },
    lastTick: 0,
    lastInteraction: 0,
    today: { date: '', toys: {} },
    updatedAt: 0
  };

  function normalizeState(saved) {
    var next = copy(DEFAULT_STATE);
    if (saved && typeof saved === 'object') {
      if (Array.isArray(saved.unlocked)) next.unlocked = saved.unlocked.slice();
      if (Array.isArray(saved.ownedSkins)) next.ownedSkins = saved.ownedSkins.slice();
      if (saved.inventory && typeof saved.inventory === 'object') next.inventory = copy(saved.inventory);
      if (saved.status) {
        next.status.satiety = clamp(saved.status.satiety, 0, 100);
        next.status.mood = clamp(saved.status.mood, 0, 100);
        next.status.anger = clamp(saved.status.anger, 0, 100);
        next.status.sleepiness = clamp(saved.status.sleepiness, 0, 100);
      }
      if (saved.bond && typeof saved.bond === 'object') next.bond = copy(saved.bond);
      if (typeof saved.selected === 'string') next.selected = saved.selected;
      if (typeof saved.selectedSkin === 'string') next.selectedSkin = saved.selectedSkin;
      if (typeof saved.credits === 'number' && Number.isFinite(saved.credits)) next.credits = Math.max(0, saved.credits);
      if (saved.widget && typeof saved.widget === 'object') {
        next.widget.on = !!saved.widget.on;
        next.widget.x = clamp(saved.widget.x, 0, 1);
        next.widget.y = clamp(saved.widget.y, 0, 1);
        next.widget.corner = saved.widget.corner || 'br';
      }
      next.lastTick = Number(saved.lastTick) || 0;
      next.lastInteraction = Number(saved.lastInteraction) || 0;
      if (saved.today && saved.today.date) next.today = saved.today;
      next.updatedAt = Number(saved.updatedAt) || 0;
    }
    // 解锁角色时，0 额度皮肤一并拥有；小挞飞不再默认解锁，需要在小屋手动领取
    next.unlocked.forEach(function (id) {
      var spirit = spiritById(id);
      if (!spirit) return;
      skinsOf(id).forEach(function (skin) {
        if (priceOfSkin(skin.id) === 0 && next.ownedSkins.indexOf(skin.id) === -1) next.ownedSkins.push(skin.id);
      });
      if (next.ownedSkins.indexOf(spirit.defaultSkin) === -1) next.ownedSkins.push(spirit.defaultSkin);
    });
    // 未解锁角色不能作为当前伙伴
    if (!next.selected || next.unlocked.indexOf(next.selected) === -1) {
      next.selected = '';
      next.selectedSkin = '';
    }
    if (next.selected && next.ownedSkins.indexOf(next.selectedSkin) === -1) {
      var current = spiritById(next.selected);
      next.selectedSkin = current ? current.defaultSkin : '';
    }
    if (!next.lastTick) next.lastTick = Date.now();
    if (!next.lastInteraction) next.lastInteraction = Date.now();
    if (!next.today.date || next.today.date !== todayKey()) next.today = { date: todayKey(), toys: {} };
    return next;
  }

  function loadConfig() {
    var next = defaultConfig();
    try {
      var raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.version) next = mergeConfig(next, saved);
      }
    } catch (error) {}
    return next;
  }

  function mergeConfig(base, remote) {
    var next = copy(base);
    if (!remote || typeof remote !== 'object') return next;
    ['spirits', 'skins', 'items'].forEach(function (group) {
      if (!remote[group] || typeof remote[group] !== 'object') return;
      Object.keys(next[group]).forEach(function (id) {
        if (!remote[group][id]) return;
        next[group][id].price = Math.max(0, Number(remote[group][id].price) || 0);
        next[group][id].enabled = remote[group][id].enabled !== false;
        if (group === 'spirits') {
          var mode = remote[group][id].mode;
          if (mode === 'purchase' || mode === 'request' || mode === 'free') next[group][id].mode = mode;
        }
      });
    });
    if (remote.rules && typeof remote.rules === 'object') {
      Object.keys(next.rules).forEach(function (key) {
        if (remote.rules[key] != null && Number.isFinite(Number(remote.rules[key]))) {
          next.rules[key] = Number(remote.rules[key]);
        }
      });
    }
    return next;
  }

  var config = loadConfig();
  var state = normalizeState(loadState());
  var cloudReady = false;
  var cloudChecked = false;
  var cloudConfigLoaded = false;
  var cloudConfig = null;
  var wallet = { amount: state.credits, real: false };
  var listeners = [];
  var saveTimer = 0;
  var syncTimer = 0;

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) { return null; }
  }

  function persist() {
    state.updatedAt = Date.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) {}
  }

  function emit() {
    var detail = snapshot();
    listeners.forEach(function (fn) { try { fn(detail); } catch (error) {} });
    try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: detail })); } catch (error) {}
  }

  function save(notify) {
    persist();
    if (notify !== false) emit();
    if (cloudReady && authToken()) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(function () { saveCloudState(); }, 500);
    }
  }

  function spiritById(id) {
    for (var i = 0; i < SPIRITS.length; i++) if (SPIRITS[i].id === id) return SPIRITS[i];
    return null;
  }
  function skinById(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
    return null;
  }
  function itemById(id) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
    return null;
  }
  function skinsOf(spiritId) {
    return SKINS.filter(function (skin) { return skin.spirit === spiritId; });
  }
  function currentSpirit() {
    if (!state.selected || state.unlocked.indexOf(state.selected) === -1) return null;
    return spiritById(state.selected);
  }
  function currentSkin() {
    var spirit = currentSpirit();
    if (!spirit) return null;
    var skin = skinById(state.selectedSkin);
    if (skin && skin.spirit === spirit.id && state.ownedSkins.indexOf(skin.id) !== -1) return skin;
    return skinById(spirit.defaultSkin) || skinsOf(spirit.id)[0] || null;
  }
  function statusOf(spiritId) {
    if (spiritId === state.selected) return state.status;
    return state.status;
  }
  function conditionOf(spiritId) {
    var s = statusOf(spiritId);
    var idleMinutes = Math.max(0, (Date.now() - (state.lastInteraction || Date.now())) / 60000);
    var rules = config.rules;
    if (s.anger >= rules.angerHigh) return 'angry';
    if (s.sleepiness >= rules.autoSleepAt || (idleMinutes >= rules.idleSleepMinutes && s.sleepiness >= rules.idleSleepAt)) return 'sleep';
    if (s.satiety <= rules.hungerLow) return 'hungry';
    if (s.mood >= rules.moodHigh) return 'happy';
    if (s.mood <= 30) return 'sad';
    return 'idle';
  }
  function conditionText(condition) {
    return {
      angry: '有点生气了',
      sleep: '困得靠在一起',
      hungry: '肚子饿了',
      happy: '心情很好',
      sad: '有点低落',
      idle: '安静待着'
    }[condition] || '安静待着';
  }

  function applyDecay() {
    var now = Date.now();
    var hours = Math.max(0, (now - (state.lastTick || now)) / 3600000);
    if (hours < 0.25) return false;
    var rules = config.rules;
    var step = Math.min(hours, 48);
    state.status.satiety = clamp(state.status.satiety - step * rules.satietyDecayPerHour, 0, 100);
    state.status.mood = clamp(state.status.mood - step * rules.moodDecayPerHour, 0, 100);
    state.status.sleepiness = clamp(state.status.sleepiness + step * rules.sleepinessGainPerHour, 0, 100);
    var idleHours = Math.max(0, (now - (state.lastInteraction || now)) / 3600000);
    if (idleHours >= 2) state.status.anger = clamp(state.status.anger + Math.min(step, idleHours) * rules.angerGainPerHour, 0, 100);
    // 自动睡眠期间缓慢恢复困意和怒气
    if (conditionOf(state.selected) === 'sleep') {
      state.status.sleepiness = clamp(state.status.sleepiness - step * rules.sleepRecoverPerHour, 0, 100);
      state.status.anger = clamp(state.status.anger - step * 0.8, 0, 100);
    }
    state.lastTick = now;
    persist();
    return true;
  }

  function ensureWallet() {
    var token = authToken();
    if (!token || !cloudReady) {
      wallet = { amount: state.credits, real: false };
      return Promise.resolve(wallet);
    }
    return fetch(REST + '/tafei_balance?select=current_amount,updated_at&user_id=eq.' + encodeURIComponent(authUserId()), {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }
    }).then(function (response) {
      if (!response.ok) throw new Error('balance ' + response.status);
      return response.json();
    }).then(function (rows) {
      var row = Array.isArray(rows) && rows.length ? rows[0] : null;
      wallet = { amount: row && Number.isFinite(Number(row.current_amount)) ? Number(row.current_amount) : 0, real: true };
      emit();
      return wallet;
    }).catch(function () {
      wallet = { amount: state.credits, real: false };
      return wallet;
    });
  }

  function probeCloud() {
    if (cloudChecked) return Promise.resolve(cloudReady);
    cloudChecked = true;
    return fetch(REST + '/' + SPIRIT_CONFIG_TABLE + '?select=key,value&key=eq.catalog&limit=1', {
      headers: { apikey: SUPABASE_KEY }
    }).then(function (response) {
      if (!response.ok) throw new Error('config ' + response.status);
      return response.json();
    }).then(function (rows) {
      cloudReady = true;
      if (Array.isArray(rows) && rows.length && rows[0].value) {
        cloudConfig = rows[0].value;
        cloudConfigLoaded = true;
        config = mergeConfig(defaultConfig(), cloudConfig);
        emit();
      }
      return loadCloudProfile();
    }).catch(function () {
      cloudReady = false;
      return false;
    });
  }

  function loadCloudProfile() {
    var token = authToken();
    var uid = authUserId();
    if (!token || !uid || !cloudReady) return Promise.resolve(false);
    return fetch(REST + '/' + SPIRIT_PROFILE_TABLE + '?select=*&user_id=eq.' + encodeURIComponent(uid) + '&limit=1', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }
    }).then(function (response) {
      if (!response.ok) throw new Error('profile ' + response.status);
      return response.json();
    }).then(function (rows) {
      if (!Array.isArray(rows) || !rows.length) return false;
      var row = rows[0];
      state.selected = row.selected_spirit || state.selected;
      state.selectedSkin = row.selected_skin || state.selectedSkin;
      if (row.status && typeof row.status === 'object') {
        state.status.satiety = clamp(row.status.satiety, 0, 100);
        state.status.mood = clamp(row.status.mood, 0, 100);
        state.status.anger = clamp(row.status.anger, 0, 100);
        state.status.sleepiness = clamp(row.status.sleepiness, 0, 100);
      }
      if (row.bond && typeof row.bond === 'object') state.bond = row.bond;
      if (row.inventory && typeof row.inventory === 'object') state.inventory = row.inventory;
      if (Array.isArray(row.owned_spirits)) state.unlocked = row.owned_spirits.slice();
      if (Array.isArray(row.owned_skins)) state.ownedSkins = row.owned_skins.slice();
      if (row.widget && typeof row.widget === 'object') state.widget = row.widget;
      state = normalizeState(state);
      persist();
      emit();
      return true;
    }).catch(function () { return false; });
  }

  function saveCloudState() {
    var token = authToken();
    var uid = authUserId();
    if (!token || !uid || !cloudReady) return Promise.resolve(false);
    return fetch(REST + '/rpc/tafei_spirit_save_state', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_state: {
          selected_spirit: state.selected,
          selected_skin: state.selectedSkin,
          widget: state.widget,
          status: state.status,
          bond: state.bond
        }
      })
    }).then(function (response) {
      if (!response.ok) throw new Error('save ' + response.status);
      return response.json();
    }).catch(function () { return false; });
  }

  function buyCloud(kind, id) {
    var token = authToken();
    if (!token || !cloudReady) return Promise.reject(new Error('当前是本地演示额度，暂不扣真实额度。'));
    return fetch(REST + '/rpc/tafei_spirit_buy', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_kind: kind, p_id: id })
    }).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (error) { data = text; }
        if (!response.ok) {
          var message = (data && (data.message || data.hint || data.details)) || ('购买失败 ' + response.status);
          throw new Error(message);
        }
        return data;
      });
    }).then(function (data) {
      return loadCloudProfile().then(function () {
        return ensureWallet().then(function () {
          emit();
          return data;
        });
      });
    });
  }

  function spendLocal(amount) {
    amount = Number(amount) || 0;
    if (state.credits < amount) throw new Error('演示额度不足，先在后台或登录后补充额度。');
    state.credits -= amount;
    wallet = { amount: state.credits, real: false };
    return state.credits;
  }

  function addBond(spiritId, amount) {
    state.bond[spiritId] = Math.max(0, Math.round((Number(state.bond[spiritId]) || 0) + (Number(amount) || 0)));
  }

  function adjustBond(spiritId, delta) {
    addBond(spiritId || state.selected, delta);
    state.lastInteraction = Date.now();
    save();
  }

  function applyEffect(effect, spiritId) {
    spiritId = spiritId || state.selected;
    var s = statusOf(spiritId);
    if (effect.satiety) s.satiety = clamp(s.satiety + effect.satiety, 0, 100);
    if (effect.mood) s.mood = clamp(s.mood + effect.mood, 0, 100);
    if (effect.anger) s.anger = clamp(s.anger + effect.anger, 0, 100);
    if (effect.sleepiness) s.sleepiness = clamp(s.sleepiness + effect.sleepiness, 0, 100);
    if (effect.bond) addBond(spiritId, effect.bond);
    state.lastInteraction = Date.now();
  }

  function priceOfSpirit(id) {
    var entry = config.spirits[id];
    return entry ? Number(entry.price) || 0 : 0;
  }
  function modeOfSpirit(id) {
    var entry = config.spirits[id];
    var mode = entry && entry.mode;
    if (mode === 'purchase' || mode === 'request' || mode === 'free') return mode;
    return id === 'xiaota' ? 'free' : 'request';
  }
  function priceOfSkin(id) {
    var entry = config.skins[id];
    return entry ? Number(entry.price) || 0 : 0;
  }
  function priceOfItem(id) {
    var entry = config.items[id];
    return entry ? Number(entry.price) || 0 : 0;
  }
  function spiritEnabled(id) {
    return !!config.spirits[id] && config.spirits[id].enabled !== false;
  }
  function skinEnabled(id) {
    return !!config.skins[id] && config.skins[id].enabled !== false;
  }
  function itemEnabled(id) {
    return !!config.items[id] && config.items[id].enabled !== false;
  }

  function buySpirit(id) {
    var spirit = spiritById(id);
    if (!spirit) throw new Error('没有这个角色。');
    if (!spiritEnabled(id)) throw new Error('这个角色暂未上架。');
    var mode = modeOfSpirit(id);
    if (mode === 'request') throw new Error('这款是站长后台私下发放，不开放额度购买。');
    if (state.unlocked.indexOf(id) !== -1) return Promise.resolve({ already: true });
    var price = mode === 'free' ? 0 : priceOfSpirit(id);
    var local = wallet.real ? buyCloud('spirit', id) : null;
    if (!wallet.real) {
      spendLocal(price);
      state.unlocked.push(id);
      skinsOf(id).forEach(function (skin) {
        if (priceOfSkin(skin.id) === 0 && state.ownedSkins.indexOf(skin.id) === -1) state.ownedSkins.push(skin.id);
      });
      if (state.ownedSkins.indexOf(spirit.defaultSkin) === -1) state.ownedSkins.push(spirit.defaultSkin);
      state.lastInteraction = Date.now();
      save();
      return Promise.resolve({ already: false, amount: price });
    }
    return local;
  }

  function buySkin(skinId) {
    var skin = skinById(skinId);
    if (!skin) throw new Error('没有这套皮肤。');
    if (!skinEnabled(skinId)) throw new Error('这套皮肤暂未上架。');
    if (state.ownedSkins.indexOf(skinId) !== -1) return Promise.resolve({ already: true });
    if (state.unlocked.indexOf(skin.spirit) === -1) throw new Error('先解锁这个角色，再买她的皮肤。');
    if (wallet.real) return buyCloud('skin', skinId);
    spendLocal(priceOfSkin(skinId));
    state.ownedSkins.push(skinId);
    state.lastInteraction = Date.now();
    save();
    return Promise.resolve({ already: false });
  }

  function buyItem(itemId, quantity) {
    var item = itemById(itemId);
    if (!item) throw new Error('没有这个道具。');
    if (!itemEnabled(itemId)) throw new Error('这个道具暂未上架。');
    quantity = Math.max(1, Math.min(99, Number(quantity) || 1));
    if (wallet.real) return buyCloud('item', itemId);
    spendLocal(priceOfItem(itemId) * quantity);
    state.inventory[itemId] = (Number(state.inventory[itemId]) || 0) + quantity;
    state.lastInteraction = Date.now();
    save();
    return Promise.resolve({ quantity: quantity });
  }

  function useItem(itemId, spiritId) {
    var item = itemById(itemId);
    if (!item) throw new Error('没有这个道具。');
    var count = Number(state.inventory[itemId]) || 0;
    if (count <= 0) throw new Error('这个东西已经用完了，先去零食铺或玩具架补货。');
    if (item.kind === 'toy') {
      var used = Number(state.today.toys[itemId]) || 0;
      if (item.dailyLimit && used >= item.dailyLimit) throw new Error('今天已经玩够了，明天再来。');
      state.today.toys[itemId] = used + 1;
    } else {
      state.inventory[itemId] = count - 1;
      if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
    }
    applyEffect(item.effect, spiritId || state.selected);
    save();
    return item;
  }

  function pet(spiritId) {
    var s = statusOf(spiritId);
    s.mood = clamp(s.mood + 4, 0, 100);
    s.anger = clamp(s.anger - 3, 0, 100);
    addBond(spiritId || state.selected, 1);
    state.lastInteraction = Date.now();
    save();
  }

  function selectSpirit(id, skinId) {
    if (state.unlocked.indexOf(id) === -1) throw new Error('这个伙伴还没有解锁。');
    var spirit = spiritById(id);
    if (!spirit) throw new Error('没有这个角色。');
    var nextSkin = skinId || spirit.defaultSkin;
    if (state.ownedSkins.indexOf(nextSkin) === -1) nextSkin = spirit.defaultSkin;
    state.selected = id;
    state.selectedSkin = nextSkin;
    state.lastInteraction = Date.now();
    save();
  }

  function selectSkin(skinId) {
    var skin = skinById(skinId);
    if (!skin) throw new Error('没有这套皮肤。');
    if (skin.spirit !== state.selected) throw new Error('这套皮肤不属于当前伙伴。');
    if (state.ownedSkins.indexOf(skinId) === -1) throw new Error('这套皮肤还没有解锁。');
    state.selectedSkin = skinId;
    state.lastInteraction = Date.now();
    save();
  }

  function setWidget(on, position) {
    state.widget.on = !!on;
    if (position) {
      if (position.x != null) state.widget.x = clamp(position.x, 0, 1);
      if (position.y != null) state.widget.y = clamp(position.y, 0, 1);
      if (position.corner) state.widget.corner = position.corner;
    }
    state.lastInteraction = Date.now();
    save();
  }

  function setWidgetPosition(x, y, corner) {
    state.widget.x = clamp(x, 0, 1);
    state.widget.y = clamp(y, 0, 1);
    state.widget.corner = corner || 'free';
    save(false);
  }

  function reset() {
    state = normalizeState(null);
    persist();
    emit();
  }

  function snapshot() {
    return {
      state: state,
      config: config,
      wallet: wallet,
      cloudReady: cloudReady,
      current: currentSpirit(),
      skin: currentSkin(),
      condition: conditionOf(state.selected),
      conditionText: conditionText(conditionOf(state.selected))
    };
  }

  function updateStatus(spiritId, next) {
    var s = statusOf(spiritId || state.selected);
    if (!next) return s;
    if (next.satiety != null) s.satiety = clamp(next.satiety, 0, 100);
    if (next.mood != null) s.mood = clamp(next.mood, 0, 100);
    if (next.anger != null) s.anger = clamp(next.anger, 0, 100);
    if (next.sleepiness != null) s.sleepiness = clamp(next.sleepiness, 0, 100);
    state.lastInteraction = Date.now();
    save();
    return s;
  }

  function setDemoCredits(amount) {
    state.credits = Math.max(0, Number(amount) || 0);
    wallet = { amount: state.credits, real: false };
    save();
  }

  window.TafeiSpirits = {
    SPIRITS: SPIRITS,
    SKINS: SKINS,
    ITEMS: ITEMS,
    config: function () { return config; },
    state: function () { return state; },
    snapshot: snapshot,
    current: currentSpirit,
    skin: currentSkin,
    skinsOf: skinsOf,
    spiritById: spiritById,
    skinById: skinById,
    itemById: itemById,
    status: statusOf,
    condition: conditionOf,
    conditionText: conditionText,
    priceOfSpirit: priceOfSpirit,
    modeOfSpirit: modeOfSpirit,
    priceOfSkin: priceOfSkin,
    priceOfItem: priceOfItem,
    isUnlocked: function (id) { return state.unlocked.indexOf(id) !== -1; },
    isSkinOwned: function (id) { return state.ownedSkins.indexOf(id) !== -1; },
    inventoryOf: function (id) { return Number(state.inventory[id]) || 0; },
    buySpirit: buySpirit,
    buySkin: buySkin,
    buyItem: buyItem,
    useItem: useItem,
    pet: pet,
    selectSpirit: selectSpirit,
    selectSkin: selectSkin,
    adjustBond: adjustBond,
    setWidget: setWidget,
    setWidgetPosition: setWidgetPosition,
    setDemoCredits: setDemoCredits,
    updateStatus: updateStatus,
    reset: reset,
    refreshWallet: ensureWallet,
    probeCloud: probeCloud,
    loadCloudProfile: loadCloudProfile,
    subscribe: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () {
        var index = listeners.indexOf(fn);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
    save: function () { save(); },
    changedEvent: CHANGE_EVENT,
    todayKey: todayKey
  };

  // 跨页签同步
  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY || event.key === CONFIG_KEY) {
      state = normalizeState(loadState());
      config = loadConfig();
      emit();
    } else if (event.key === AUTH_KEY) {
      cloudChecked = false;
      cloudReady = false;
      wallet = { amount: state.credits, real: false };
      emit();
    }
  });

  // 云端就绪后自动校正钱包和存档
  applyDecay();
  persist();
  probeCloud().then(function () {
    ensureWallet();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (applyDecay()) emit();
      ensureWallet();
    }
  });

  // 定期状态衰减
  setInterval(function () {
    if (applyDecay()) emit();
  }, Math.max(60000, config.rules.tickMinutes * 60000));
})(window);
