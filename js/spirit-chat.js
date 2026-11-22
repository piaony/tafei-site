/* TAFEI SPIRIT CHAT
   聊天页双人精灵舞台：读取双方当前伙伴和状态，按 怒气 > 困意/饥饿 > 心情 触发彩蛋。
   没有云端档案时，可在本地用 ?spirit-demo=fight|sleep|hungry|play|comfort 预览。 */
(function () {
  'use strict';
  var core = window.TafeiSpirits;
  if (!core) return;

  var REST = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1';
  var KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  var AUTH_KEY = 'tafei-auth-session';
  var stage = null;
  var stagePeer = '';
  var loading = false;
  var peerCache = {};
  var demoMode = new URLSearchParams(location.search).get('spirit-demo') || '';
  var endedFightUntil = 0;
  var fightPenaltyShown = false;

  function session() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; }
  }
  function token() { var s = session(); return s && s.access_token ? s.access_token : ''; }
  function statusDefaults() { return { satiety: 65, mood: 65, anger: 10, sleepiness: 30 }; }
  function normalizeStatus(input) {
    var base = statusDefaults();
    if (!input || typeof input !== 'object') return base;
    ['satiety', 'mood', 'anger', 'sleepiness'].forEach(function (key) {
      var value = Number(input[key]);
      if (Number.isFinite(value)) base[key] = Math.max(0, Math.min(100, value));
    });
    return base;
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nameOf(data) {
    var spirit = core.spiritById(data.spirit);
    return spirit ? spirit.name : '伙伴';
  }
  function skinOf(data) {
    var skin = core.skinById(data.skin);
    if (skin) return skin;
    var spirit = core.spiritById(data.spirit);
    return spirit ? core.skinById(spirit.defaultSkin) || core.SKINS[0] : core.SKINS[0];
  }
  function myData() {
    return {
      spirit: core.state().selected,
      skin: core.state().selectedSkin,
      status: core.state().status,
      name: '你'
    };
  }
  function demoPeer(mode) {
    var map = {
      fight: { anger: 90, mood: 38, satiety: 55, sleepiness: 42 },
      sleep: { anger: 12, mood: 48, satiety: 52, sleepiness: 92 },
      hungry: { anger: 10, mood: 40, satiety: 9, sleepiness: 68 },
      play: { anger: 8, mood: 92, satiety: 60, sleepiness: 26 },
      comfort: { anger: 18, mood: 82, satiety: 62, sleepiness: 32 }
    };
    return {
      spirit: 'tanluning',
      skin: mode === 'fight' ? 'tanluning-bridal' : 'tanluning-daily',
      status: normalizeStatus(map[mode] || map.play),
      name: '昙露凝'
    };
  }
  function fetchPeer(peerId) {
    if (!peerId) return Promise.resolve(null);
    if (peerCache[peerId]) return Promise.resolve(peerCache[peerId]);
    if (demoMode) return Promise.resolve(demoPeer(demoMode));
    var access = token();
    if (!access) return Promise.resolve(null);
    return fetch(REST + '/tafei_spirit_public?select=user_id,selected_spirit,selected_skin,status&user_id=eq.' + encodeURIComponent(peerId) + '&limit=1', {
      headers: { apikey: KEY, Authorization: 'Bearer ' + access }
    }).then(function (response) {
      if (!response.ok) throw new Error('peer ' + response.status);
      return response.json();
    }).then(function (rows) {
      if (!Array.isArray(rows) || !rows.length) return null;
      var row = rows[0];
      var data = {
        spirit: row.selected_spirit || 'xiaota',
        skin: row.selected_skin || 'xiaota-default',
        status: normalizeStatus(row.status),
        name: ''
      };
      if (!core.spiritById(data.spirit)) data.spirit = 'xiaota';
      if (!core.skinById(data.skin)) {
        var spirit = core.spiritById(data.spirit);
        data.skin = spirit ? spirit.defaultSkin : 'xiaota-default';
      }
      peerCache[peerId] = data;
      return data;
    }).catch(function () { return null; });
  }

  function relationOf(mine, peer) {
    if (!peer) return { key: 'empty', title: '对方还没选择伙伴', note: '等对方也在精灵小屋选一个，就能触发双人彩蛋。', action: false };
    var a = normalizeStatus(mine.status);
    var b = normalizeStatus(peer.status);
    if (a.anger >= 75 && b.anger >= 75) {
      return { key: 'fight', title: '两个都炸毛了', note: '亲密度 -2 · 拖动任意一只可以拉开', action: true };
    }
    if ((a.satiety <= 25 && b.satiety <= 25) || (a.sleepiness >= 75 && b.sleepiness >= 75)) {
      return {
        key: 'sleep',
        title: a.satiety <= 25 && b.satiety <= 25 ? '都饿得没力气了' : '都困了，靠在一起',
        note: a.satiety <= 25 && b.satiety <= 25 ? '先靠在一起休息，等一份食物。' : '自动进入睡眠，醒了会恢复一点困意。',
        action: false
      };
    }
    if (a.mood >= 75 && b.mood >= 75) {
      return { key: 'play', title: '玩到一块去了', note: '心情都不错，正在分享同一颗星星。', action: false };
    }
    if (a.anger >= 75 || b.anger >= 75) {
      return { key: 'comfort', title: '一个在生气，一个在哄', note: '先让气氛缓一缓。', action: false };
    }
    if (a.mood <= 32 || b.mood <= 32) {
      return { key: 'comfort', title: '安静地靠一会儿', note: '谁都没有说话，但都在旁边。', action: false };
    }
    return { key: 'idle', title: '两只都在发呆', note: '没有触发彩蛋，先安静待着。', action: false };
  }

  function statusLine(s) {
    return '怒 ' + Math.round(s.anger) + ' · 困 ' + Math.round(s.sleepiness) + ' · 饿 ' + Math.round(100 - s.satiety);
  }

  function sideHtml(side, data) {
    if (!data) {
      return '<div class="sp-chat-side peer"><div class="sp-chat-figure" aria-label="对方还没有伙伴"></div><b>对方</b><small>还没有伙伴</small></div>';
    }
    var skin = skinOf(data);
    var s = normalizeStatus(data.status);
    return '<div class="sp-chat-side ' + side + '"><span class="sp-chat-badge">' + (side === 'me' ? '你' : '对方') + '</span>'
      + '<div class="sp-chat-figure" data-side="' + side + '" role="img" aria-label="' + esc(nameOf(data)) + '">'
      + '<img src="' + esc(skin.img) + '" alt="' + esc(nameOf(data)) + ' · ' + esc(skin.name) + '">'
      + '<span class="sp-chat-emote" aria-hidden="true"></span></div>'
      + '<b>' + (side === 'me' ? '你 · ' : '对方 · ') + esc(nameOf(data)) + '</b>'
      + '<small>' + esc(statusLine(s)) + '</small></div>';
  }

  function renderStage() {
    if (!stage) return;
    var mine = myData();
    if (!core.current() && !demoMode) {
      stage.className = 'tf3-spirit-stage is-empty';
      stage.innerHTML = '<div class="sp-chat-head"><span>SPIRIT PLAY DATE</span><em>双人彩蛋</em></div>'
        + '<div class="sp-chat-empty">还没有当前伙伴。先去精灵小屋免费领取小挞飞，再回来和对方碰面。</div>';
      return;
    }
    var peer = stage.dataset.preview === '1' ? demoPeer(demoMode || stage.dataset.previewMode || 'play') : stagePeerData;
    var relation = endedFightUntil > Date.now()
      ? { key: 'idle', title: '被拉开了', note: '架没打起来，两只都冷静了一点。', action: false }
      : relationOf(mine, peer);
    var sig = [core.state().selected, core.state().selectedSkin, JSON.stringify(mine.status), peer ? [peer.spirit, peer.skin, JSON.stringify(peer.status)].join('') : 'none', relation.key, stage.dataset.peer || '', demoMode].join('|');
    if (stage.dataset.sig === sig) return;
    stage.dataset.sig = sig;
    if (relation.key === 'fight' && !fightPenaltyShown) {
      var guardKey = 'tafei-spirit-fight:' + (stage.dataset.peer || 'demo');
      var last = Number(sessionStorage.getItem(guardKey) || 0);
      if (Date.now() - last > 10 * 60 * 1000) {
        core.adjustBond(core.state().selected, -(core.config().rules.fightBondPenalty || 2));
        sessionStorage.setItem(guardKey, String(Date.now()));
        relation.note = '亲密度 -2 · 拖动任意一只可以拉开';
        fightPenaltyShown = true;
      } else {
        relation.note = '还在闹别扭 · 拖动任意一只可以拉开';
      }
    }
    stage.classList.remove('is-fight', 'is-sleep', 'is-play', 'is-comfort', 'is-hungry', 'is-empty', 'is-idle');
    stage.classList.add('is-' + relation.key);
    if (!peer) stage.classList.add('is-empty');
    stage.innerHTML = '<div class="sp-chat-head"><span>SPIRIT PLAY DATE</span><em>双人彩蛋</em></div>'
      + '<div class="sp-chat-stage">'
      + sideHtml('me', mine)
      + '<div class="sp-chat-verdict"><b>' + esc(relation.title) + '</b><small>' + esc(relation.note) + '</small>'
      + (relation.action ? '<button type="button" data-spirit-apart="1">拉开他们</button>' : '')
      + '</div>'
      + sideHtml('peer', peer)
      + '</div>';
    bindDrag();
    var apart = stage.querySelector('[data-spirit-apart]');
    if (apart) apart.addEventListener('click', endFight);
  }

  var stagePeerData = null;
  var syncTimer = 0;

  function sync() {
    var next = document.getElementById('tf3SpiritStage');
    var preview = document.getElementById('spiritChatPreview');
    var target = next || preview;
    if (!target) return;
    if (target === stage && stage.dataset.renderedPeer === target.dataset.peer) return;
    stage = target;
    stagePeerData = null;
    if (stage.dataset.preview === '1') {
      stagePeer = 'preview';
      renderStage();
      return;
    }
    stagePeer = stage.dataset.peer || '';
    if (!stagePeer) {
      stage.dataset.renderedPeer = '';
      renderStage();
      return;
    }
    loading = true;
    stage.dataset.renderedPeer = stagePeer;
    stage.innerHTML = '<div class="sp-chat-head"><span>SPIRIT PLAY DATE</span><em>正在读取双方伙伴…</em></div>';
    fetchPeer(stagePeer).then(function (peer) {
      if (stage !== target) return;
      stagePeerData = peer;
      stage.dataset.sig = '';
      renderStage();
    });
  }

  function endFight() {
    var mine = myData();
    if (!mine.spirit) return;
    core.updateStatus(mine.spirit, { anger: Math.max(0, Math.min(60, mine.status.anger - 18)) });
    endedFightUntil = Date.now() + 5 * 60 * 1000;
    fightPenaltyShown = false;
    if (stage) stage.dataset.sig = '';
    renderStage();
  }

  function bindDrag() {
    var stageBox = stage.querySelector('.sp-chat-stage');
    if (!stageBox) return;
    Array.prototype.forEach.call(stage.querySelectorAll('.sp-chat-figure[data-side]'), function (figure) {
      var startX = 0;
      var startY = 0;
      var dx = 0;
      var active = false;
      figure.addEventListener('pointerdown', function (event) {
        if (event.button != null && event.button !== 0) return;
        active = true;
        startX = event.clientX;
        startY = event.clientY;
        dx = 0;
        figure.classList.add('dragging');
        figure.style.transform = '';
        try { figure.setPointerCapture(event.pointerId); } catch (e) {}
      });
      figure.addEventListener('pointermove', function (event) {
        if (!active) return;
        dx = event.clientX - startX;
        var max = Math.max(42, figure.getBoundingClientRect().width * 0.9);
        dx = Math.max(-max, Math.min(max, dx));
        figure.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 18) + 'deg)';
      });
      function done(event) {
        if (!active) return;
        active = false;
        figure.classList.remove('dragging');
        try { figure.releasePointerCapture(event.pointerId); } catch (e) {}
        var fight = stage.classList.contains('is-fight');
        if (fight && Math.abs(dx) > 42) {
          figure.style.transform = '';
          endFight();
          return;
        }
        figure.style.transform = '';
        if (Math.abs(dx) > 8) {
          var verdict = stage.querySelector('.sp-chat-verdict b');
          if (verdict) verdict.textContent = fight ? '再拉开一点就分开了' : '别拽我，我自己会走。';
          setTimeout(function () { if (stage) { stage.dataset.sig = ''; renderStage(); } }, 2200);
        }
      }
      figure.addEventListener('pointerup', done);
      figure.addEventListener('pointercancel', done);
    });
    // 点击空白舞台不做事；拖动结束后由 pointerup 处理。
  }

  core.subscribe(function () {
    if (!stage) return;
    stage.dataset.sig = '';
    renderStage();
  });

  var observer = new MutationObserver(function () {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 40);
  });

  function init() {
    var inbox = document.getElementById('tf3Inbox');
    if (inbox) observer.observe(inbox, { childList: true, subtree: true });
    var preview = document.getElementById('spiritChatPreview');
    if (preview) observer.observe(preview.parentNode, { childList: true, subtree: true });
    sync();
    window.addEventListener('hashchange', sync);
    document.addEventListener('click', function (event) {
      if (event.target.closest('[data-role="open-thread"]')) {
        setTimeout(function () { stage = null; stagePeer = ''; sync(); }, 80);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.TafeiSpiritChat = { render: sync, demo: demoPeer };
})();
