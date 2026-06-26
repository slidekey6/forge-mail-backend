/**
 * Forge Mail — app.js
 * Vanilla JS frontend logic for the Dark Forge email sender.
 */

'use strict';

/* ── Constants ───────────────────────────────────────────────── */
const BACKEND_URL = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '' // Electron file:// origin
) ? 'http://localhost:3000'
  : 'https://unchanged-snipe-merchantbnk-1a9a2966.koyeb.app';
const API_URL = `${BACKEND_URL}/api/mail/send`;

// Plain email OR "Display Name <email@domain.com>"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM_RE = /^(?:[^<>]+<[^\s@]+@[^\s@]+\.[^\s@]+>|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

/* ── DOM References ──────────────────────────────────────────── */
const form = /** @type {HTMLFormElement}   */ (document.getElementById('mail-form'));
const fromInput    = /** @type {HTMLInputElement}  */ (document.getElementById('from'));
const replyToInput = /** @type {HTMLInputElement}  */ (document.getElementById('reply-to'));
const toInput      = /** @type {HTMLInputElement}  */ (document.getElementById('to'));
const subjectInput = /** @type {HTMLInputElement}  */ (document.getElementById('subject'));
const htmlInput    = /** @type {HTMLTextAreaElement}*/ (document.getElementById('html'));

const fieldFrom    = document.getElementById('field-from');
const fieldReplyTo = document.getElementById('field-reply-to');
const fieldTo      = document.getElementById('field-to');
const fieldSubject = document.getElementById('field-subject');
const fieldHtml    = document.getElementById('field-html');

const fromError    = document.getElementById('from-error');
const replyToError = document.getElementById('reply-to-error');
const toError      = document.getElementById('to-error');
const subjectError = document.getElementById('subject-error');
const htmlError    = document.getElementById('html-error');

const subjectCounter = document.getElementById('subject-counter');
const htmlCounter = document.getElementById('html-counter');

const btnPreview = document.getElementById('btn-preview');
const previewBtnTxt = document.getElementById('preview-btn-text');
const btnSend = document.getElementById('btn-send');
const sendBtnTxt = document.getElementById('send-btn-text');
const sendIcon = document.getElementById('send-icon');

const previewSection = document.getElementById('preview-section');
const previewFrameInner = document.getElementById('preview-frame-inner');
const previewIframe = /** @type {HTMLIFrameElement} */ (document.getElementById('preview-iframe'));
const vpDesktop = document.getElementById('vp-desktop');
const vpMobile = document.getElementById('vp-mobile');
const toastContainer = document.getElementById('toast-container');

// Picker DOM
const btnPickerFrom = document.getElementById('btn-picker-from');
const dropdownFrom = document.getElementById('dropdown-from');
const btnPickerTo = document.getElementById('btn-picker-to');
const dropdownTo = document.getElementById('dropdown-to');

// Removed Provider UI

/* ── State ───────────────────────────────────────────────────── */
let isPreviewing = false;
let isSending = false;
/* ── Lucide icons init ───────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

/* ═══════════════════════════════════════════════════════════════
   VALIDATION HELPERS
═══════════════════════════════════════════════════════════════ */

/**
 * Marks a field as invalid and shows the error message.
 * Triggers shake animation by re-appending class.
 * @param {HTMLElement} fieldEl
 * @param {HTMLElement} errorEl
 * @param {string} message
 */
function setError(fieldEl, errorEl, message) {
  fieldEl.classList.remove('invalid');
  // Force reflow to restart animation
  void fieldEl.offsetWidth;
  fieldEl.classList.add('invalid');
  errorEl.textContent = message;
  errorEl.classList.add('visible');
}

/**
 * Clears error state from a field.
 * @param {HTMLElement} fieldEl
 * @param {HTMLElement} errorEl
 */
function clearError(fieldEl, errorEl) {
  fieldEl.classList.remove('invalid');
  errorEl.textContent = '';
  errorEl.classList.remove('visible');
}

/**
 * Validates a single email input on blur.
 * @param {HTMLInputElement} input
 * @param {HTMLElement} fieldEl
 * @param {HTMLElement} errorEl
 * @returns {boolean}
 */
