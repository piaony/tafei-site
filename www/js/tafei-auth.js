/* TAFEI 登录弹窗 · v1
   我的页 / 任意页面共用：window.TafeiAuth.open('login'|'register')
   账号体系 = 自定义账号 + 密码（内部映射为 账号@tafei.local），4 位数字验证码，可选绑定邮箱 */
(function () {
  'use strict';

  var ORIGIN = 'https://kwkewmhmxyjmzdjyutwa.supabase.co';
  var KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  var SUFFIX = '@tafei.local';
  var SETTINGS_URL = 'https://piaony.github.io/tafei-site/';

  var st = { mode: 'login', code: '', busy: false };
  var mask = null, card = null, tabLogin = null, tabReg = null;
  var formLogin = null, formReg = null, msgEl = null, canvasEl = null, toastEl = null;
  var inputs = {};

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function msg(text, ok) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.classList.toggle('on', !!text);
    msgEl.classList.toggle('ok', !!ok);
  }

  var toastTimer = 0;
  function showToast(text) {
    if (!toastEl) {
      toastEl = el('div', 'mc-toast');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));'
        + 'transform:translateX(-50%);max-width:80vw;padding:10px 16px;border-radius:14px;z-index:100070;'
        + 'background:rgba(12,24,44,.94);border:1px solid rgba(130,170,255,.34);color:#eef4ff;'
        + 'font-size:13px;text-align:center;opacity:0;transition:opacity .22s ease;pointer-events:none';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, 2200);
  }

  /* ---------- 验证码 ---------- */
  function drawCaptcha() {
    var digits = '';
    for (var i = 0; i < 4; i++) digits += String(Math.floor(Math.random() * 10));
    st.code = digits;
    var list = card ? card.querySelectorAll('.tfa-canvas') : [];
    for (var n = 0; n < list.length; n++) paintCaptcha(list[n], digits);
  }

  function paintCaptcha(canvasEl, digits) {
    if (!canvasEl) return;
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var w = 96, h = 40;
    canvasEl.width = w * dpr;
    canvasEl.height = h * dpr;
    var c = canvasEl.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#132a4f');
    g.addColorStop(1, '#1d1a3d');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (var k = 0; k < 26; k++) {
      c.strokeStyle = 'rgba(' + (90 + Math.random() * 120 | 0) + ',' + (150 + Math.random() * 90 | 0) + ',255,' + (0.1 + Math.random() * 0.22).toFixed(2) + ')';
      c.lineWidth = 0.6 + Math.random();
      c.beginPath();
      c.moveTo(Math.random() * w, Math.random() * h);
      c.lineTo(Math.random() * w, Math.random() * h);
      c.stroke();
    }
    var colors = ['#64e8ff', '#a9c2ff', '#e7bbff', '#8ef0d0'];
    for (var j = 0; j < 4; j++) {
      c.save();
      var x = 12 + j * 21 + Math.random() * 4;
      var y = 27 + (Math.random() * 6 - 3);
      c.translate(x, y);
      c.rotate((Math.random() * 0.5 - 0.25));
      c.font = '800 ' + (20 + Math.random() * 3).toFixed(0) + 'px -apple-system,"PingFang SC",Arial,sans-serif';
      c.fillStyle = colors[j % colors.length];
      c.fillText(digits[j], 0, 0);
      c.restore();
    }
  }

  /* ---------- UI ---------- */
  function buildUI() {
    if (mask) return;
    mask = el('div', 'tfa-mask');
    card = el('div', 'tfa-card');
    card.innerHTML =
      '<div class="tfa-head">'
      + '<div><h2 id="tfaTitle">登录挞飞</h2><p id="tfaSub">账号登录，进度、收藏和伙伴一起带走</p></div>'
      + '<button class="tfa-x" type="button" aria-label="关闭">✕</button>'
      + '</div>'
      + '<div class="tfa-tabs"><button class="tfa-tab on" type="button" data-tab="login">登录</button>'
      + '<button class="tfa-tab" type="button" data-tab="register">注册</button></div>'
      + '<form class="tfa-form" id="tfaLoginForm" autocomplete="on">'
      + '<div class="tfa-field"><label>账号</label>'
      + '<input class="tfa-input" id="tfaLoginUser" type="text" inputmode="latin" autocapitalize="off" autocorrect="off" placeholder="例如 piaony"></div>'
      + '<div class="tfa-field"><label>密码</label>'
      + '<input class="tfa-input" id="tfaLoginPass" type="password" autocomplete="current-password" placeholder="输入密码"></div>'
      + '<div class="tfa-field"><label>验证码</label>'
      + '<div class="tfa-cap"><input class="tfa-input" id="tfaLoginCap" type="text" inputmode="numeric" maxlength="4" placeholder="4 位数字">'
      + '<canvas class="tfa-canvas" id="tfaCanvas" width="96" height="40" title="点一下换一张"></canvas></div>'
      + '<div class="tfa-cap-tip">看不清？点右侧图片换一张</div></div>'
      + '<button class="tfa-submit" type="submit">登录</button>'
      + '<div class="tfa-foot"><button class="tfa-link sub" type="button" data-act="forgot">忘记密码</button>'
      + '<button class="tfa-link" type="button" data-act="to-register">没有账号？去注册</button></div>'
      + '</form>'
      + '<form class="tfa-form" id="tfaRegForm" hidden>'
      + '<div class="tfa-field"><label>账号</label>'
      + '<input class="tfa-input" id="tfaRegUser" type="text" inputmode="latin" autocapitalize="off" autocorrect="off" placeholder="3–16 位，字母/数字/下划线"></div>'
      + '<div class="tfa-field"><label>密码</label>'
      + '<input class="tfa-input" id="tfaRegPass" type="password" autocomplete="new-password" placeholder="至少 8 位"></div>'
      + '<div class="tfa-field"><label>确认密码</label>'
      + '<input class="tfa-input" id="tfaRegPass2" type="password" autocomplete="new-password" placeholder="再输一次"></div>'
      + '<div class="tfa-field"><label>邮箱（选填，用于找回密码）</label>'
      + '<input class="tfa-input" id="tfaRegMail" type="email" autocapitalize="off" placeholder="不填也能正常使用"></div>'
      + '<div class="tfa-field"><label>验证码</label>'
      + '<div class="tfa-cap"><input class="tfa-input" id="tfaRegCap" type="text" inputmode="numeric" maxlength="4" placeholder="4 位数字">'
      + '<canvas class="tfa-canvas" id="tfaRegCanvas" width="96" height="40" title="点一下换一张"></canvas></div>'
      + '<div class="tfa-cap-tip">看不清？点右侧图片换一张</div></div>'
      + '<div class="tfa-hint">注册即表示同意《社区规范》。账号仅支持字母、数字、下划线，昵称可注册后修改。</div>'
      + '<button class="tfa-submit" type="submit">创建账号</button>'
      + '<div class="tfa-foot"><button class="tfa-link sub" type="button" data-act="forgot">忘记密码</button>'
      + '<button class="tfa-link" type="button" data-act="to-login">已有账号？去登录</button></div>'
      + '</form>'
      + '<div class="tfa-msg" id="tfaMsg"></div>';
    mask.appendChild(card);
    document.body.appendChild(mask);

    msgEl = card.querySelector('#tfaMsg');
    formLogin = card.querySelector('#tfaLoginForm');
    formReg = card.querySelector('#tfaRegForm');
    tabLogin = card.querySelector('[data-tab="login"]');
    tabReg = card.querySelector('[data-tab="register"]');
    inputs = {
      user: card.querySelector('#tfaLoginUser'),
      pass: card.querySelector('#tfaLoginPass'),
      cap: card.querySelector('#tfaLoginCap'),
      ruser: card.querySelector('#tfaRegUser'),
      rpass: card.querySelector('#tfaRegPass'),
      rpass2: card.querySelector('#tfaRegPass2'),
      rmail: card.querySelector('#tfaRegMail'),
      rcap: card.querySelector('#tfaRegCap')
    };

    card.querySelector('.tfa-x').addEventListener('click', close);
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    tabLogin.addEventListener('click', function () { setMode('login'); });
    tabReg.addEventListener('click', function () { setMode('register'); });
    card.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'to-register') setMode('register');
      if (act === 'to-login') setMode('login');
      if (act === 'forgot') forgot();
    });
    card.querySelectorAll('.tfa-canvas').forEach(function (cv) {
      cv.addEventListener('click', function () { drawCaptcha(); msg(''); });
    });
    formLogin.addEventListener('submit', submitLogin);
    formReg.addEventListener('submit', submitRegister);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mask && mask.classList.contains('on')) close();
    });
  }

  function setMode(mode) {
    st.mode = mode === 'register' ? 'register' : 'login';
    var isReg = st.mode === 'register';
    formLogin.hidden = isReg;
    formReg.hidden = !isReg;
    tabLogin.classList.toggle('on', !isReg);
    tabReg.classList.toggle('on', isReg);
    card.querySelector('#tfaTitle').textContent = isReg ? '注册挞飞账号' : '登录挞飞';
    card.querySelector('#tfaSub').textContent = isReg
      ? '自定义账号即可，不需要邮箱验证'
      : '登录后同步收藏、浏览记录和伙伴进度';
    msg('');
    drawCaptcha();
    setTimeout(function () {
      var f = isReg ? inputs.ruser : inputs.user;
      if (f) { try { f.focus(); } catch (e) {} }
    }, 60);
  }

  function forgot() {
    msg('忘记密码：注册时填了邮箱的，把账号 + 邮箱发到 QQ 3659229103（或 Telegram @piaopiaony），'
      + '核验后帮你重置；没填邮箱的账号暂不支持自助找回。', true);
  }

  function open(mode) {
    buildUI();
    mask.classList.add('on');
    document.body.style.overflow = 'hidden';
    setMode(mode || 'login');
  }

  function close() {
    if (!mask) return;
    mask.classList.remove('on');
    document.body.style.overflow = '';
  }

  /* ---------- 网络 ---------- */
  function normalizeUser(v) {
    return String(v || '').trim().toLowerCase();
  }

  function validUser(u) {
    return /^[a-z0-9_]{3,16}$/.test(u);
  }

  function api(path, body, token) {
    var headers = { 'apikey': KEY, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(ORIGIN + '/auth/v1' + path, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = {};
        try { data = JSON.parse(txt); } catch (e) {}
        if (!r.ok) {
          var m = data.msg || data.message || data.error_description || data.error || ('请求失败（' + r.status + '）');
          var err = new Error(friendly(m));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  function friendly(m) {
    var s = String(m || '');
    if (/Invalid login credentials/i.test(s)) return '账号或密码不正确';
    if (/already registered|already been registered|User already exists/i.test(s)) return '这个账号已经被注册了，换一个或直接登录';
    if (/Password should be at least/i.test(s)) return '密码太短，至少要 8 位';
    if (/Email address .* is invalid/i.test(s)) return '账号格式不对，只能用字母、数字、下划线';
    if (/For security purposes/i.test(s)) return '操作太快了，等几秒再试';
    if (/Failed to fetch|NetworkError|Load failed/i.test(s)) return '网络不太稳定，检查一下网络再试';
    return s;
  }

  function saveSession(data) {
    if (!data || !data.access_token) return false;
    var ss = window.TafeiSession;
    if (!ss) return false;
    ss.save({
      access_token: data.access_token,
      refresh_token: data.refresh_token || '',
      expires_at: data.expires_at || (Math.floor(Date.now() / 1000) + (data.expires_in || 3600)),
      expires_in: data.expires_in || 3600,
      token_type: data.token_type || 'bearer',
      user: data.user || null
    });
    try { if (ss.broadcast) ss.broadcast(); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('tafei-auth-done', { detail: { session: data } })); } catch (e) {}
    return true;
  }

  function lock(on) {
    st.busy = on;
    card.querySelectorAll('.tfa-submit').forEach(function (b) {
      b.disabled = on;
      b.textContent = on ? '请稍候…' : (st.mode === 'register' ? '创建账号' : '登录');
    });
  }

  function submitLogin(e) {
    e.preventDefault();
    if (st.busy) return;
    var u = normalizeUser(inputs.user.value);
    var p = inputs.pass.value;
    var c = inputs.cap.value.trim();
    if (!validUser(u)) { msg('账号是 3–16 位字母、数字或下划线'); return; }
    if (!p) { msg('请输入密码'); return; }
    if (c !== st.code) { msg('验证码不对，已换一张'); drawCaptcha(); inputs.cap.value = ''; return; }

    lock(true);
    msg('正在登录…', true);
    api('/token?grant_type=password', { email: u + SUFFIX, password: p }).then(function (data) {
      if (!saveSession(data)) throw new Error('登录状态保存失败，请重试');
      lock(false);
      close();
      showToast('登录成功，欢迎回来');
    }).catch(function (err) {
      lock(false);
      msg(err.message || '登录失败，请重试');
      drawCaptcha();
      inputs.cap.value = '';
    });
  }

  function submitRegister(e) {
    e.preventDefault();
    if (st.busy) return;
    var u = normalizeUser(inputs.ruser.value);
    var p = inputs.rpass.value;
    var p2 = inputs.rpass2.value;
    var mail = String(inputs.rmail.value || '').trim();
    var c = inputs.rcap.value.trim();
    if (!validUser(u)) { msg('账号是 3–16 位字母、数字或下划线'); return; }
    if (p.length < 8) { msg('密码至少 8 位'); return; }
    if (p !== p2) { msg('两次输入的密码不一致'); return; }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { msg('邮箱格式看着不太对，也可以留空'); return; }
    if (c !== st.code) { msg('验证码不对，已换一张'); drawCaptcha(); inputs.rcap.value = ''; return; }

    lock(true);
    msg('正在创建账号…', true);
    api('/signup', {
      email: u + SUFFIX,
      password: p,
      data: { username: u, nickname: u, email_bind: mail, agreed_at: new Date().toISOString() }
    }).then(function (data) {
      if (!data || !data.access_token) {
        throw new Error('这个账号可能已被注册，试试直接登录');
      }
      if (!saveSession(data)) throw new Error('登录状态保存失败，请重试');
      if (mail) {
        fetch(ORIGIN + '/auth/v1/user', {
          method: 'PUT',
          headers: { 'apikey': KEY, 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.access_token },
          body: JSON.stringify({ data: { username: u, nickname: u, email_bind: mail } })
        }).catch(function () {});
      }
      lock(false);
      close();
      showToast('账号已创建，已帮你登录');
    }).catch(function (err) {
      lock(false);
      msg(err.message || '注册失败，请重试');
      drawCaptcha();
      inputs.rcap.value = '';
    });
  }

  window.TafeiAuth = {
    open: open,
    close: close,
    isOpen: function () { return !!(mask && mask.classList.contains('on')); },
    message: function (text) { buildUI(); open('login'); msg(text, true); }
  };
})();
