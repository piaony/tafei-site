(() => {
  'use strict';

  const API = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1';
  const KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  const STORAGE_KEY = 'tafei-announcement-confirmed-version';
  const VISITOR_KEY = 'tafei-announcement-visitor-id';

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
    style.textContent = `
      #tafei-announcement-mask {
        position:fixed; inset:0; z-index:999999;
        display:flex; align-items:center; justify-content:center;
        padding:20px; background:rgba(0,0,0,.78);
        backdrop-filter:blur(8px);
      }
      #tafei-announcement-box {
        width:min(520px,100%); max-height:85vh; overflow:auto;
        padding:28px; border:1px solid #3985b8;
        border-radius:18px; background:#101d31; color:#eaf5ff;
        box-shadow:0 20px 70px rgba(0,0,0,.5);
      }
      #tafei-announcement-box h2 {
        margin:0 0 18px; color:#8bd5ff; font-size:22px;
      }
      #tafei-announcement-content {
        white-space:pre-wrap; line-height:1.8;
        overflow-wrap:anywhere; margin-bottom:24px;
      }
      #tafei-announcement-confirm {
        width:100%; padding:13px; border:0; border-radius:10px;
        background:#258bd0; color:white; font-size:16px;
        font-weight:bold; cursor:pointer;
      }
      #tafei-announcement-status {
        margin:12px 0 0; color:#ffc978; font-size:13px;
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

    const title = document.createElement('h2');
    title.id = 'tafei-announcement-title';
    title.textContent = announcement.title || '挞飞社区公告';

    const content = document.createElement('div');
    content.id = 'tafei-announcement-content';
    content.textContent = announcement.content || '';

    const button = document.createElement('button');
    button.id = 'tafei-announcement-confirm';
    button.type = 'button';
    button.textContent = '我已阅读并确认';

    const status = document.createElement('p');
    status.id = 'tafei-announcement-status';
    status.setAttribute('aria-live', 'polite');

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = '正在提交…';
      status.textContent = '';

      try {
        const response = await fetch(API + '/tafei_announcement_confirmations', {
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
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error('提交失败：' + response.status + ' ' + detail);
        }

        localStorage.setItem(STORAGE_KEY, String(announcement.version));
        mask.remove();
      } catch (error) {
        console.error('公告确认失败：', error);
        status.textContent = '确认暂时未成功，请检查网络后重试。';
        button.disabled = false;
        button.textContent = '重新提交确认';
      }
    });

    box.append(title, content, button, status);
    mask.appendChild(box);
    document.body.appendChild(mask);
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