function validateEmail(input, fieldEl, errorEl) {
  const val = input.value.trim();
  if (!val) {
    setError(fieldEl, errorEl, 'This field is required.');
    return false;
  }
  if (!EMAIL_RE.test(val)) {
    setError(fieldEl, errorEl, 'Please enter a valid email address.');
    return false;
  }
  clearError(fieldEl, errorEl);
  return true;
}

/**
 * Validates the FROM field which accepts plain email OR "Name <email>" format.
 * @param {HTMLInputElement} input
 * @param {HTMLElement} fieldEl
 * @param {HTMLElement} errorEl
 * @returns {boolean}
 */
function validateFrom(input, fieldEl, errorEl) {
  const val = input.value.trim();
  if (!val) {
    setError(fieldEl, errorEl, 'This field is required.');
    return false;
  }
  if (!FROM_RE.test(val)) {
    setError(fieldEl, errorEl, 'Use a valid email or \'Name <email@domain.com>\' format.');
    return false;
  }
  clearError(fieldEl, errorEl);
  return true;
}



/** Validates the full form before submission. @returns {boolean} */
function validateForm() {
  let valid = true;

  if (!validateFrom(fromInput, fieldFrom, fromError)) valid = false;
  if (!validateEmail(toInput, fieldTo, toError)) valid = false;

  const subVal = subjectInput.value.trim();
  if (!subVal) {
    setError(fieldSubject, subjectError, 'Subject is required.');
    valid = false;
  } else if (subVal.length > 255) {
    setError(fieldSubject, subjectError, 'Subject must not exceed 255 characters.');
    valid = false;
  } else {
    clearError(fieldSubject, subjectError);
  }

  const htmlVal = htmlInput.value.trim();
  if (!htmlVal) {
    setError(fieldHtml, htmlError, 'HTML body is required.');
    valid = false;
  } else {
    clearError(fieldHtml, htmlError);
  }

  return valid;
}

/* ═══════════════════════════════════════════════════════════════
   LIVE COUNTERS
═══════════════════════════════════════════════════════════════ */

subjectInput.addEventListener('input', () => {
  const len = subjectInput.value.length;
  subjectCounter.textContent = `${len} / 255`;
  subjectCounter.classList.toggle('warn', len > 240);
  if (len > 0) clearError(fieldSubject, subjectError);
});

