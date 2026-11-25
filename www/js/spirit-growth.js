/* TAFEI 精灵成长 · 第二阶段（v1）
   陪伴时长 → 经验；每日任务 → 经验 + 亲密度；陪伴等级 → 解锁权益
   引擎在 index / xiaota / angela 自动挂载，精灵小屋（#growthCard）自动渲染成长卡 */
(function () {
  'use strict';

  var CORE = window.TafeiSpirits;
  if (!CORE) return;
  if (window.TafeiGrowth) return;

  var KEY = 'tafei-spirit-growth';
  var CHANGE = 'tafei-growth-changed';

  var LEVELS = [
    { level: 1, need: 0, title: '初见', reward: '伙伴档案已建立' },
    { level: 2, need: 20, title: '眼熟', reward: '陪伴数据开始累计' },
    { level: 3, need: 50, title: '常来', reward: '免费解锁「瑶」' },
    { level: 4, need: 90, title: '有默契', reward: '专属互动台词' },
    { level: 5, need: 140, title: '老朋友', reward: '服务预约优先排期' },
    { level: 6, need: 200, title: '重要的人', reward: '私信专属签名' },
    { level: 7, need: 270, title: '形影不离', reward: '限定卡面边框' },
    { level: 8, need: 350, title: '灵魂搭档', reward: '个人主页展示位' },
    { level: 9, need: 440, title: '命定伙伴', reward: '专属称号' },
    { level: 10, need: 540, title: '永远的伙伴', reward: '永久纪念卡' }
  ];

  var TASKS = [
    { id: 'pet', title: '和伙伴互动 8 次', goal: 8, exp: 6, unit: '次' },
    { id: 'stay', title: '陪伙伴待满 15 分钟', goal: 15, exp: 8, unit: '分钟' },
    { id: 'visit', title: '打开精灵小屋看看', goal: 1, exp: 4, unit: '次' }
  ];

  var day = (CORE.todayKey && CORE.todayKey()) || new Date().toDateString();

  function blank(d) {
    return { day: d, exp: 0, stayMin: 0, staySec: 0, pet: 0, visit: 0, claimed: {}, awards: {}, lastPets: 0, bonus5: 0 };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var g = raw ? JSON.parse(raw) : null;
      if (!g || typeof g !== 'object') return blank(day);
      if (g.day !== day) {
        /* 跨天：只保留累计经验与已领的永久权益 */
        g.day = day;
        g.stayMin = 0; g.staySec = 0; g.pet = 0; g.visit = 0;
        g.claimed = {}; g.bonus5 = 0;
        g.lastPets = (CORE.stats() || {}).pets || 0;
      }
      if (!g.claimed) g.claimed = {};
      if (!g.awards) g.awards = {};
      g.exp = Number(g.exp) || 0;
      return g;
    } catch (e) { return blank(day); }
  }

  var g = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(g)); } catch (e) {}
  }

  function emit() {
    try { window.dispatchEvent(new CustomEvent(CHANGE, { detail: state() })); } catch (e) {}
  }

  function levelOf(exp) {
    var idx = 0;
    for (var i = 0; i < LEVELS.length; i++) if (exp >= LEVELS[i].need) idx = i;
    return LEVELS[idx];
  }

  function nextOf(exp) {
    var cur = levelOf(exp);
    return LEVELS[cur.level] || null;   /* 数组下标 = level */
  }

  function state() {
    var cur = levelOf(g.exp);
    var next = nextOf(g.exp);
    var floor = cur.need;
    var ceil = next ? next.need : cur.need;
    var pct = next ? Math.min(100, Math.round(((g.exp - floor) / (ceil - floor)) * 100)) : 100;
    return {
      day: g.day,
      exp: g.exp,
      level: cur.level,
      title: cur.title,
      reward: cur.reward,
      nextLevel: next ? next.level : 0,
      nextNeed: next ? next.need : 0,
      nextTitle: next ? next.title : '',
      nextReward: next ? next.reward : '',
      pct: pct,
      stayMin: g.stayMin,
      tasks: TASKS.map(function (t) {
        var count = t.id === 'pet' ? g.pet : (t.id === 'stay' ? g.stayMin : g.visit);
        count = Math.min(count, t.goal);
        return {
          id: t.id, title: t.title, unit: t.unit,
          current: count, goal: t.goal, exp: t.exp,
          done: count >= t.goal,
          claimed: !!g.claimed[t.id]
        };
      })
    };
  }

  function syncPets() {
    var pets = (CORE.stats() || {}).pets || 0;
    if (pets > (g.lastPets || 0)) {
      g.pet += (pets - g.lastPets);
      g.lastPets = pets;
      save();
      emit();
    } else if (pets < (g.lastPets || 0)) {
      g.lastPets = pets;
    }
  }

  function claim(id) {
    var t = TASKS.filter(function (x) { return x.id === id; })[0];
    if (!t) return false;
    var count = t.id === 'pet' ? g.pet : (t.id === 'stay' ? g.stayMin : g.visit);
    if (count < t.goal || g.claimed[t.id]) return false;
    g.claimed[t.id] = true;
    g.exp += t.exp;
    save();
    try {
      var s = CORE.current();
      CORE.adjustBond(s ? s.id : undefined, 1);
    } catch (e) {}
    checkLevelAwards();
    emit();
    return true;
  }

  function checkLevelAwards() {
    var lv = levelOf(g.exp).level;
    if (lv >= 3 && !g.awards.yao) {
      g.awards.yao = true;
      try {
        if (!CORE.isUnlocked('yao')) CORE.buySpirit('yao');
      } catch (e) {}
      save();
    }
  }

  function addExp(n) {
    n = Number(n) || 0;
    if (n <= 0) return;
    g.exp += n;
    save();
    checkLevelAwards();
    emit();
  }

  /* ---------- 采集 ---------- */
  var lastTick = Date.now();
  function tick() {
    var now = Date.now();
    var delta = Math.min(5, Math.round((now - lastTick) / 60000));
    lastTick = now;
    if (document.hidden) return;
    g.staySec += 1;
    if (g.staySec >= 60) {
      g.staySec -= 60;
      if (g.stayMin < 120) g.stayMin += 1;                    /* 任务只需要 15 分钟，上限留着做统计 */
      var bonusCap = 24;                                      /* 每 5 分钟 +1 经验，每天最多 24 */
      if (g.stayMin % 5 === 0 && g.bonus5 < bonusCap) {
        g.bonus5 += 1;
        g.exp += 1;
        checkLevelAwards();
      }
      save();
      emit();
    }
    syncPets();
  }

  function recordVisit() {
    if (g.visit > 0) return;
    g.visit += 1;
    save();
    emit();
  }

  function boot() {
    g.lastPets = (CORE.stats() || {}).pets || 0;
    save();
    setInterval(tick, 1000);
    setInterval(syncPets, 4000);
    if (/jingling\.html/.test(location.pathname)) recordVisit();
    emit();
  }

  window.TafeiGrowth = {
    state: state,
    levels: function () { return LEVELS.slice(); },
    claim: claim,
    addExp: addExp,
    recordVisit: recordVisit,
    reset: function () { g = blank(day); save(); emit(); },
    changedEvent: CHANGE
  };

  /* ---------- 精灵小屋里的成长卡 ---------- */
  var CSS =
    '.growth-card{padding:18px;border-radius:20px;border:1px solid rgba(130,170,255,.24);'
    + 'background:linear-gradient(160deg,rgba(34,58,112,.72),rgba(15,25,48,.86));color:#eef4ff}'
    + 'body.light .growth-card{background:linear-gradient(160deg,#fff,#eef4fd);color:#16233c;border-color:rgba(55,91,160,.22)}'
    + '.gc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}'
    + '.gc-kicker{margin:0;font-size:10px;letter-spacing:.16em;color:#9aaccb}'
    + '.gc-lv{display:flex;align-items:center;gap:8px;margin:6px 0 0}'
    + '.gc-lv b{font-size:19px;font-weight:900}'
    + '.gc-lv span{font-size:12.5px;color:#64e8ff}'
    + '.gc-exp{text-align:right;flex:0 0 auto}'
    + '.gc-exp b{display:block;font-size:18px;font-weight:900;color:#64e8ff}'
    + '.gc-exp span{font-size:10.5px;color:#9aaccb}'
    + '.gc-bar{position:relative;height:8px;margin:12px 0 6px;border-radius:8px;background:rgba(8,16,32,.55);overflow:hidden}'
    + '.gc-bar i{position:absolute;inset:0 auto 0 0;width:0;border-radius:8px;'
    + 'background:linear-gradient(90deg,#53ddff,#728cff 60%,#b28cff);transition:width .4s ease}'
    + '.gc-hint{font-size:11px;color:#9aaccb;line-height:1.55}'
    + '.gc-tasks{margin-top:14px;display:grid;gap:8px}'
    + '.gc-task{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:13px;'
    + 'background:rgba(9,18,36,.55);border:1px solid rgba(130,170,255,.16)}'
    + 'body.light .gc-task{background:#f6f9ff;border-color:rgba(55,91,160,.16)}'
    + '.gc-task.done{border-color:rgba(100,232,255,.44)}'
    + '.gc-task .t-main{flex:1;min-width:0}'
    + '.gc-task .t-main b{display:block;font-size:12.5px;font-weight:800}'
    + '.gc-task .t-main span{font-size:10.5px;color:#9aaccb}'
    + '.gc-task button{flex:0 0 auto;padding:7px 12px;border-radius:10px;border:0;cursor:pointer;'
    + 'font:800 11.5px/1 -apple-system,"PingFang SC",sans-serif;color:#06101f;'
    + 'background:linear-gradient(120deg,#53ddff,#728cff)}'
    + '.gc-task button[disabled]{opacity:.5;background:rgba(130,170,255,.22);color:#9aaccb}'
    + '.gc-claim mark{padding:6px 12px;border-radius:10px;font-size:11px;background:rgba(100,232,255,.16);color:#a8f0ff}'
    + '.gc-foot{margin-top:12px;font-size:10.5px;color:#9aaccb;line-height:1.6}';

  function injectCss() {
    if (document.querySelector('style[data-tf-growth]')) return;
    var st = document.createElement('style');
    st.setAttribute('data-tf-growth', '1');
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderCard() {
    var box = document.getElementById('growthCard');
    if (!box) return;
    injectCss();
    var s = state();
    var rows = s.tasks.map(function (t) {
      var right;
      if (t.claimed) right = '<span class="gc-claim"><mark>已领取</mark></span>';
      else if (t.done) right = '<button type="button" data-claim="' + t.id + '">领取 +' + t.exp + '</button>';
      else right = '<button type="button" disabled>' + t.current + '/' + t.goal + '</button>';
      return '<div class="gc-task' + (t.done ? ' done' : '') + '">'
        + '<div class="t-main"><b>' + esc(t.title) + '</b>'
        + '<span>今日进度 ' + t.current + '/' + t.goal + ' ' + esc(t.unit) + ' · 完成可得 ' + t.exp + ' 成长值</span></div>'
        + right + '</div>';
    }).join('');
    box.innerHTML =
      '<div class="gc-top">'
      + '<div><p class="gc-kicker">COMPANION GROWTH</p>'
      + '<div class="gc-lv"><b>Lv.' + s.level + '</b><span>' + esc(s.title) + '</span></div>'
      + '<p class="gc-hint">' + (s.nextLevel
        ? '距 Lv.' + s.nextLevel + '「' + esc(s.nextTitle) + '」还差 ' + (s.nextNeed - s.exp) + ' 成长值'
        : '已经到顶了，剩下的日子慢慢过就好') + '</p></div>'
      + '<div class="gc-exp"><b>' + s.exp + '</b><span>成长值</span></div>'
      + '</div>'
      + '<div class="gc-bar"><i style="width:' + s.pct + '%"></i></div>'
      + '<div class="gc-hint">当前权益：' + esc(s.reward) + '</div>'
      + '<div class="gc-tasks">' + rows + '</div>'
      + '<div class="gc-foot">挂件在线时每 5 分钟 +1 成长值（每天上限 24），互动、陪伴与任务都会计入；'
      + '成长值跨伙伴累计，亲密度仍然按伙伴单独计算。</div>';
    var btns = box.querySelectorAll('[data-claim]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var id = this.getAttribute('data-claim');
        if (claim(id)) renderCard();
      });
    }
  }

  window.addEventListener(CHANGE, renderCard);
  window.addEventListener('storage', function (e) { if (e.key === KEY) { g = load(); renderCard(); } });
  setInterval(renderCard, 15000);

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 200);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 200); });
})();
