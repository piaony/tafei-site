/* TAFEI 商城：4 列网格 + 加号加入清单 + 底部合并打包联系站长 */
(function () {
  'use strict';

  const API = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1/tafei_products';
  const KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  const CART_KEY = 'tafei-shop-cart';
  const state = { products: [], category: '全部', loaded: false, loading: false, cart: {} };

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return number % 1 === 0 ? String(number) : number.toFixed(2);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', 'readonly');
      area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(area);
      area.select();
      area.setSelectionRange(0, area.value.length);
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (e) { return false; }
  }

  function productById(id) {
    for (let i = 0; i < state.products.length; i++) if (String(state.products[i].id) === String(id)) return state.products[i];
    return null;
  }

  /* ---------- 清单 ---------- */
  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
      state.cart = raw && typeof raw === 'object' ? raw : {};
    } catch (e) { state.cart = {}; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (e) {}
  }
  function cartRows() {
    return Object.keys(state.cart).map((id) => {
      const p = productById(id);
      const qty = Number(state.cart[id]) || 0;
      return p && qty > 0 ? { product: p, qty } : null;
    }).filter(Boolean);
  }
  function cartTotals() {
    const rows = cartRows();
    let count = 0, sum = 0;
    rows.forEach((r) => { count += r.qty; sum += (Number(r.product.price) || 0) * r.qty; });
    return { rows, count, sum };
  }

  function cartText() {
    const { rows, count, sum } = cartTotals();
    if (!rows.length) return '【挞飞商城】我想咨询，还没选具体项目。\n我的机型/需求：';
    const lines = rows.map((r, i) => (i + 1) + '. ' + r.product.name + ' × ' + r.qty + '　¥' + money(r.product.price * r.qty));
    return '【挞飞商城 · 合并打包】\n共 ' + count + ' 件，合计 ¥' + money(sum) + '\n' + lines.join('\n') + '\n我的机型/需求：';
  }

  function addToCart(id, qty) {
    const n = Number(qty) || 1;
    state.cart[id] = (Number(state.cart[id]) || 0) + n;
    saveCart();
    renderCart();
    const p = productById(id);
    toast(p ? ('已加入：' + p.name) : '已加入清单');
  }

  function setQty(id, qty) {
    if (qty <= 0) delete state.cart[id]; else state.cart[id] = qty;
    saveCart();
    renderCart();
  }

  function clearCart() {
    state.cart = {};
    saveCart();
    renderCart();
    toast('清单已清空');
  }

  function renderProducts() {
    const root = $('svProducts');
    const count = $('svCount');
    const input = $('svSearch');
    if (!root || !count) return;

    const keyword = (input ? input.value : '').trim().toLowerCase();
    const list = state.products.filter((item) => {
      const categoryMatch = state.category === '全部' || item.category === state.category;
      const text = (item.name + ' ' + (item.description || '') + ' ' + (item.category || '')).toLowerCase();
      return categoryMatch && text.includes(keyword);
    });

    count.textContent = list.length ? list.length + ' 个项目 · 点卡片看详情，加号加入清单' : '暂无匹配';
    root.replaceChildren();

    if (!list.length) {
      root.innerHTML = '<div class="sv-empty">没有找到符合条件的项目。换个关键词，或在底部把需求发给站长。</div>';
      return;
    }

    list.forEach((product) => {
      const qty = Number(state.cart[product.id]) || 0;
      const card = document.createElement('article');
      card.className = 'sv-card';
      card.innerHTML =
        '<button class="sv-vis" type="button" aria-label="查看 ' + esc(product.name) + ' 详情">' +
          (product.image_url
            ? '<img src="' + esc(product.image_url) + '" alt="' + esc(product.name) + '" loading="lazy">'
            : '<span aria-hidden="true">📦</span>') +
        '</button>' +
        '<div class="sv-body">' +
          '<h3 class="sv-name">' + esc(product.name) + '</h3>' +
          '<div class="sv-row">' +
            '<span class="sv-price">¥' + esc(money(product.price)) + '</span>' +
            '<button class="sv-plus" type="button" aria-label="加入清单">＋</button>' +
          '</div>' +
          (qty ? '<span class="sv-qty">已选 ' + qty + '</span>' : '') +
        '</div>';

      card.querySelector('.sv-vis').addEventListener('click', () => openDetail(product));
      card.querySelector('.sv-name').addEventListener('click', () => openDetail(product));
      card.querySelector('.sv-plus').addEventListener('click', (e) => {
        e.stopPropagation();
        addToCart(String(product.id), 1);
      });
      root.appendChild(card);
    });
  }

  /* ---------- 汇总栏 ---------- */
  function renderCart() {
    const { rows, count, sum } = cartTotals();
    const bar = $('svCartBar');
    const c = $('svCartCount');
    const s = $('svCartSum');
    if (bar) bar.hidden = count === 0;
    if (c) c.textContent = count + ' 件';
    if (s) s.textContent = '¥' + money(sum);

    const panel = $('svCartList');
    const tip = $('svCartTip');
    const wrap = $('svCartPanel');
    if (wrap) wrap.hidden = count === 0;
    if (tip) tip.innerHTML = count ? ('共 ' + count + ' 件 · 合计 <b>¥' + money(sum) + '</b>') : '';
    if (panel) {
      panel.innerHTML = rows.map((r) => '<li class="sv-cart-item"><span>' + esc(r.product.name) +
        '</span><em>× ' + r.qty + '</em><strong>¥' + money((Number(r.product.price) || 0) * r.qty) + '</strong>' +
        '<button class="sv-cart-del" type="button" data-del="' + esc(r.product.id) + '" aria-label="移除">✕</button></li>').join('');
      Array.prototype.forEach.call(panel.querySelectorAll('[data-del]'), (b) => {
        b.addEventListener('click', () => setQty(b.getAttribute('data-del'), 0));
      });
    }
    renderProducts();
  }

  /* ---------- 详情弹层 ---------- */
  function openDetail(product) {
    const modal = $('svModal');
    if (!modal) return;
    const box = modal.querySelector('.sv-modal-img');
    if (box) {
      const hasImage = !!product.image_url;
      box.hidden = !hasImage;
      box.innerHTML = hasImage ? '<img src="' + esc(product.image_url) + '" alt="' + esc(product.name) + '">' : '';
    }
    const cat = modal.querySelector('.sv-modal-cat');
    if (cat) cat.textContent = product.category || '未分类';
    const title = modal.querySelector('.sv-modal-title');
    if (title) title.textContent = product.name;
    const desc = modal.querySelector('.sv-modal-desc');
    if (desc) desc.textContent = product.description || '这个项目可以按你的机型和需求来配，具体做法在底部联系站长确认。';
    const price = modal.querySelector('.sv-modal-price');
    if (price) price.textContent = '¥' + money(product.price);
    modal.hidden = false;
    modal.setAttribute('data-pid', String(product.id));
    const add = modal.querySelector('.sv-modal-add');
    if (add) {
      add.onclick = () => {
        addToCart(String(product.id), 1);
        closeDetail();
      };
    }
    const minus = modal.querySelector('.sv-modal-minus');
    if (minus) {
      minus.onclick = () => {
        const qty = Number(state.cart[String(product.id)]) || 0;
        setQty(String(product.id), qty - 1);
        closeDetail();
      };
    }
  }

  function closeDetail() {
    const modal = $('svModal');
    if (modal) modal.hidden = true;
  }

  /* ---------- 轻提示 ---------- */
  let toastTimer = 0;
  function toast(text) {
    const el = $('svToast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 1800);
  }

  function renderCategories() {
    const box = $('svCats');
    if (!box) return;
    const categories = ['全部', ...new Set(state.products.map((item) => item.category).filter(Boolean))];
    if (state.category !== '全部' && categories.indexOf(state.category) === -1) state.category = '全部';
    box.replaceChildren();
    categories.forEach((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sv-cat' + (name === state.category ? ' active' : '');
      button.textContent = name;
      button.addEventListener('click', () => {
        state.category = name;
        renderCategories();
        renderProducts();
      });
      box.appendChild(button);
    });
  }

  async function loadProducts(force) {
    if (state.loading) return;
    if (state.loaded && !force) return;
    state.loading = true;
    const root = $('svProducts');
    const count = $('svCount');
    if (root) root.innerHTML = '<div class="sv-empty">正在加载商城项目…</div>';
    if (count) count.textContent = '加载中…';

    try {
      const response = await fetch(
        API + '?select=id,name,category,price,description,image_url&is_active=eq.true&order=created_at.desc',
        { headers: { apikey: KEY } }
      );
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const rows = await response.json();
      state.products = Array.isArray(rows) ? rows : [];
      state.loaded = true;
      renderCategories();
      renderCart();
    } catch (error) {
      console.warn('商城加载失败：', error);
      if (root) {
        root.innerHTML = '<div class="sv-empty">商品暂时加载失败。<button class="btn" type="button" id="svRetry">重新加载</button></div>';
        const retry = $('svRetry');
        if (retry) retry.addEventListener('click', () => loadProducts(true));
      }
      if (count) count.textContent = '加载失败';
    } finally {
      state.loading = false;
    }
  }

  function bind() {
    loadCart();

    const input = $('svSearch');
    if (input) input.addEventListener('input', renderProducts);

    const refresh = $('svRefresh');
    if (refresh) refresh.addEventListener('click', () => loadProducts(true));

    const go = $('svCartGo');
    if (go) go.addEventListener('click', () => {
      const contact = document.querySelector('.sv-contact');
      if (contact) contact.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => toast('清单已在下方的联系站长区'), 400);
    });

    document.querySelectorAll('[data-cart-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        const text = cartText();
        const ok = await copyText(text);
        toast(ok ? '清单已复制，粘给站长就行' : '复制失败，请长按下方清单手动复制');
      });
    });
    document.querySelectorAll('[data-cart-clear]').forEach((button) => {
      button.addEventListener('click', clearCart);
    });

    const modal = $('svModal');
    if (modal) {
      const close = modal.querySelector('.sv-modal-x');
      if (close) close.addEventListener('click', closeDetail);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeDetail(); });
    }

    document.querySelectorAll('[data-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        const text = button.dataset.copy || '';
        try {
          await navigator.clipboard.writeText(text);
          const old = button.textContent;
          button.textContent = '已复制';
          setTimeout(() => { button.textContent = old; }, 1400);
        } catch (error) {
          window.prompt('请手动复制', text);
        }
      });
    });

    const panel = $('svCartPanel');
    const bar = $('svCartBar');
    if (panel && bar) {
      const syncBar = () => {
        if (panel.hidden) { bar.classList.remove('sv-cartbar-dock'); return; }
        const rect = panel.getBoundingClientRect();
        const seen = rect.top < window.innerHeight - 60 && rect.bottom > 80;
        bar.classList.toggle('sv-cartbar-dock', seen);
      };
      window.addEventListener('scroll', syncBar, true);
      document.addEventListener('scroll', syncBar, true);
      setInterval(syncBar, 800);
      syncBar();
    }

    renderCart();
    loadProducts(false);
  }

  window.TAFEIShop = {
    load: loadProducts,
    refresh: () => loadProducts(true),
    cart: () => cartTotals(),
    text: cartText
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
