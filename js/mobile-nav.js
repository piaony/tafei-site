/* TAFEI 21.4–21.6：内页共用手机底部导航（后台页不高亮首页） */
(function () {
  'use strict';
  if (document.querySelector('.mobile-bottom-nav')) return;

  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const active = file === 'service.html' ? 'service' : file === 'device.html' ? 'device' : file === 'shop.html' ? 'shop' : file === 'admin-center.html' ? 'admin' : '';

  const sprite = `
<svg class="tf-mobile-sprite" aria-hidden="true" width="0" height="0" style="position:absolute;overflow:hidden">
 <defs><linearGradient id="tfMobGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24"><stop offset="0" stop-color="#64e8ff"/><stop offset=".55" stop-color="#7297ff"/><stop offset="1" stop-color="#bd8cff"/></linearGradient></defs>
 <symbol id="mob-home" viewBox="0 0 24 24" fill="none" stroke="url(#tfMobGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></symbol>
 <symbol id="mob-community" viewBox="0 0 24 24" fill="none" stroke="url(#tfMobGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h5A2.5 2.5 0 0 1 14 6.5v3A2.5 2.5 0 0 1 11.5 12H9l-5 4v-4A2.5 2.5 0 0 1 4 9.5z"/><path d="M14 9.5h3.5A2.5 2.5 0 0 1 20 12v3.5A2.5 2.5 0 0 1 17.5 18H16v3l-3.5-3H15"/></symbol>
 <symbol id="mob-shop" viewBox="0 0 24 24" fill="none" stroke="url(#tfMobGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 8h13l1 12H4.5z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/><path d="M9 12v1.5a3 3 0 0 0 6 0V12"/></symbol>
 <symbol id="mob-service" viewBox="0 0 24 24" fill="none" stroke="url(#tfMobGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 5.3a4.2 4.2 0 0 0-5.4 5.4L4 16l4 4 5.3-5.3a4.2 4.2 0 0 0 5.4-5.4l-3 3-2.4-2.4z"/></symbol>
 <symbol id="mob-device" viewBox="0 0 24 24" fill="none" stroke="url(#tfMobGrad)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 18.5h4"/></symbol>
</svg>`;

  const nav = document.createElement('nav');
  nav.className = 'mobile-bottom-nav';
  nav.setAttribute('aria-label', '手机底部导航');
  nav.innerHTML = `
 <a href="index.html"${active === '' ? ' class="active"' : ''}><svg class="tf-ico" aria-hidden="true"><use href="#mob-home"></use></svg><span>首页</span></a>
 <a href="index.html#community"><svg class="tf-ico" aria-hidden="true"><use href="#mob-community"></use></svg><span>社区</span></a>
 <a href="index.html#shop"${active === 'shop' ? ' class="active"' : ''}><svg class="tf-ico" aria-hidden="true"><use href="#mob-shop"></use></svg><span>商城</span></a>
 <a href="service.html"${active === 'service' ? ' class="active"' : ''}><svg class="tf-ico" aria-hidden="true"><use href="#mob-service"></use></svg><span>服务</span></a>
 <a href="device.html"${active === 'device' ? ' class="active"' : ''}><svg class="tf-ico" aria-hidden="true"><use href="#mob-device"></use></svg><span>机型</span></a>`;

  document.body.insertAdjacentHTML('afterbegin', sprite);
  document.body.appendChild(nav);
})();
