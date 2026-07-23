/* =============================================================================
 *  app.js  —  Shared utilities used across every page.
 *  Load order (in each HTML): supabase-cdn, env.js, config.js, i18n.js,
 *  supabase.js, cloudinary.js, app.js, then the page script.
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 *  Tiny DOM helpers
 * -------------------------------------------------------------------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const k of kids) node.append(k?.nodeType ? k : document.createTextNode(k ?? ''));
  return node;
};

/* ----------------------------------------------------------------------------
 *  Formatting — locale aware, always Latin digits for financial clarity
 * -------------------------------------------------------------------------- */
const numLocale = () => (I18N.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG');

const money = (n) =>
  new Intl.NumberFormat(numLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n) || 0) + ' ' + t('currency');

const fmtDateTime = (d) =>
  new Date(d).toLocaleString(I18N.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const fmtDate = (d) =>
  new Date(d).toLocaleDateString(I18N.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB',
    { day: '2-digit', month: 'short', year: 'numeric' });

const shortId = (id) => (id || '').split('-')[0].toUpperCase();

/* Human order number: prefer the sequential order_no, fall back to uuid stub. */
const orderNo = (sale) => sale?.order_no != null ? String(sale.order_no) : shortId(sale?.id);

/* ----------------------------------------------------------------------------
 *  Toasts
 * -------------------------------------------------------------------------- */
function toast(message, type = 'info', ms = 3200) {
  let host = $('#toast-host');
  if (!host) { host = el('div', { id: 'toast-host', className: 'toast-host' }); document.body.append(host); }
  const tEl = el('div', { className: `toast toast--${type}` });
  tEl.append(el('span', { className: 'toast__mark' }), el('span', { className: 'toast__msg', textContent: message }));
  host.append(tEl);
  requestAnimationFrame(() => tEl.classList.add('is-in'));
  const kill = () => { tEl.classList.remove('is-in'); setTimeout(() => tEl.remove(), 300); };
  const timer = setTimeout(kill, ms);
  tEl.addEventListener('click', () => { clearTimeout(timer); kill(); });
}

/* ----------------------------------------------------------------------------
 *  Modals (generic + confirm + admin password prompt)
 * -------------------------------------------------------------------------- */
function openModal(contentNode, { onClose } = {}) {
  const overlay = el('div', { className: 'modal-overlay' });
  const panel = el('div', { className: 'modal', role: 'dialog', 'aria-modal': 'true' });
  panel.append(contentNode);
  overlay.append(panel);
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => overlay.classList.add('is-in'));

  let closed = false;
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onEsc);
    overlay.classList.remove('is-in');
    setTimeout(() => { overlay.remove(); document.body.style.overflow = ''; onClose?.(); }, 220);
  };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onEsc);
  return { overlay, panel, close };
}

function confirmDialog(title, message, { danger = false, confirmText = null } = {}) {
  return new Promise((resolve) => {
    const body = el('div', { className: 'modal-body' });
    body.append(
      el('h3', { className: 'modal-title', textContent: title }),
      el('p', { className: 'modal-text', textContent: message }),
    );
    const actions = el('div', { className: 'modal-actions' });
    const cancel = el('button', { className: 'btn btn--ghost', textContent: t('cancel') });
    const ok = el('button', { className: `btn ${danger ? 'btn--danger' : 'btn--gold'}`, textContent: confirmText || t('confirm') });
    actions.append(cancel, ok);
    body.append(actions);
    const m = openModal(body, { onClose: () => resolve(false) });
    cancel.onclick = () => { m.close(); };
    ok.onclick = () => { resolve(true); m.close(); };
  });
}

/* Prompts for the admin password and verifies it. Resolves to the plaintext
 * password on success (needed for the DB RPCs), or null if cancelled. */
function adminPrompt(reason = null) {
  return new Promise((resolve) => {
    const body = el('div', { className: 'modal-body' });
    const form = el('form', { className: 'modal-form' });
    const input = el('input', { type: 'password', className: 'field', placeholder: t('password_placeholder'), autocomplete: 'off' });
    const errorLine = el('p', { className: 'field-error', textContent: '' });
    const actions = el('div', { className: 'modal-actions' });
    const cancel = el('button', { type: 'button', className: 'btn btn--ghost', textContent: t('cancel') });
    const ok = el('button', { type: 'submit', className: 'btn btn--gold', textContent: t('verify') });
    actions.append(cancel, ok);
    form.append(
      el('span', { className: 'modal-eyebrow', textContent: t('admin_approval') }),
      el('h3', { className: 'modal-title', textContent: t('enter_password') }),
      el('p', { className: 'modal-text', textContent: reason || '' }),
      input, errorLine, actions,
    );
    body.append(form);
    const m = openModal(body, { onClose: () => resolve(null) });
    setTimeout(() => input.focus(), 60);
    cancel.onclick = () => { resolve(null); m.close(); };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const ok2 = await Auth.verify(input.value, CONFIG.ADMIN_PASSWORD_HASH);
      if (ok2) {
        const pw = input.value;
        sessionStorage.setItem('admin_ok', '1');
        if (typeof Logs !== 'undefined') Logs.record('admin', 'login', { role: 'admin' });
        resolve(pw); m.close();
      } else {
        errorLine.textContent = t('incorrect_password');
        input.select(); input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 400);
      }
    };
  });
}

