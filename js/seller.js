/* =============================================================================
 *  seller.js  —  Point-of-sale page logic.
 * ========================================================================== */
if (requireSeller()) {

  let PRODUCTS = [];
  let ACTIVE_CAT = 'all';
  let SEARCH = '';
  const cart = new Map(); // id -> { id, name, price, image_url, quantity, stock }

  const grid = $('#grid');
  const cartItemsEl = $('#cart-items');
  const cartTotalEl = $('#cart-total');
  const catFilterEl = $('#cat-filter');

  /* ---- Boot -------------------------------------------------------------- */
  init();
  async function init() {
    $('#logout-btn').onclick = () => { Auth.logout(); location.replace('index.html'); };
    wireCartSheet();
    wireSearch();
    $('#cart-clear').onclick = clearCart;
    $('#checkout-btn').onclick = checkout;

    if (!warnIfUnconfigured()) { renderEmpty('Add your Supabase keys to load products.'); return; }
    await loadProducts();
  }

  async function loadProducts() {
    try {
      grid.innerHTML = skeletons();
      PRODUCTS = await Products.list();
      renderCategories();
      renderGrid();
    } catch (err) {
      console.error(err);
      renderEmpty('Could not load products. Check your Supabase setup.');
      toast('Failed to load products.', 'error');
    }
  }

  /* ---- Categories -------------------------------------------------------- */
  function renderCategories() {
    const cats = ['all', ...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];
    catFilterEl.innerHTML = '';
    cats.forEach(cat => {
      const b = el('button', {
        className: 'chip' + (cat === ACTIVE_CAT ? ' is-active' : ''),
        textContent: cat === 'all' ? 'All' : cat,
      });
      b.onclick = () => { ACTIVE_CAT = cat; renderCategories(); renderGrid(); };
      catFilterEl.append(b);
    });
  }

  /* ---- Grid -------------------------------------------------------------- */
  function filtered() {
    const q = SEARCH.trim().toLowerCase();
    return PRODUCTS.filter(p => {
      const catOk = ACTIVE_CAT === 'all' || p.category === ACTIVE_CAT;
      const qOk = !q || (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
      return catOk && qOk;
    });
  }

  function renderGrid() {
    const list = filtered();
    if (!list.length) { renderEmpty(SEARCH ? 'No products match your search.' : 'No products yet.'); return; }
    grid.innerHTML = '';
    list.forEach((p, i) => grid.append(productCard(p, i)));
  }

  function productCard(p, i) {
    const out = (p.quantity ?? 0) <= 0;
    const low = !out && p.quantity <= 5;
    const card = el('button', { className: 'card' + (out ? ' is-out' : ''), style: `animation-delay:${Math.min(i * 22, 300)}ms` });

    const imgWrap = el('div', { className: 'card__imgwrap' });
    if (p.image_url) {
      imgWrap.append(el('img', { className: 'card__img', loading: 'lazy', alt: p.name, src: Cloudinary?.thumb ? Cloudinary.thumb(p.image_url, 320) : p.image_url }));
    } else {
      imgWrap.innerHTML = '<div class="card__noimg"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5L5 21"/></svg></div>';
    }
    const qtyBadge = el('span', {
      className: 'card__qty' + (out ? ' is-out' : low ? ' is-low' : ''),
      textContent: out ? 'Out' : `${p.quantity} left`,
    });
    imgWrap.append(qtyBadge);

    const body = el('div', { className: 'card__body' });
    body.append(
      el('div', { className: 'card__cat', textContent: p.category || '—' }),
      el('div', { className: 'card__name', textContent: p.name }),
    );
    const foot = el('div', { className: 'card__foot' });
    const price = el('div', { className: 'card__price' });
    price.innerHTML = `${Number(p.price).toFixed(2)} <small>${CONFIG.CURRENCY}</small>`;
    foot.append(price, el('div', { className: 'card__code', textContent: p.code ? `#${p.code}` : '' }));
    body.append(foot);

    card.append(imgWrap, body);
    if (!out) card.onclick = () => addToCart(p);
    return card;
  }

  function renderEmpty(msg) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h9.7a2 2 0 0 0 2-1.6L23 6H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
      <p>${msg}</p></div>`;
  }

  function skeletons() {
    return Array.from({ length: 8 }).map(() =>
      '<div class="card" style="pointer-events:none"><div class="card__imgwrap" style="background:var(--paper-2)"></div><div class="card__body"><div class="card__name" style="color:var(--line-2)">—</div></div></div>'
    ).join('');
  }

  /* ---- Search ------------------------------------------------------------ */
  function wireSearch() {
    let t;
    $('#search').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { SEARCH = e.target.value; renderGrid(); }, 120);
    });
  }

  /* ---- Cart -------------------------------------------------------------- */
  function addToCart(p) {
    const existing = cart.get(p.id);
    const inCart = existing?.quantity || 0;
    if (inCart >= p.quantity) { toast(`Only ${p.quantity} of "${p.name}" in stock.`, 'error'); return; }
    if (existing) existing.quantity += 1;
    else cart.set(p.id, { id: p.id, name: p.name, price: Number(p.price), image_url: p.image_url, quantity: 1, stock: p.quantity });
    renderCart();
  }

  function setQty(id, qty) {
    const item = cart.get(id);
    if (!item) return;
    if (qty <= 0) { cart.delete(id); }
    else if (qty > item.stock) { toast(`Only ${item.stock} in stock.`, 'error'); return; }
    else item.quantity = qty;
    renderCart();
  }

  function clearCart() {
    if (!cart.size) return;
    cart.clear();
    renderCart();
  }

  function cartTotal() {
    let t = 0; cart.forEach(i => t += i.price * i.quantity); return t;
  }
  function cartCount() {
    let n = 0; cart.forEach(i => n += i.quantity); return n;
  }

  function renderCart() {
    if (!cart.size) {
      cartItemsEl.innerHTML = '<p class="cart__empty">No items yet. Tap a product to begin.</p>';
    } else {
      cartItemsEl.innerHTML = '';
      cart.forEach(item => cartItemsEl.append(cartRow(item)));
    }
    const total = cartTotal();
    cartTotalEl.textContent = money(total);
    $('#fab-total').textContent = Number(total).toFixed(2);
    $('#fab-count').textContent = cartCount();
    $('#checkout-btn').disabled = !cart.size;
  }

  function cartRow(item) {
    const row = el('div', { className: 'citem' });
    const img = item.image_url
      ? el('img', { className: 'citem__img', src: Cloudinary.thumb(item.image_url, 100), alt: item.name })
      : el('div', { className: 'citem__img' });

    const mid = el('div');
    mid.append(
      el('div', { className: 'citem__name', textContent: item.name }),
      el('div', { className: 'citem__unit', textContent: money(item.price) + ' each' }),
    );
    const stepper = el('div', { className: 'stepper' });
    const minus = el('button', { type: 'button', textContent: '−', ariaLabel: 'Decrease' });
    const count = el('span', { textContent: item.quantity });
    const plus = el('button', { type: 'button', textContent: '+', ariaLabel: 'Increase' });
    minus.onclick = () => setQty(item.id, item.quantity - 1);
    plus.onclick = () => setQty(item.id, item.quantity + 1);
    stepper.append(minus, count, plus);
    mid.append(stepper);

    const right = el('div', { className: 'citem__right' });
    right.append(el('div', { className: 'citem__price', textContent: money(item.price * item.quantity) }));

    row.append(img, mid, right);
    return row;
  }

  /* ---- Mobile cart sheet ------------------------------------------------- */
  function wireCartSheet() {
    const cartEl = $('#cart');
    const open = () => cartEl.classList.add('is-open');
    const close = () => cartEl.classList.remove('is-open');
    $('#cart-fab').onclick = open;
    $('#cart-close').onclick = close;
  }

  /* ---- Checkout + invoice ------------------------------------------------ */
  async function checkout() {
    if (!cart.size) return;
    if (!configReady()) { toast('Supabase is not configured.', 'error'); return; }

    const btn = $('#checkout-btn');
    btn.disabled = true; btn.classList.add('is-busy');
    const items = [...cart.values()];
    try {
      const sale = await Sales.checkout(items, CONFIG.SELLER_NAME);
      showInvoice({ ...sale, items });
      toast('Sale completed.', 'success');
      cart.clear();
      renderCart();
      await loadProducts(); // refresh stock counts
      $('#cart').classList.remove('is-open');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Checkout failed.', 'error');
    } finally {
      btn.disabled = false; btn.classList.remove('is-busy');
    }
  }

  function invoiceMarkup(sale) {
    const rows = sale.items.map(i => `
      <tr>
        <td>${escapeHtml(i.name)}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${Number(i.price).toFixed(2)}</td>
        <td class="num">${(i.price * i.quantity).toFixed(2)}</td>
      </tr>`).join('');

    return `
      <div class="invoice">
        <div class="invoice__head">
          <div class="invoice__emblem">
            <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M40 78 L64 40 L88 78 M46 78 L46 150 M82 78 L82 150"/>
              <path d="M152 78 L176 40 L200 78 M158 78 L158 150 M194 78 L194 150"/>
              <path d="M96 150 L96 92 q24 -30 48 0 L144 150"/><path d="M120 62 L120 46 M113 54 L127 54" stroke-width="6"/>
              <path d="M120 108 L120 148 M106 122 L134 122" stroke-width="9"/>
              <path d="M28 160 q92 -22 92 8 q0 -30 92 -8 L212 172 q-92 -20 -92 6 q0 -26 -92 -6 Z" stroke-width="6"/>
            </svg>
          </div>
          <div class="invoice__name">${escapeHtml(CONFIG.CHURCH_NAME_AR)}</div>
          <div class="invoice__sub">Canteen Receipt</div>
        </div>
        <div class="invoice__meta">
          <span>#${shortId(sale.id)}</span>
          <span>${fmtDateTime(sale.created_at || Date.now())}</span>
        </div>
        <hr class="invoice__rule" />
        <table>
          <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Sum</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="invoice__total"><span>Total</span><span>${money(sale.total_price)}</span></div>
        <p class="invoice__thanks">Thank you · بارك الله فيكم</p>
      </div>`;
  }

  function showInvoice(sale) {
    const body = el('div', { className: 'modal-body' });
    body.innerHTML = `<span class="modal-eyebrow no-print">Receipt</span>` + invoiceMarkup(sale);
    const actions = el('div', { className: 'modal-actions no-print' });
    const closeBtn = el('button', { className: 'btn btn--ghost', textContent: 'Close' });
    const printBtn = el('button', { className: 'btn btn--gold', textContent: 'Print receipt' });
    actions.append(closeBtn, printBtn);
    body.append(actions);

    const m = openModal(body);
    closeBtn.onclick = m.close;
    printBtn.onclick = () => {
      const printArea = $('#print-area');
      printArea.innerHTML = invoiceMarkup(sale);
      printArea.hidden = false;
      window.print();
      setTimeout(() => { printArea.hidden = true; printArea.innerHTML = ''; }, 300);
    };
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
}