htmlInput.addEventListener('input', () => {
  const bytes = new TextEncoder().encode(htmlInput.value).length;
  htmlCounter.textContent = bytes >= 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${bytes} bytes`;
  if (htmlInput.value.trim().length > 0) clearError(fieldHtml, htmlError);
});

/* ── Blur validation for email fields ───────────────────────── */
fromInput.addEventListener('blur', () => {
  validateFrom(fromInput, fieldFrom, fromError);
  // Auto-fill Reply-To from From if the user left it blank
  if (replyToInput && !replyToInput.value.trim()) {
    replyToInput.value = fromInput.value.trim();
  }
});
toInput.addEventListener('blur', () => validateEmail(toInput, fieldTo, toError));
fromInput.addEventListener('input', () => { if (fieldFrom.classList.contains('invalid')) validateFrom(fromInput, fieldFrom, fromError); });
toInput.addEventListener('input', () => { if (fieldTo.classList.contains('invalid')) validateEmail(toInput, fieldTo, toError); });

// Reply-To: validate format only when it has a value
replyToInput.addEventListener('blur', () => {
  const val = replyToInput.value.trim();
  if (val && !FROM_RE.test(val)) {
    setError(fieldReplyTo, replyToError, 'Use a valid email or \'Name <email@domain.com>\' format.');
  } else {
    clearError(fieldReplyTo, replyToError);
  }
});
replyToInput.addEventListener('input', () => {
  if (fieldReplyTo.classList.contains('invalid')) {
    const val = replyToInput.value.trim();
    if (!val || FROM_RE.test(val)) clearError(fieldReplyTo, replyToError);
  }
});

subjectInput.addEventListener('blur', () => {
  const v = subjectInput.value.trim();
  if (!v) setError(fieldSubject, subjectError, 'Subject is required.');
  else if (v.length > 255) setError(fieldSubject, subjectError, 'Subject must not exceed 255 characters.');
  else clearError(fieldSubject, subjectError);
});

/* ═══════════════════════════════════════════════════════════════
   PREVIEW
═══════════════════════════════════════════════════════════════ */

btnPreview.addEventListener('click', () => {
  const htmlContent = htmlInput.value;
  isPreviewing = !isPreviewing;

  if (isPreviewing) {
    // Inject content into iframe via srcdoc
    previewIframe.srcdoc = htmlContent || '<p style="font-family:sans-serif;color:#888;padding:20px;">Nothing to preview yet. Add HTML above.</p>';

    previewSection.classList.add('open');
    previewSection.setAttribute('aria-hidden', 'false');
    btnPreview.setAttribute('aria-expanded', 'true');

    // Update icon + label
    previewBtnTxt.textContent = 'Refresh Preview';
    replaceIcon(btnPreview, 'refresh-cw');

    // Smooth scroll to preview
    setTimeout(() => {
      previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } else {
    // Refresh: keep open, just re-render
    isPreviewing = true;
    previewIframe.srcdoc = htmlContent || '<p style="font-family:sans-serif;color:#888;padding:20px;">Nothing to preview yet.</p>';
    previewBtnTxt.textContent = 'Refresh Preview';
  }

  // If already open and clicking again = refresh
  if (previewSection.classList.contains('open') && !previewSection.classList.contains('open')) {
    previewSection.classList.add('open');
  }
});

/* Viewport toggle */
vpDesktop.addEventListener('click', () => setViewport('desktop'));
vpMobile.addEventListener('click', () => setViewport('mobile'));

/**
 * @param {'desktop'|'mobile'} mode
 */
function setViewport(mode) {
  if (mode === 'mobile') {
    previewFrameInner.classList.add('mobile');
    vpMobile.classList.add('active');
    vpDesktop.classList.remove('active');
    vpMobile.setAttribute('aria-pressed', 'true');
    vpDesktop.setAttribute('aria-pressed', 'false');
  } else {
    previewFrameInner.classList.remove('mobile');
    vpDesktop.classList.add('active');
    vpMobile.classList.remove('active');
    vpDesktop.setAttribute('aria-pressed', 'true');
    vpMobile.setAttribute('aria-pressed', 'false');
  }
}

/* ═══════════════════════════════════════════════════════════════
   SEND EMAIL
═══════════════════════════════════════════════════════════════ */

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isSending) return;
  if (!validateForm()) return;

  const replyToVal = replyToInput.value.trim();
  const payload = {
    from: fromInput.value.trim(),
    ...(replyToVal ? { replyTo: replyToVal } : {}),
    to: toInput.value.trim(),
    subject: subjectInput.value.trim(),
    html: htmlInput.value,
  };

  setSendState('loading');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.success === true) {
      setSendState('success');
      showToast('success', '✅ Email Sent', `Message ID: ${data.messageId}`);
      saveRecentAddresses(payload.from, payload.to);
      // Reset after 3s
      setTimeout(() => setSendState('default'), 3000);
    } else {
      const errMsg = data.error ?? 'Unknown error from server.';
      setSendState('error');
      showToast('error', '❌ Send Failed', errMsg);
      setTimeout(() => setSendState('default'), 3000);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error — is the backend running?';
    setSendState('error');
    showToast('error', '❌ Network Error', message);
    setTimeout(() => setSendState('default'), 3000);
  }
});

/* ═══════════════════════════════════════════════════════════════
   SEND BUTTON STATE MACHINE
═══════════════════════════════════════════════════════════════ */

/**
 * @param {'default'|'loading'|'success'|'error'} state
 */
function setSendState(state) {
  btnSend.classList.remove('state-loading', 'state-success', 'state-error');

  switch (state) {
    case 'loading':
      isSending = true;
      btnSend.disabled = true;
      btnSend.classList.add('state-loading');
      sendBtnTxt.textContent = 'Sending…';
      // Replace icon with spinner
      sendIcon.replaceWith(createSpinner());
      break;

    case 'success':
      isSending = false;
      btnSend.disabled = false;
      btnSend.classList.add('state-success');
      sendBtnTxt.textContent = '✅ Sent!';
      restoreIcon('check-circle');
      break;

    case 'error':
      isSending = false;
      btnSend.disabled = false;
      btnSend.classList.add('state-error');
      sendBtnTxt.textContent = '❌ Failed — Retry';
      restoreIcon('alert-circle');
      break;

    default:
      isSending = false;
      btnSend.disabled = false;
      sendBtnTxt.textContent = 'Send Email';
      restoreIcon('send');
      break;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ICON HELPERS
═══════════════════════════════════════════════════════════════ */

function createSpinner() {
  const div = document.createElement('div');
  div.className = 'spinner';
  div.id = 'send-icon';
  div.setAttribute('aria-hidden', 'true');
  return div;
}

/**
 * Restore Lucide icon inside send button.
 * @param {string} iconName
 */
function restoreIcon(iconName) {
  const existing = document.getElementById('send-icon');
  if (!existing) return;

  const el = document.createElement('i');
  el.id = 'send-icon';
  el.setAttribute('data-lucide', iconName);
  el.setAttribute('aria-hidden', 'true');
  existing.replaceWith(el);

  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [el] });
}

/**
 * Replace the first Lucide icon inside a parent element.
 * @param {HTMLElement} parent
 * @param {string} iconName
 */
function replaceIcon(parent, iconName) {
  const svg = parent.querySelector('svg');
  if (!svg) return;
  const el = document.createElement('i');
  el.setAttribute('data-lucide', iconName);
  el.setAttribute('aria-hidden', 'true');
  svg.replaceWith(el);
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [el] });
}

/* ═══════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
═══════════════════════════════════════════════════════════════ */

let toastId = 0;

/**
 * @param {'success'|'error'} type
 * @param {string} title
 * @param {string} body
 */
function showToast(type, title, body) {
  const id = ++toastId;
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-atomic', 'true');
  toast.dataset.id = String(id);

  toast.innerHTML = `
    <div class="toast-header">
      <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
      <span class="toast-title">${escapeHtml(title)}</span>
    </div>
    <div class="toast-body">${escapeHtml(body)}</div>
    <div class="toast-time">${now}</div>
  `;

  toastContainer.appendChild(toast);

  // Auto-dismiss after 5 seconds
  setTimeout(() => dismissToast(toast), 5000);
}

/**
 * Animate out and remove a toast element.
 * @param {HTMLElement} toast
 */
function dismissToast(toast) {
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

/**
 * Basic HTML escaping for toast content.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ═══════════════════════════════════════════════════════════════
   INBOX LOGIC
═══════════════════════════════════════════════════════════════ */

const tabCompose = document.getElementById('tab-compose');
const tabInbox = document.getElementById('tab-inbox');
const tabSent = document.getElementById('tab-sent');
const viewCompose = document.getElementById('view-compose');
const viewInbox = document.getElementById('view-inbox');
const viewSent = document.getElementById('view-sent');
const btnRefreshInbox = document.getElementById('btn-refresh-inbox');
const inboxList = document.getElementById('inbox-list');
const inboxEmptyState = document.getElementById('inbox-empty-state');
const inboxContent = document.getElementById('inbox-content');
const inboxIframe = document.getElementById('inbox-iframe');
const inboxTextPre = document.getElementById('inbox-text-pre');
const btnViewHtml = document.getElementById('btn-view-html');
const btnViewText = document.getElementById('btn-view-text');

let inboundEmails = [];
let selectedEmailId = null;
let eventSource = null;

// Tab Switching
tabCompose.addEventListener('click', () => switchTab('compose'));
tabInbox.addEventListener('click', () => switchTab('inbox'));
tabSent.addEventListener('click', () => switchTab('sent'));

function switchTab(tab) {
  // Update Tabs
  [tabCompose, tabInbox, tabSent].forEach(el => el.classList.remove('active', 'aria-selected'));
  if (tab === 'compose') tabCompose.classList.add('active');
  if (tab === 'inbox') tabInbox.classList.add('active');
  if (tab === 'sent') tabSent.classList.add('active');
  
  [tabCompose, tabInbox, tabSent].forEach(el => el.setAttribute('aria-selected', el.classList.contains('active')));

  // Update Views
  [viewCompose, viewInbox, viewSent].forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });

  if (tab === 'compose') {
    viewCompose.style.display = 'block';
    viewCompose.classList.add('active');
  } else if (tab === 'inbox') {
    viewInbox.style.display = 'flex';
    viewInbox.classList.add('active');
    if (inboundEmails.length === 0) fetchInbox();
  } else if (tab === 'sent') {
    viewSent.style.display = 'flex';
    viewSent.classList.add('active');
    if (sentEmails.length === 0) fetchSent();
  }
}

// Fetch Emails
async function fetchInbox() {
  btnRefreshInbox.classList.add('state-loading');
  replaceIcon(btnRefreshInbox, 'loader');
  try {
    const res = await fetch(`${BACKEND_URL}/api/mail/inbound`);
    const data = await res.json();
    if (data.success) {
      inboundEmails = data.emails || [];
      renderInboxList();
    }
  } catch (err) {
    showToast('error', '❌ Error', 'Failed to fetch inbox.');
  } finally {
    btnRefreshInbox.classList.remove('state-loading');
    replaceIcon(btnRefreshInbox, 'refresh-cw');
  }
}

btnRefreshInbox.addEventListener('click', fetchInbox);

// Render List
function renderInboxList() {
  inboxList.innerHTML = '';
  if (inboundEmails.length === 0) {
    inboxList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No emails received yet.</div>';
    return;
  }

  inboundEmails.forEach(email => {
    const el = document.createElement('div');
    el.className = `inbox-item ${email.id === selectedEmailId ? 'active' : ''}`;
    el.innerHTML = `
      <div class="inbox-item-subject">${escapeHtml(email.subject) || '(No Subject)'}</div>
      <div class="inbox-item-from">${escapeHtml(email.from)}</div>
      <div class="inbox-item-date">${new Date(email.receivedAt).toLocaleString()}</div>
    `;
    el.addEventListener('click', () => selectEmail(email.id));
    inboxList.appendChild(el);
  });
}

function selectEmail(id) {
  selectedEmailId = id;
  const email = inboundEmails.find(e => e.id === id);
  if (!email) return;

  // Update active state in list
  Array.from(inboxList.children).forEach(child => child.classList.remove('active'));
  const activeIndex = inboundEmails.findIndex(e => e.id === id);
  if (inboxList.children[activeIndex]) {
    inboxList.children[activeIndex].classList.add('active');
  }

  // Populate Details
  document.getElementById('inbox-detail-from').textContent = email.from;
  document.getElementById('inbox-detail-to').textContent = email.to.join ? email.to.join(', ') : email.to;
  document.getElementById('inbox-detail-subject').textContent = email.subject || '(No Subject)';
  document.getElementById('inbox-detail-date').textContent = new Date(email.receivedAt).toLocaleString();

  inboxIframe.srcdoc = email.html || '<p style="font-family:sans-serif;color:#888;">No HTML body provided.</p>';
  inboxTextPre.textContent = email.text || 'No text body provided.';

  inboxEmptyState.style.display = 'none';
  inboxContent.style.display = 'flex';
}

// Body View Switcher
btnViewHtml.addEventListener('click', () => {
  btnViewHtml.classList.add('active');
  btnViewText.classList.remove('active');
  inboxIframe.style.display = 'block';
  inboxTextPre.style.display = 'none';
});

btnViewText.addEventListener('click', () => {
  btnViewText.classList.add('active');
  btnViewHtml.classList.remove('active');
  inboxTextPre.style.display = 'block';
  inboxIframe.style.display = 'none';
});

// SSE Connection for Real-time updates
function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`${BACKEND_URL}/api/mail/inbound/stream`);
  eventSource.onmessage = (event) => {
    try {
      const email = JSON.parse(event.data);
      // Prepend to array
      inboundEmails.unshift(email);
      // Keep to 100 max
      if (inboundEmails.length > 100) inboundEmails = inboundEmails.slice(0, 100);
      renderInboxList();
      showToast('success', '📬 New Email Received', email.subject || '(No Subject)');
    } catch (e) {
      console.error('SSE Error parsing data', e);
    }
  };
  eventSource.onerror = () => {
    console.error('SSE Connection lost. Reconnecting...');
    eventSource.close();
    setTimeout(connectSSE, 5000);
  };
}

// Init SSE
window.addEventListener('DOMContentLoaded', connectSSE);

/* ═══════════════════════════════════════════════════════════════
   RECENT ADDRESSES PICKER
═══════════════════════════════════════════════════════════════ */

function getRecentAddresses(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveRecentAddresses(fromStr, toStr) {
  const saveKey = (key, val) => {
    if (!val) return;
    let list = getRecentAddresses(key);
    list = list.filter((item) => item !== val); // remove duplicate
    list.unshift(val); // add to front
    if (list.length > 5) list = list.slice(0, 5); // keep max 5
    localStorage.setItem(key, JSON.stringify(list));
  };
  saveKey('recentFroms', fromStr);
  saveKey('recentTos', toStr);
}

function renderDropdown(dropdown, key, inputEl, btnEl) {
  const items = getRecentAddresses(key);
  dropdown.innerHTML = '';
  if (items.length === 0) {
    dropdown.innerHTML = '<div class="picker-empty">No recent addresses</div>';
    return;
  }
  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-item';
    btn.textContent = item;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent input blur
      inputEl.value = item;
      dropdown.classList.remove('show');
      btnEl.setAttribute('aria-expanded', 'false');
      btnEl.closest('.field').style.zIndex = '';
      // trigger input event to clear errors if valid
      inputEl.dispatchEvent(new Event('input'));
      inputEl.dispatchEvent(new Event('blur'));
    });
    dropdown.appendChild(btn);
  });
}

function toggleDropdown(btn, dropdown, key, inputEl) {
  const isExpanded = btn.getAttribute('aria-expanded') === 'true';
  
  // Close all other dropdowns first
  document.querySelectorAll('.picker-dropdown.show').forEach(el => {
    if (el !== dropdown) {
      el.classList.remove('show');
      const relatedBtn = document.querySelector(`[aria-controls="${el.id}"]`) || el.previousElementSibling;
      if (relatedBtn) {
        relatedBtn.setAttribute('aria-expanded', 'false');
        relatedBtn.closest('.field').style.zIndex = '';
      }
    }
  });

  if (isExpanded) {
    dropdown.classList.remove('show');
    btn.setAttribute('aria-expanded', 'false');
    btn.closest('.field').style.zIndex = '';
  } else {
    renderDropdown(dropdown, key, inputEl, btn);
    dropdown.classList.add('show');
    btn.setAttribute('aria-expanded', 'true');
    btn.closest('.field').style.zIndex = '10';
  }
}

if (btnPickerFrom && dropdownFrom) {
  btnPickerFrom.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(btnPickerFrom, dropdownFrom, 'recentFroms', fromInput);
  });
}

if (btnPickerTo && dropdownTo) {
  btnPickerTo.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(btnPickerTo, dropdownTo, 'recentTos', toInput);
  });
}

// Click outside to close dropdowns
document.addEventListener('click', (e) => {
  if (!e.target.closest('.with-picker')) {
    document.querySelectorAll('.picker-dropdown.show').forEach((dropdown) => {
      dropdown.classList.remove('show');
      const btn = dropdown.previousElementSibling;
      if (btn && btn.classList.contains('btn-picker')) {
        btn.setAttribute('aria-expanded', 'false');
        btn.closest('.field').style.zIndex = '';
      }
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   SENT LOGIC
═══════════════════════════════════════════════════════════════ */

const btnRefreshSent = document.getElementById('btn-refresh-sent');
const sentList = document.getElementById('sent-list');
const sentEmptyState = document.getElementById('sent-empty-state');
const sentContent = document.getElementById('sent-content');
const sentIframe = document.getElementById('sent-iframe');
const sentTextPre = document.getElementById('sent-text-pre');
const btnSentHtml = document.getElementById('btn-sent-html');
const btnSentText = document.getElementById('btn-sent-text');

let sentEmails = [];
let selectedSentId = null;

async function fetchSent() {
  btnRefreshSent.classList.add('state-loading');
  replaceIcon(btnRefreshSent, 'loader');

  try {
    const res = await fetch(`${BACKEND_URL}/api/mail/sent`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.emails)) {
      sentEmails = data.emails;
      renderSentList();
      
      if (selectedSentId && !sentEmails.find(e => e.id === selectedSentId)) {
        selectedSentId = null;
        sentEmptyState.style.display = 'flex';
        sentContent.style.display = 'none';
      } else if (selectedSentId) {
        selectSent(selectedSentId);
      }
    }
  } catch (e) {
    console.error('Failed to fetch sent emails', e);
    showToast('error', 'Error', 'Failed to fetch sent emails.');
  } finally {
    btnRefreshSent.classList.remove('state-loading');
    replaceIcon(btnRefreshSent, 'refresh-cw');
  }
}


if (btnRefreshSent) {
  btnRefreshSent.addEventListener('click', fetchSent);
}

function renderSentList() {
  sentList.innerHTML = '';
  if (sentEmails.length === 0) {
    sentList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No emails sent yet.</div>';
    return;
  }

  sentEmails.forEach(email => {
    const el = document.createElement('div');
    el.className = `inbox-item ${email.id === selectedSentId ? 'active' : ''}`;
    el.innerHTML = `
      <div class="inbox-item-subject">${escapeHtml(email.subject) || '(No Subject)'}</div>
      <div class="inbox-item-from">To: ${escapeHtml(Array.isArray(email.to) ? email.to.join(', ') : email.to)}</div>
      <div class="inbox-item-date">${new Date(email.sentAt).toLocaleString()}</div>
    `;
    el.addEventListener('click', () => selectSent(email.id));
    sentList.appendChild(el);
  });
}

function selectSent(id) {
  selectedSentId = id;
  const email = sentEmails.find(e => e.id === id);
  if (!email) return;

  // Update active state in list
  Array.from(sentList.children).forEach(child => child.classList.remove('active'));
  const activeIndex = sentEmails.findIndex(e => e.id === id);
  if (sentList.children[activeIndex]) {
    sentList.children[activeIndex].classList.add('active');
  }

  // Populate Details
  document.getElementById('sent-detail-from').textContent = email.from;
  document.getElementById('sent-detail-to').textContent = Array.isArray(email.to) ? email.to.join(', ') : email.to;
  document.getElementById('sent-detail-subject').textContent = email.subject || '(No Subject)';
  document.getElementById('sent-detail-date').textContent = new Date(email.sentAt).toLocaleString();

  sentIframe.srcdoc = email.html || '<p style="font-family:sans-serif;color:#888;">No HTML body provided.</p>';
  sentTextPre.textContent = email.text || 'No text body provided.';

  sentEmptyState.style.display = 'none';
  sentContent.style.display = 'flex';

  // Ensure HTML view is active
  btnSentHtml.classList.add('active');
  btnSentText.classList.remove('active');
  sentIframe.style.display = 'block';
  sentTextPre.style.display = 'none';
}

if (btnSentHtml && btnSentText) {
  btnSentHtml.addEventListener('click', () => {
    btnSentHtml.classList.add('active');
    btnSentText.classList.remove('active');
    sentIframe.style.display = 'block';
    sentTextPre.style.display = 'none';
  });

  btnSentText.addEventListener('click', () => {
    btnSentText.classList.add('active');
    btnSentHtml.classList.remove('active');
    sentTextPre.style.display = 'block';
    sentIframe.style.display = 'none';
  });
}