/* ----------------------------------------------------------------------------
 *  Auth + inactivity auto-logout
 * -------------------------------------------------------------------------- */
const Auth = {
  async verify(plain, hash) {
    if (!plain) return false;
    return (await hashText(plain)) === hash;
  },
  async loginSeller(plain) {
    const ok = await this.verify(plain, CONFIG.SELLER_PASSWORD_HASH);
    if (ok) { sessionStorage.setItem('seller_ok', '1'); Session.touch(); }
    return ok;
  },
  isSeller() { return sessionStorage.getItem('seller_ok') === '1'; },
  isAdminVerified() { return sessionStorage.getItem('admin_ok') === '1'; },
  logout() { sessionStorage.removeItem('seller_ok'); sessionStorage.removeItem('admin_ok'); sessionStorage.removeItem('last_active'); },
};

const Session = {
  limitMs() { return (CONFIG.AUTO_LOGOUT_MINUTES || 15) * 60 * 1000; },
  touch() { sessionStorage.setItem('last_active', String(Date.now())); },
  expired() {
    const last = Number(sessionStorage.getItem('last_active') || 0);
    return last > 0 && (Date.now() - last) > this.limitMs();
  },
  /* Call on protected pages: tracks activity, signs out after inactivity. */
  watch() {
    if (!Auth.isSeller()) return;
    this.touch();
    for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) {
      window.addEventListener(ev, () => this.touch(), { passive: true });
    }
    setInterval(() => {
      if (this.expired()) {
        Auth.logout();
        sessionStorage.setItem('timeout_msg', '1');
        location.replace('index.html');
      }
    }, 20000);
  },
};

/* Page guards. Call at the top of protected page scripts. */
function requireSeller() {
  if (Session.expired()) {
    Auth.logout();
    sessionStorage.setItem('timeout_msg', '1');
  }
  if (!Auth.isSeller()) { location.replace('index.html'); return false; }
  Session.watch();
  return true;
}

/* ----------------------------------------------------------------------------
 *  Config sanity check — warns clearly if keys are still placeholders
 * -------------------------------------------------------------------------- */
function configReady() {
  return !/YOUR-/.test(CONFIG.SUPABASE_URL + CONFIG.SUPABASE_ANON_KEY);
}
function warnIfUnconfigured() {
  if (!configReady()) {
    toast('Set your Supabase keys in js/config.js to load live data.', 'error', 6000);
    return false;
  }
  return true;
}

/* ----------------------------------------------------------------------------
 *  Language toggle + static translation stamping
 * -------------------------------------------------------------------------- */
function wireLanguageToggle() {
  $$('.lang-toggle').forEach(btn => {
    btn.textContent = t('lang_toggle');
    btn.onclick = () => I18N.toggle();
  });
}
window.addEventListener('langchange', () => {
  I18N.apply();
  wireLanguageToggle();
});

/* ----------------------------------------------------------------------------
 *  Boot: branding, translations, login page wiring
 * -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  I18N.apply();
  wireLanguageToggle();

  // stamp branding wherever these data-attributes appear
  $$('[data-brand-ar]').forEach(n => n.textContent = CONFIG.CHURCH_NAME_AR);
  $$('[data-brand-en]').forEach(n => n.textContent = CONFIG.CHURCH_NAME_EN);
  $$('[data-since]').forEach(n => n.textContent = 'منذ ' + CONFIG.SINCE);

  const form = $('#login-form');
  if (!form) return;

  if (Auth.isSeller()) { location.replace('seller.html'); return; }

  const input = $('#login-password', form);
  const errorLine = $('#login-error', form);
  const button = $('button[type="submit"]', form);

  // Explain why the user landed back here after an idle timeout.
  if (sessionStorage.getItem('timeout_msg') === '1') {
    sessionStorage.removeItem('timeout_msg');
    errorLine.textContent = t('logged_out_inactivity');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorLine.textContent = '';
    button.disabled = true; button.classList.add('is-busy');
    const ok = await Auth.loginSeller(input.value);
    button.disabled = false; button.classList.remove('is-busy');
    if (ok) {
      document.body.classList.add('is-leaving');
      setTimeout(() => location.href = 'seller.html', 380);
    } else {
      errorLine.textContent = t('wrong_password');
      input.select(); input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 420);
    }
  });
});
