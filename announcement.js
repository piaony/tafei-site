(() => {
  'use strict';

  const API = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1';
  const KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  const STORAGE_KEY = 'tafei-announcement-confirmed-version';
  const VISITOR_KEY = 'tafei-announcement-visitor-id';
  const SNOOZE_KEY = 'tafei-announcement-snoozed';

  function getVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : 'visitor-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function addModal(announcement) {
    const style = document.createElement('style');
    // 优先复用设计层的令牌，取不到时用兜底色，保证任何页面都能正常显示
    style.textContent = `
      #tafei-announcement-mask {
        position: fixed; inset: 0; z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        padding: 20px; background: rgba(2, 6, 17, .78);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        animation: tafeiMaskIn .22s cubic-bezier(.22,.61,.36,1) both;
      }
      @keyframes tafeiMaskIn { from { opacity: 0 } to { opacity: 1 } }
      #tafei-announcement-box {
        position: relative;
        width: min(520px, 100%); max-height: 85vh; overflow: auto;
        padding: 26px;
        border: 1px solid var(--tf-line, rgba(130,170,255,.35));
        border-radius: var(--tf-r-lg, 20px);
        background: var(--tf-panel, #101d31);
        color: var(--tf-text, #eaf5ff);
        box-shadow: var(--tf-e3, 0 20px 70px rgba(0,0,0,.5));
        font-family: var(--tf-font, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif);
        animation: tafeiBoxIn .3s cubic-bezier(.16,1,.3,1) both;
      }
      @keyframes tafeiBoxIn {
        from { opacity: 0; transform: translateY(14px) scale(.98) }
        to   { opacity: 1; transform: none }
      }
      #tafei-announcement-box:focus { outline: none }
      #tafei-announcement-title {
        margin: 0 34px 16px 0;
        color: var(--tf-cyan, #8bd5ff);
        font-size: 20px; line-height: 1.4; letter-spacing: -.01em;
      }
      #tafei-announcement-content {
        white-space: pre-wrap; line-height: 1.85;
        overflow-wrap: anywhere; margin-bottom: 20px;
        color: var(--tf-text, #eaf5ff); font-size: 15px;
      }
      #tafei-announcement-snooze {
        position: absolute; top: 14px; right: 14px;
        width: 32px; height: 32px; display: grid; place-items: center;
        border: 1px solid var(--tf-line, rgba(130,170,255,.3));
        border-radius: 50%;
        background: transparent; color: var(--tf-muted, #9aaccb);
        font-size: 15px; line-height: 1; cursor: pointer;
        transition: color .2s, border-color .2s, background-color .2s;
      }
      #tafei-announcement-snooze:hover {
        color: var(--tf-text, #eaf5ff);
        border-color: var(--tf-line-strong, rgba(130,170,255,.5));
      }
      #tafei-announcement-confirm {
        width: 100%; min-height: 44px;
        padding: 12px 18px; border: 0;
        border-radius: var(--tf-r-sm, 12px);
        background: var(--tf-grad-action, linear-gradient(110deg, #3b8fff, #846bff));
        color: #fff; font-size: 15px; font-weight: 600;
        letter-spacing: .01em; cursor: pointer;
        box-shadow: var(--tf-glow-brand, 0 8px 24px rgba(75,121,255,.28));
        transition: transform .2s, filter .2s, opacity .2s;
      }
      #tafei-announcement-confirm:hover { filter: brightness(1.06) }
      #tafei-announcement-confirm:active { transform: scale(.98) }
      #tafei-announcement-confirm:disabled {
        opacity: .6; cursor: not-allowed; transform: none;
      }
      #tafei-announcement-confirm:focus-visible {
        outline: 2px solid var(--tf-cyan, #64e8ff);
        outline-offset: 2px;
      }
      #tafei-announcement-status {
        margin: 12px 0 0; color: #ffc978; font-size: 13px; min-height: 18px;
      }
      #tafei-announcement-note {
        margin: 6px 0 10px; color: var(--tf-muted, #9aaccb); font-size: 12px;
        line-height: 1.6;
      }
      @media (prefers-reduced-motion: reduce) {
        #tafei-announcement-mask, #tafei-announcement-box { animation: none }
      }
    `;
    document.head.appendChild(style);

    const mask = document.createElement('div');
    mask.id = 'tafei-announcement-mask';

    const box = document.createElement('section');
    box.id = 'tafei-announcement-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'tafei-announcement-title');
    box.setAttribute('aria-describedby', 'tafei-announcement-content');
    box.setAttribute('tabindex', '-1');

    const title = document.createElement('h2');
    title.id = 'tafei-announcement-title';
    title.textContent = announcement.title || '挞飞社区公告';

    const content = document.createElement('div');
    content.id = 'tafei-announcement-content';
    content.textContent = announcement.content || '';

    const snooze = document.createElement('button');
    snooze.id = 'tafei-announcement-snooze';
    snooze.type = 'button';
    snooze.setAttribute('aria-label', '稍后再看');
    snooze.title = '稍后再看（本次访问不再弹出）';
    snooze.textContent = '\u2715';

    const button = document.createElement('button');
    button.id = 'tafei-announcement-confirm';
    button.type = 'button';
    button.textContent = '我已阅读并确认';

    const status = document.createElement('p');
    status.id = 'tafei-announcement-status';
    status.setAttribute('aria-live', 'polite');

    const note = document.createElement('p');
    note.id = 'tafei-announcement-note';
    note.textContent = '点右上角 ✕ 可先关闭；下次打开还会提醒。';

    const previousOverflow = document.body.style.overflow;
    const lastFocus = document.activeElement;

    function closeModal() {
      mask.remove();
      document.removeEventListener('keydown', onKeydown);
      document.body.style.overflow = previousOverflow;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key === 'Tab') {
        // 焦点锁在弹窗内，避免键盘用户在背景里乱跳
        const focusable = [snooze, button];
        const index = focusable.indexOf(document.activeElement);
        if (index === -1) {
          event.preventDefault();
          focusable[0].focus();
        } else if (event.shiftKey && index === 0) {
          event.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && index === focusable.length - 1) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    }

    snooze.addEventListener('click', () => {
      // 只跳过本次访问，下次打开还会看到，不影响确认记录
      try {
        sessionStorage.setItem(SNOOZE_KEY, String(announcement.version));
      } catch (e) {}
      closeModal();
    });

    button.addEventListener('click', () => {
      // 本地先确认并关闭，保证公告永远不会卡住用户。
      try {
        localStorage.setItem(STORAGE_KEY, String(announcement.version));
      } catch (e) {}
      closeModal();

      // 后台确认只是留痕，失败不影响用户继续使用。
      fetch(API + '/tafei_announcement_confirmations', {
        method: 'POST',
        headers: {
          'apikey': KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          announcement_version: announcement.version,
          visitor_id: getVisitorId(),
          user_id: null
        })
      }).catch(error => console.warn('公告确认留痕失败：', error));
    });

    box.append(title, note, content, snooze, button, status);
    mask.appendChild(box);
    document.body.appendChild(mask);
    mask.addEventListener('click', function (event) {
      if (event.target !== mask) return;
      // 点遮罩即关闭公告，并把这一下点击交给下面的页面，
      // 避免用户以为“伙伴/按钮点不开”。
      var x = event.clientX;
      var y = event.clientY;
      closeModal();
      var target = null;
      try { target = document.elementFromPoint(x, y); } catch (error) {}
      if (target && target !== document.body) {
        target.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          view: window
        }));
      }
    });
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);
    // 聚焦到弹窗本身，避免一进来就出现按钮焦点环
    box.focus();
  }

  async function start() {
    try {
      const response = await fetch(
        API + '/tafei_announcements?select=title,content,version&is_active=eq.true&order=version.desc&limit=1',
        { headers: { 'apikey': KEY } }
      );

      if (!response.ok) {
        throw new Error('公告读取失败：' + response.status);
      }

      const rows = await response.json();
      if (!rows.length) return;

      const announcement = rows[0];
      const confirmedVersion = localStorage.getItem(STORAGE_KEY);

      if (String(confirmedVersion) === String(announcement.version)) return;

      let snoozed = null;
      try {
        snoozed = sessionStorage.getItem(SNOOZE_KEY);
      } catch (e) {}
      if (String(snoozed) === String(announcement.version)) return;

      addModal(announcement);
    } catch (error) {
      console.error('挞飞公告模块：', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
