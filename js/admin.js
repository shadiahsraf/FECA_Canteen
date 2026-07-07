/* =============================================================================
 *  admin.js  —  Admin dashboard: analytics, product management, sales history.
 * ========================================================================== */
if (requireSeller()) {

  let PRODUCTS = [];
  let SALES = [];
  let chartDaily = null, chartTop = null;

  $('#logout-btn').onclick = () => { Auth.logout(); location.replace('index.html'); };

  /* ---- Admin gate -------------------------------------------------------- */
  if (Auth.isAdminVerified()) {
    revealDashboard();
  } else {
    $('#gate').hidden = false;
    $('#gate-btn').onclick = openGate;
    openGate();
  }

  async function openGate() {
    const pw = await adminPrompt('Enter the admin password to open the dashboard.');
    if (pw) { $('#gate').hidden = true; revealDashboard(); }
    else { location.replace('seller.html'); }
  }

  async function revealDashboard() {
    $('#dashboard').hidden = false;
    if (!warnIfUnconfigured()) return;
    await refresh();
  }

  async function refresh() {
    try {
      [PRODUCTS, SALES] = await Promise.all([Products.list(), Sales.listWithItems(300)]);
      renderKPIs();
      renderDailyChart();
      await renderTopChart();
      renderProductsTable();
      renderSalesTable();
    } catch (err) {
      console.error(err);
      toast('Failed to load dashboard data.', 'error');
    }
  }

  /* ---- KPIs -------------------------------------------------------------- */
  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

  function renderKPIs() {
    const today = startOfToday().getTime();
    const todaySales = SALES.filter(s => new Date(s.created_at).getTime() >= today);
    const todayRevenue = todaySales.reduce((s, x) => s + Number(x.total_price), 0);
    const totalRevenue = SALES.reduce((s, x) => s + Number(x.total_price), 0);
    const lowStock = PRODUCTS.filter(p => (p.quantity ?? 0) <= 5).length;

    const kpis = [
      { label: "Today's revenue", value: money(todayRevenue) },
      { label: "Today's orders", value: todaySales.length },
      { label: 'Total revenue', value: money(totalRevenue) },
      { label: 'Products low on stock', value: lowStock },
    ];
    $('#kpis').innerHTML = kpis.map(k => `
      <div class="kpi"><div class="kpi__label">${k.label}</div>
      <div class="kpi__value">${k.value}</div></div>`).join('');
  }

  /* ---- Charts ------------------------------------------------------------ */
  const INK = '#141310', GOLD = '#b0894c', GOLD2 = '#c9a45c', LINE = '#e6e1d5', STONE = '#8b887e';
  const chartFont = { family: 'Manrope' };

  function renderDailyChart() {
    const days = 14;
    const labels = [], data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const sum = SALES
        .filter(s => { const t = new Date(s.created_at).getTime(); return t >= d.getTime() && t < next.getTime(); })
        .reduce((a, s) => a + Number(s.total_price), 0);
      labels.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
      data.push(Number(sum.toFixed(2)));
    }
    chartDaily?.destroy();
    const ctx = $('#chart-daily').getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 260);
    grad.addColorStop(0, 'rgba(176,137,76,.28)');
    grad.addColorStop(1, 'rgba(176,137,76,0)');
    chartDaily = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{
        data, fill: true, backgroundColor: grad, borderColor: GOLD, borderWidth: 2,
        tension: .35, pointRadius: 3, pointBackgroundColor: INK, pointHoverRadius: 5,
      }] },
      options: baseChartOpts({ money: true }),
    });
  }

  async function renderTopChart() {
    let top = [];
    try { top = await Sales.topProducts(6); } catch (_) { top = []; }
    chartTop?.destroy();
    const ctx = $('#chart-top').getContext('2d');
    chartTop = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.map(t => t.name),
        datasets: [{ data: top.map(t => t.qty), backgroundColor: INK, hoverBackgroundColor: GOLD,
          borderRadius: 6, maxBarThickness: 26 }],
      },
      options: { ...baseChartOpts({}), indexAxis: 'y' },
    });
  }

  function baseChartOpts({ money: isMoney }) {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: INK, padding: 10, titleFont: chartFont, bodyFont: chartFont,
          callbacks: isMoney ? { label: (c) => ' ' + money(c.parsed.y ?? c.parsed) } : {},
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: STONE, font: chartFont, maxRotation: 0 } },
        y: { grid: { color: LINE }, border: { display: false }, ticks: { color: STONE, font: chartFont } },
      },
    };
  }

  /* ---- Products table ---------------------------------------------------- */
  function renderProductsTable() {
    const tbody = $('#products-table tbody');
    if (!PRODUCTS.length) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--stone);padding:24px">No products yet.</td></tr>`; return; }
    tbody.innerHTML = '';
    PRODUCTS.forEach(p => {
      const low = (p.quantity ?? 0) <= 5;
      const tr = el('tr');
      tr.innerHTML = `
        <td>${p.image_url ? `<img class="thumb" src="${Cloudinary.thumb(p.image_url, 80)}" alt="">` : `<div class="thumb"></div>`}</td>
        <td style="font-weight:600">${esc(p.name)}</td>
        <td style="font-variant-numeric:tabular-nums">${esc(p.code || '—')}</td>
        <td><span class="badge badge--cat">${esc(p.category || '—')}</span></td>
        <td class="num"><span class="pill-gold">${Number(p.price).toFixed(2)}</span></td>
        <td class="num"><span class="badge ${low ? 'badge--low' : 'badge--ok'}">${p.quantity ?? 0}</span></td>`;
      const actions = el('td', { className: 'num' });
      const wrap = el('div', { className: 'row-actions' });
      const edit = el('button', { className: 'btn btn--ghost btn--sm', textContent: 'Edit' });
      const del = el('button', { className: 'btn btn--danger btn--sm', textContent: 'Delete' });
      edit.onclick = () => openProductForm(p);
      del.onclick = () => removeProduct(p);
      wrap.append(edit, del); actions.append(wrap); tr.append(actions);
      tbody.append(tr);
    });
  }

  async function removeProduct(p) {
    const ok = await confirmDialog('Delete product', `Remove "${p.name}" permanently? This cannot be undone.`, { danger: true, confirmText: 'Delete' });
    if (!ok) return;
    try { await Products.remove(p.id); toast('Product deleted.', 'success'); await refresh(); }
    catch (err) { console.error(err); toast('Delete failed.', 'error'); }
  }

  /* ---- Product form (add / edit) ---------------------------------------- */
  function openProductForm(product = null) {
    const isEdit = !!product;
    let uploadedUrl = product?.image_url || '';
    let priceUnlocked = !isEdit;        // new products: price editable; edits: locked
    let adminPw = null;

    const body = el('div', { className: 'modal-body' });
    body.innerHTML = `
      <span class="modal-eyebrow">${isEdit ? 'Edit product' : 'New product'}</span>
      <h3 class="modal-title">${isEdit ? esc(product.name) : 'Add to the canteen'}</h3>`;

    const form = el('form', { className: 'pform' });
    form.innerHTML = `
      <div>
        <label class="lbl">Product name</label>
        <input class="field" name="name" required value="${isEdit ? esc(product.name) : ''}" />
      </div>
      <div class="pform__row">
        <div><label class="lbl">Category</label>
          <input class="field" name="category" list="catlist" value="${isEdit ? esc(product.category || '') : ''}" /></div>
        <div><label class="lbl">Code</label>
          <input class="field" name="code" value="${isEdit ? esc(product.code || '') : ''}" /></div>
      </div>
      <datalist id="catlist">${[...new Set(PRODUCTS.map(p => p.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="pform__row">
        <div><label class="lbl">Stock quantity</label>
          <input class="field" name="quantity" type="number" min="0" step="1" value="${isEdit ? (product.quantity ?? 0) : 0}" /></div>
        <div>
          <label class="lbl">Price (${CONFIG.CURRENCY})</label>
          <input class="field" name="price" type="number" min="0" step="0.01" value="${isEdit ? Number(product.price).toFixed(2) : ''}" ${priceUnlocked ? '' : 'disabled'} />
          ${isEdit ? `<button type="button" class="price-lock" id="unlock-price" style="margin-top:6px;background:none;border:0">🔒 Unlock with admin password</button>` : ''}
        </div>
      </div>
      <div>
        <label class="lbl">Product image</label>
        <div class="pform__drop" id="drop">
          <img class="pform__preview" id="preview" ${uploadedUrl ? `src="${Cloudinary.thumb(uploadedUrl, 200)}"` : 'hidden'} alt="" />
          <div id="drop-text">Tap to upload an image → Cloudinary</div>
          <div class="pform__progress" id="prog" hidden><i id="prog-bar"></i></div>
          <input type="file" accept="image/*" id="file" style="position:absolute;inset:0;opacity:0;cursor:pointer" />
        </div>
      </div>`;

    const actions = el('div', { className: 'modal-actions' });
    const cancel = el('button', { type: 'button', className: 'btn btn--ghost', textContent: 'Cancel' });
    const save = el('button', { type: 'submit', className: 'btn btn--gold', textContent: isEdit ? 'Save changes' : 'Add product' });
    actions.append(cancel, save);
    form.append(actions);
    body.append(form);

    const m = openModal(body);
    cancel.onclick = m.close;

    // image upload
    const fileInput = $('#file', form);
    const preview = $('#preview', form);
    const dropText = $('#drop-text', form);
    const prog = $('#prog', form);
    const progBar = $('#prog-bar', form);
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (!configReady()) { toast('Configure Cloudinary in js/config.js first.', 'error'); return; }
      prog.hidden = false; progBar.style.width = '0%'; save.disabled = true;
      try {
        uploadedUrl = await Cloudinary.upload(file, (pct) => { progBar.style.width = pct + '%'; });
        preview.src = Cloudinary.thumb(uploadedUrl, 200); preview.hidden = false;
        dropText.textContent = 'Image uploaded — tap to replace';
        toast('Image uploaded.', 'success');
      } catch (err) { console.error(err); toast(err.message || 'Upload failed.', 'error'); }
      finally { prog.hidden = true; save.disabled = false; }
    };

    // price unlock (edit mode)
    const unlockBtn = $('#unlock-price', form);
    const priceInput = form.price;
    if (unlockBtn) unlockBtn.onclick = async () => {
      const pw = await adminPrompt('Changing a price requires the admin password.');
      if (pw) { adminPw = pw; priceUnlocked = true; priceInput.disabled = false; priceInput.focus();
        unlockBtn.innerHTML = '🔓 Price unlocked'; unlockBtn.style.color = 'var(--ok)'; }
    };

    // submit
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = fd.get('name').trim();
      if (!name) { toast('Product name is required.', 'error'); return; }
      const payload = {
        name,
        category: fd.get('category').trim() || null,
        code: fd.get('code').trim() || null,
        quantity: parseInt(fd.get('quantity'), 10) || 0,
        image_url: uploadedUrl || null,
      };
      const newPrice = parseFloat(fd.get('price'));
      save.disabled = true; save.classList.add('is-busy');
      try {
        if (!isEdit) {
          payload.price = isNaN(newPrice) ? 0 : newPrice;
          await Products.create(payload);
          toast('Product added.', 'success');
        } else {
          await Products.update(product.id, payload);
          const priceChanged = !isNaN(newPrice) && Number(newPrice) !== Number(product.price);
          if (priceChanged) {
            if (!adminPw) { toast('Unlock the price with the admin password to change it.', 'error'); save.disabled = false; save.classList.remove('is-busy'); return; }
            await Products.updatePrice(product.id, newPrice, adminPw);
          }
          toast('Changes saved.', 'success');
        }
        m.close();
        await refresh();
      } catch (err) {
        console.error(err); toast(err.message || 'Save failed.', 'error');
      } finally { save.disabled = false; save.classList.remove('is-busy'); }
    };
  }

  /* ---- Sales history ----------------------------------------------------- */
  function renderSalesTable() {
    const tbody = $('#sales-table tbody');
    if (!SALES.length) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--stone);padding:24px">No sales recorded yet.</td></tr>`; return; }
    tbody.innerHTML = '';
    SALES.forEach(s => {
      const items = (s.sale_items || []);
      const itemCount = items.reduce((a, i) => a + i.quantity, 0);
      const names = items.map(i => `${i.products?.name || '—'} ×${i.quantity}`).join(', ');
      const tr = el('tr');
      tr.innerHTML = `
        <td style="font-weight:700">#${shortId(s.id)}</td>
        <td>${fmtDateTime(s.created_at)}</td>
        <td style="max-width:320px;color:var(--ink-soft)">${esc(names || `${itemCount} item(s)`)}</td>
        <td>${esc(s.seller_name || '—')}</td>
        <td class="num"><span class="pill-gold">${money(s.total_price)}</span></td>`;
      tbody.append(tr);
    });
  }

  /* ---- utils ------------------------------------------------------------- */
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  $('#add-product-btn').onclick = () => openProductForm();
}
