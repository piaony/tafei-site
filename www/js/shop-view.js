/* TAFEI 21.3：站内直通商城 */
(function () {
  'use strict';

  const API = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1/tafei_products';
  const KEY = 'sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
  const state = { products: [], category: '全部', loaded: false, loading: false };

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return number % 1 === 0 ? String(number) : number.toFixed(2);
  }

  function orderText(product) {
    return '【挞飞商城】想了解这个项目：\n' + product.name +
      '\n分类：' + (product.category || '未分类') +
      '\n价格：¥' + money(product.price) +
      '\n我的机型/需求：';
  }

  async function inquire(product) {
    const text = orderText(product);
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      window.prompt('请手动复制这段内容发给站长', text);
      return;
    }
    window.open('https://wpa.qq.com/msgrd?v=3&uin=2026759743&site=qq&menu=yes', '_blank', 'noopener');
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

    count.textContent = list.length ? list.length + ' 个项目' : '暂无匹配';
    root.replaceChildren();

    if (!list.length) {
      root.innerHTML = '<div class="sv-empty">没有找到符合条件的项目。换个关键词，或直接联系站长说明需求。</div>';
      return;
    }

    list.forEach((product) => {
      const card = document.createElement('article');
      card.className = 'sv-card';
      card.innerHTML =
        '<div class="sv-vis">' + (product.image_url
          ? '<img src="' + esc(product.image_url) + '" alt="' + esc(product.name) + '" loading="lazy">'
          : '<span aria-hidden="true">📦</span>') + '</div>' +
        '<div class="sv-body">' +
          '<span class="sv-cat-label">' + esc(product.category || '未分类') + '</span>' +
          '<h3>' + esc(product.name) + '</h3>' +
          '<p>' + esc(product.description || '') + '</p>' +
          '<div class="sv-foot">' +
            '<span class="sv-price">¥' + esc(money(product.price)) + '<small>联系确认</small></span>' +
            '<button class="btn primary" type="button">联系站长</button>' +
          '</div>' +
        '</div>';
      card.querySelector('button').addEventListener('click', () => inquire(product));
      root.appendChild(card);
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
      renderProducts();
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
    const input = $('svSearch');
    if (input) input.addEventListener('input', renderProducts);

    const refresh = $('svRefresh');
    if (refresh) refresh.addEventListener('click', () => loadProducts(true));

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

    loadProducts(false);
  }

  window.TAFEIShop = { load: loadProducts, refresh: () => loadProducts(true) };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
