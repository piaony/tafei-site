/* TAFEI 21.2：社区消息枢纽 / 个人中心抽屉 / 发布加号 */
(function () {
  'use strict';

  var hub = document.getElementById('communityHub');
  if (!hub) return;

  var profileWrap = document.getElementById('communityProfileWrap');
  var profileToggle = document.getElementById('communityProfileToggle');
  var profileClose = document.getElementById('communityProfileClose');
  var avatarBtn = document.getElementById('communityAvatarBtn');
  var avatarInput = document.getElementById('tafeiAvatarInput');

  function showCommunity() {
    if (window.TAFEIViews) {
      window.TAFEIViews.showPage('community');
    }
  }

  function setProfile(open) {
    if (!profileWrap || !profileToggle) return;
    profileWrap.hidden = !open;
    profileToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    profileToggle.textContent = open ? '收起个人中心' : '个人中心';
    if (open) {
      showCommunity();
      setTimeout(function () {
        profileWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }

  if (profileToggle) {
    profileToggle.addEventListener('click', function () {
      setProfile(profileWrap.hidden);
    });
  }

  if (profileClose) {
    profileClose.addEventListener('click', function () { setProfile(false); });
  }

  if (avatarBtn) {
    avatarBtn.addEventListener('click', function () {
      var loggedIn = document.getElementById('tafeiAuthLoggedIn');
      if (!loggedIn || loggedIn.hidden) {
        setProfile(true);
        return;
      }
      if (avatarInput) avatarInput.click();
    });
  }

  document.querySelectorAll('[data-community-pane]').forEach(function (card) {
    card.addEventListener('click', function () {
      var pane = card.getAttribute('data-community-pane') || 'system';
      showCommunity();
      setTimeout(function () {
        if (window.TAFEI && window.TAFEI.inbox && window.TAFEI.inbox.openPane) {
          window.TAFEI.inbox.openPane(pane);
        }
      }, 40);
    });
  });

  var compose = document.getElementById('helpCompose');
  var fab = document.getElementById('helpFab');
  var closeBtn = document.getElementById('helpComposeClose');
  var firstField = document.getElementById('helpDevice');

  function setCompose(open) {
    if (!compose || !fab) return;
    compose.hidden = !open;
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('help-compose-open', open);
    if (open) {
      showCommunity();
      setTimeout(function () {
        var field = document.getElementById('helpDevice');
        if (field) field.focus();
      }, 60);
    }
  }

  if (fab) fab.addEventListener('click', function () { setCompose(true); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setCompose(false); });
  if (compose) {
    compose.querySelectorAll('[data-help-close]').forEach(function (mask) {
      mask.addEventListener('click', function () { setCompose(false); });
    });
    compose.addEventListener('click', function (event) {
      if (event.target === compose) setCompose(false);
    });
  }
  document.addEventListener('tafei:help-posted', function () { setCompose(false); });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && compose && !compose.hidden) setCompose(false);
  });

  if (location.hash === '#profile') {
    showCommunity();
    setProfile(true);
  } else if (location.hash === '#info') {
    showCommunity();
    setTimeout(function () {
      if (window.TAFEI && window.TAFEI.inbox && window.TAFEI.inbox.openPane) {
        window.TAFEI.inbox.openPane('system');
      }
    }, 80);
  }
})();
