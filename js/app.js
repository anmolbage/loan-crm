/* ============================================================
   Loan CRM — UI
   ============================================================ */
(function () {
'use strict';

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ---------------------------------------------- helpers */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function inr(n) {
  n = Number(n) || 0;
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 2) + ' Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(n % 100000 === 0 ? 0 : 2) + ' L';
  return '₹' + n.toLocaleString('en-IN');
}
const inrFull = n => '₹' + (Number(n) || 0).toLocaleString('en-IN');

const todayStr = () => todayISO();
function daysFrom(dateStr) {
  if (!dateStr) return null;
  const a = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  const b = new Date(todayStr() + 'T00:00:00');
  if (isNaN(a)) return null;
  return Math.round((a - b) / 86400000);
}
const ageDays = l => { const n = daysFrom(l.stageSince || l.createdAt); return n === null ? 0 : -n; };
function prettyDate(d) {
  if (!d) return '—';
  const n = daysFrom(d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  const dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
  if (isNaN(dt)) return d;
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: sameYear ? undefined : '2-digit' });
}
function longDate(d) {
  const dt = d ? new Date(String(d).slice(0, 10) + 'T00:00:00') : new Date();
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
function prettyTime(iso) {
  const dt = new Date(iso);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' +
         dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function gColor(group) {
  if (CFG.GROUP_COLORS[group]) return CFG.GROUP_COLORS[group];
  const i = (Store.settings.groups || []).indexOf(group);
  return CFG.FALLBACK_COLORS[(i < 0 ? 0 : i) % CFG.FALLBACK_COLORS.length];
}
const lColor = l => gColor(l.group || Store.groupOf(l.product));
const phaseCls = l => 'b-' + (Store.phaseOf(l) || 'branch');
// Short stage label for badges on cards (full name shows everywhere else)
function shortStage(name) {
  const d = Store.stageDef(name);
  if (d && d.short) return d.short;
  return String(name || '').replace('Documents Pending', 'Docs').replace('Application Generated', 'App Generated').replace('Processing at RO', 'At RO');
}
const PHASE_COLOR = { branch: '#1d4ed8', ro: '#6d28d9', sanctioned: '#d97706', done: '#0b7a42', lost: '#b91c1c' };
const PHASE_LABEL = { branch: 'With branch', ro: 'At RO', sanctioned: 'Sanctioned', done: 'Disbursed', lost: 'Closed' };

function agePill(l) {
  if (Store.isClosed(l)) return '';
  const n = ageDays(l);
  const cls = n >= CFG.STUCK_DAYS ? ' stuck' : n >= Math.ceil(CFG.STUCK_DAYS / 2) ? ' warn' : '';
  return `<span class="age${cls}">${ICON.clock}${n}d in stage</span>`;
}

const ICON = {
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4L9.5 7.9c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3A2.9 2.9 0 0 0 7 10a5.1 5.1 0 0 0 1 2.6 11.5 11.5 0 0 0 4.5 4 5.1 5.1 0 0 0 3.1.6 2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>',
  sms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.3 9.3 0 0 1-3.8-.8L3 21l1.9-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-9 5-9-5V8l9-5 9 5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
  flow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M9 6h4a3 3 0 0 1 3 3v6"/></svg>',
  sheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 8-8 3 3-3 3-2-2-2 2"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 10h-1.3A7 7 0 1 0 5 16"/><path d="M12 12v9M8 17l4 4 4-4"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 11v10h14V11"/><path d="M10 21v-6h4v6"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>'
};

/* ---------------------------------------------- toast */
let toastT;
function toast(msg, kind) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast on' + (kind ? ' ' + kind : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.className = 'toast', 2600);
}

/* ---------------------------------------------- bottom sheet */
let sheetLocked = false;
function openSheet(html, locked) {
  sheetLocked = !!locked;
  $('#sheetBody').innerHTML = html;
  $('#sheet').scrollTop = 0;
  $('#sheetBg').classList.add('on');
  $('#sheet').classList.add('on');
}
function closeSheet() {
  sheetLocked = false;
  $('#sheetBg').classList.remove('on');
  $('#sheet').classList.remove('on');
}
$('#sheetBg').addEventListener('click', () => { if (!sheetLocked) closeSheet(); });

/* ============================================================
   LOGIN
   ============================================================ */
let pin = '';
function renderPinpad() {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  $('#pinPad').innerHTML = keys.map(k =>
    k === '' ? '<span></span>' : `<button data-k="${k}">${k}</button>`).join('');
  $('#pinPad').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    if (k === '⌫') pin = pin.slice(0, -1);
    else if (pin.length < 6) pin += k;
    drawDots();
    if (navigator.vibrate) navigator.vibrate(8);
  };
  drawDots();
}
function drawDots() {
  $('#pinDots').innerHTML = Array.from({ length: 6 },
    (_, i) => `<span class="pindot${i < pin.length ? ' on' : ''}"></span>`).join('');
}

async function doLogin() {
  const u = $('#loginUser').value.trim();
  const btn = $('#loginBtn');
  $('#loginMsg').textContent = '';
  if (!u) { $('#loginMsg').textContent = 'Enter your username.'; return; }
  if (pin.length < 4) { $('#loginMsg').textContent = 'Enter your 4-digit PIN.'; return; }
  if (!Store.configured()) { $('#loginMsg').textContent = 'API_URL is not set in js/config.js yet.'; return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    const typed = pin;
    const r = await Store.login(u, pin);
    pin = ''; drawDots();
    await enterApp();
    if (r.mustChangePin) changePin(typed);
  } catch (err) {
    // Chrome says "Failed to fetch", Safari "Load failed", Firefox "NetworkError…"
    const network = err instanceof TypeError || /fetch|load failed|network/i.test(err.message);
    $('#loginMsg').textContent = network
      ? 'Cannot reach the server (' + err.message + '). Tap "Run connection check" below.'
      : err.message;
    $('#netCheckBtn').classList.toggle('hidden', !network);
    pin = ''; drawDots();
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
}
$('#loginBtn').addEventListener('click', doLogin);

// Step-by-step test of the path to the Apps Script server, so a failing phone can
// show which hop breaks. Sends no PIN or token — only the public "ping".
async function connectionCheck() {
  const out = $('#netCheck');
  out.classList.remove('hidden');
  const lines = [];
  const show = () => { out.textContent = lines.join('\n'); };
  const step = async (label, fn) => {
    lines.push('… ' + label); show();
    const t0 = Date.now();
    try { const r = await fn(); lines[lines.length - 1] = '✔ ' + label + ' — ' + r + ' (' + (Date.now() - t0) + ' ms)'; }
    catch (e) { lines[lines.length - 1] = '✘ ' + label + ' — ' + (e.name || 'Error') + ': ' + e.message + ' (' + (Date.now() - t0) + ' ms)'; }
    show();
  };
  lines.push('App v' + CFG.VERSION + ' · online: ' + navigator.onLine + ' · ' + (matchMedia('(display-mode: standalone)').matches ? 'installed app' : 'browser tab'));
  lines.push(navigator.userAgent);
  lines.push('Server: …' + String(CFG.API_URL).slice(-16));
  await step('Read server (GET)', async () => {
    const r = await fetch(CFG.API_URL, { method: 'GET', redirect: 'follow', cache: 'no-store' });
    const t = await r.text(); return r.status + ' ' + t.slice(0, 40);
  });
  await step('Send to server (POST ping)', async () => {
    const r = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ping' }), redirect: 'follow', cache: 'no-store' });
    const t = await r.text(); return r.status + ' ' + t.slice(0, 40);
  });
  lines.push('', 'Take a screenshot of this box and send it to support.');
  show();
}
$('#netCheckBtn').addEventListener('click', connectionCheck);
$('#loginUser').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.addEventListener('keydown', e => {
  if ($('#login').classList.contains('hidden')) return;
  if (document.activeElement === $('#loginUser')) return;
  if (/^\d$/.test(e.key) && pin.length < 6) { pin += e.key; drawDots(); }
  if (e.key === 'Backspace') { pin = pin.slice(0, -1); drawDots(); }
  if (e.key === 'Enter') doLogin();
});

/* ============================================================
   NAVIGATION
   ============================================================ */
let current = 'home';
function go(screen) {
  current = screen;
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 's-' + screen));
  $$('.nav button[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === (screen === 'dealers' ? 'more' : screen)));
  window.scrollTo({ top: 0 });
  render();
}
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { go(g.dataset.go); return; }
  const c = e.target.closest('[data-chase]');
  if (c) { chaseTab = c.dataset.chase; go('chase'); }
});
$('#addBtn').addEventListener('click', () => openForm(null));
window.addEventListener('scroll', () => {
  $$('.topbar').forEach(t => t.classList.toggle('scrolled', window.scrollY > 6));
});

/* ============================================================
   HOME
   ============================================================ */
const sum = (arr, k = 'amount') => arr.reduce((s, l) => s + (Number(l[k]) || 0), 0);
const byPhase = (arr, p) => arr.filter(l => Store.phaseOf(l) === p);
const isDue = l => !Store.isClosed(l) && l.nextFollowupDate && daysFrom(l.nextFollowupDate) <= 0;
const isStuck = l => !Store.isClosed(l) && Store.phaseOf(l) !== 'ro' && ageDays(l) >= CFG.STUCK_DAYS;

function renderHome() {
  const u = Store.user || { name: '', role: '' };
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  $('#greetName').textContent = greet + ', ' + String(u.name || '').split(' ')[0];
  $('#greetSub').textContent = CFG.BANK_NAME + ' · ' + CFG.BRANCH_NAME + ' branch';
  $('#homeAvatar').textContent = initials(u.name);

  const scope = Store.leads;

  const disb = byPhase(scope, 'done');
  const sanc = byPhase(scope, 'sanctioned');
  const open = scope.filter(l => !Store.isClosed(l) && Store.phaseOf(l) !== 'sanctioned');
  $('#kpiDisb').textContent = inr(sum(disb));
  $('#kpiDisbNote').textContent = disb.length + ' loan' + (disb.length === 1 ? '' : 's') + ' disbursed';
  $('#kpiSanc').textContent = inr(sum(sanc));
  $('#kpiOpen').textContent = inr(sum(open));
  $('#kpiDue').textContent = scope.filter(isDue).length;

  // phase split: team vs RO vs sanctioned
  const team = byPhase(scope, 'branch'), ro = byPhase(scope, 'ro');
  $('#phaseSplit').innerHTML = [
    ['branch', team, 'With branch', 'to chase'],
    ['ro', ro, 'At RO', 'waiting'],
    ['sanctioned', sanc, 'Sanctioned', 'to disburse']
  ].map(([p, ls, t, s]) => `<button class="ph" style="--pc:${PHASE_COLOR[p]}" data-filter-phase="${p}">
      <b>${ls.length}</b><span>${t}</span><small>${inr(sum(ls))} · ${s}</small></button>`).join('');

  // stage counts (every stage, in pipeline order)
  $('#stageStats').innerHTML = (Store.settings.stages || []).map(s => {
    const n = scope.filter(l => l.stage === s.name).length;
    return `<button class="stat" data-filter-stage="${esc(s.name)}">
      <b>${n}</b><span><i class="dot" style="background:${PHASE_COLOR[s.phase] || '#94a3b8'}"></i>${esc(s.name)}</span>
    </button>`;
  }).join('');

  // stuck files
  const stuck = scope.filter(isStuck).sort((a, b) => ageDays(b) - ageDays(a)).slice(0, 4);
  $('#stuckSec').classList.toggle('hidden', stuck.length === 0);
  $('#stuckList').innerHTML = stuck.map(leadCard).join('');

  // by product
  $('#productStats').innerHTML = (Store.settings.products || []).map(p => {
    const ls = scope.filter(l => l.product === p.code);
    const open = ls.filter(l => !Store.isClosed(l));
    const d = byPhase(ls, 'done');
    return `<button class="stat" data-filter-product="${esc(p.code)}" style="border-left:3px solid ${gColor(p.group)}">
      <b>${ls.length}</b><span>${esc(p.code)}</span>
      <span style="color:var(--text-3);font-size:10.5px">${open.length} open · ${d.length ? inr(sum(d)) + ' disb.' : '—'}</span>
    </button>`;
  }).join('');

  // due & overdue
  const attention = scope.filter(isDue)
    .sort((a, b) => String(a.nextFollowupDate).localeCompare(String(b.nextFollowupDate))).slice(0, 5);
  $('#homeFollowSec').classList.toggle('hidden', attention.length === 0);
  $('#homeFollowList').innerHTML = attention.map(leadCard).join('');

  // banners
  let b = '';
  if (!navigator.onLine) b += `<div class="banner offline">${ICON.cloud}Offline — changes are saved on this phone and will sync automatically.</div>`;
  if (Store.queue.length) b += `<div class="banner sync">${ICON.cloud}${Store.queue.length} change${Store.queue.length === 1 ? '' : 's'} waiting to sync.</div>`;
  $('#homeBanner').innerHTML = b;
}

/* ============================================================
   LEADS
   ============================================================ */
const filters = { q: '', group: '', product: '', stage: '', phase: '', source: '' };
const clearFilters = () => Object.keys(filters).forEach(k => filters[k] = '');

function leadCard(l) {
  const n = daysFrom(l.nextFollowupDate);
  const closed = Store.isClosed(l);
  const dueCls = closed || n === null ? '' : n < 0 ? ' over' : n === 0 ? ' today' : '';
  const dueTxt = l.nextFollowupDate ? prettyDate(l.nextFollowupDate) : 'No follow-up';
  return `<button class="lead" data-lead="${esc(l.id)}" style="--acc:${lColor(l)}">
    <div class="ini">${esc(l.product || '?')}</div>
    <div class="body">
      <div class="r1">
        <span class="nm">${esc(l.name)}</span>
        <span class="badge ${phaseCls(l)}">${esc(shortStage(l.stage || 'Enquiry'))}</span>
      </div>
      <div class="meta">${esc(Store.productName(l.product))}${l.city ? ' · ' + esc(l.city) : ''}</div>
      <div class="r3">
        <span class="amt">${inr(l.amount)}</span>
        ${agePill(l)}
        ${closed ? '' : `<span class="due${dueCls}">${ICON.cal}${esc(dueTxt)}</span>`}
        <span class="who">${esc(l.source === 'DSE/Dealer' ? (l.sourceName || 'Dealer').split(' – ').pop() : l.source || '')}</span>
      </div>
    </div>
  </button>`;
}

function chip(f, v, label, on, color) {
  return `<button class="chip${on ? ' on' : ''}" data-f="${f}" data-v="${esc(v)}">${color ? `<i class="cd" style="background:${color}"></i>` : ''}${esc(label)}</button>`;
}

function renderLeads() {
  const s = Store.settings;
  // product chips: groups, then products inside the chosen group
  let pc = chip('product', '', 'All products', !filters.product);
  (s.products || []).forEach(p => { pc += chip('product', p.code, p.code, filters.product === p.code, gColor(p.group)); });
  $('#productChips').innerHTML = pc;

  let sc = chip('stage', '', 'Any stage', !filters.stage && !filters.phase);
  sc += chip('phase', 'branch', 'With branch', filters.phase === 'branch') + chip('phase', 'ro', 'At RO', filters.phase === 'ro');
  (s.stages || []).forEach(st => { sc += chip('stage', st.name, st.name, filters.stage === st.name, PHASE_COLOR[st.phase]); });
  $('#stageChips').innerHTML = sc;

  $('#sourceChips').innerHTML = chip('source', '', 'Any source', !filters.source) +
    CFG.SOURCES.map(x => chip('source', x, x, filters.source === x)).join('');

  const list = filteredLeads();
  $('#leadCount').textContent = list.length + ' lead' + (list.length === 1 ? '' : 's') + ' · ' + inr(sum(list));
  $('#leadList').innerHTML = list.length
    ? list.map(leadCard).join('')
    : `<div class="empty">${ICON.inbox}<b>No leads here</b><p>Try clearing a filter, or tap + to add one.</p></div>`;
}

function filteredLeads() {
  const q = filters.q.toLowerCase();
  return Store.leads.filter(l => {
    const g = l.group || Store.groupOf(l.product);
    if (filters.group && g !== filters.group) return false;
    if (filters.product && l.product !== filters.product) return false;
    if (filters.stage && l.stage !== filters.stage) return false;
    if (filters.phase && Store.phaseOf(l) !== filters.phase) return false;
    if (filters.source && l.source !== filters.source) return false;
    if (!q) return true;
    const dl = Store.dealerOf(l);
    return [l.name, l.mobile, l.product, Store.productName(l.product), l.city, l.sourceName, dl && dl.company, l.remarks, l.requirement, l.projectDesc, l.bizNature]
      .some(x => String(x || '').toLowerCase().includes(q));
  }).sort((a, b) => {
    // open leads first, most overdue follow-up first, then oldest in stage
    const rank = x => {
      if (Store.isClosed(x)) return 1e9;
      const n = daysFrom(x.nextFollowupDate);
      return (n === null ? 1e6 : n * 1000) - ageDays(x);
    };
    return rank(a) - rank(b);
  });
}

$('#searchInput').addEventListener('input', e => { filters.q = e.target.value; renderLeads(); });

document.addEventListener('click', e => {
  const c = e.target.closest('.chip[data-f]');
  if (c) {
    const f = c.dataset.f, v = c.dataset.v;
    if (f === 'stage') { filters.stage = v; filters.phase = ''; }
    else if (f === 'phase') { filters.phase = v; filters.stage = ''; }
    else filters[f] = v;
    renderLeads(); return;
  }
  const fs = e.target.closest('[data-filter-stage]');
  if (fs) { clearFilters(); filters.stage = fs.dataset.filterStage; go('leads'); return; }
  const fp = e.target.closest('[data-filter-phase]');
  if (fp) { clearFilters(); filters.phase = fp.dataset.filterPhase; go('leads'); return; }
  const fpr = e.target.closest('[data-filter-product]');
  if (fpr) { clearFilters(); filters.product = fpr.dataset.filterProduct; go('leads'); return; }

  const ld = e.target.closest('[data-lead]');
  if (ld) openDetail(ld.dataset.lead);
});

/* ============================================================
   LEAD DETAIL
   ============================================================ */
function waLink(mobile, text) {
  const mob = String(mobile || '').replace(/\D/g, '');
  const wa = mob ? (mob.length === 10 ? '91' + mob : mob) : '';
  return wa ? 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text) : 'https://wa.me/?text=' + encodeURIComponent(text);
}

function openDetail(id) {
  const l = Store.leads.find(x => x.id === id);
  if (!l) return;
  const mob = String(l.mobile || '').replace(/\D/g, '');
  const msg = CFG.WA_TEMPLATE.replace('{name}', l.name).replace('{product}', Store.productName(l.product))
    .replace('{bank}', CFG.BANK_NAME).replace('{branch}', l.branch || CFG.BRANCH_NAME);
  const editable = Store.canEdit(l);
  const hist = Store.followupsFor(l.id);
  const stages = Store.settings.stages || [];
  const idx = stages.findIndex(s => s.name === l.stage);
  const phase = Store.phaseOf(l);
  const closed = Store.isClosed(l);
  const pipe = stages.filter(s => s.phase !== 'lost');
  const strip = pipe.map((s, i) => {
    const cur = s.name === l.stage;
    const done = idx >= 0 && stages.indexOf(s) < idx && phase !== 'lost';
    return `<i class="${phase === 'lost' ? (done || cur ? 'lost' : '') : cur ? 'cur' : done ? 'done' : ''}"></i>`;
  }).join('');
  const dateBox = (k, label) => `<div class="${l[k] ? 'set' : ''}"><b>${l[k] ? esc(prettyDate(l[k])) : '—'}</b><span>${label}</span></div>`;
  const incomeTxt = l.incomeSource ? `${l.incomeSource}${l.income ? ' · ' + inrFull(l.income) + (l.incomePeriod === 'Annual' ? ' p.a.' : ' p.m.') : ''}` : '';
  const familyTxt = (l.dependents || l.earners) ? `${l.dependents || 0} dependents · ${l.earners || 0} earning` : '';
  const resTxt = l.residence ? [l.residence, l.locality, l.resYears ? l.resYears + ' yrs' : ''].filter(Boolean).join(' · ') : '';
  const bizTxt = l.bizNature ? [l.bizNature, l.bizPlace, l.bizYears ? l.bizYears + ' yrs' : ''].filter(Boolean).join(' · ') : '';
  const marginPct = l.projectCost > 0 ? Math.round((l.margin / l.projectCost) * 1000) / 10 : null;

  openSheet(`
    <div class="d-hero">
      <div class="ini" style="background:${lColor(l)}">${esc(l.product)}</div>
      <div style="flex:1;min-width:0">
        <h3 class="nm">${esc(l.name)}</h3>
        <div class="mb">${esc(l.mobile || 'No mobile')}${l.city ? ' · ' + esc(l.city) : ''}</div>
      </div>
      <span class="badge ${phaseCls(l)}">${esc(shortStage(l.stage))}</span>
    </div>

    <div class="actions">
      <a class="act call" href="${mob ? 'tel:' + mob : '#'}">${ICON.phone}<span>Call</span></a>
      <a class="act wa" href="${waLink(l.mobile, msg)}" target="_blank" rel="noopener">${ICON.wa}<span>WhatsApp</span></a>
      <a class="act sms" href="${mob ? 'sms:' + mob : '#'}">${ICON.sms}<span>SMS</span></a>
      <button class="act share" data-act="share" data-id="${esc(l.id)}">${ICON.share}<span>Share proposal</span></button>
    </div>

    ${editable ? `<div class="btn-row">
      <button class="btn" data-act="followup" data-id="${esc(l.id)}">${ICON.cal} Follow-up / move</button>
      <button class="btn ghost" data-act="edit" data-id="${esc(l.id)}">${ICON.edit} Edit</button>
    </div>` : `<p class="sub" style="margin:4px 0 12px">This lead belongs to ${esc(Store.ownerName(l))}. Only they or an Admin can change it.</p>`}

    <div class="stages">${strip}</div>
    <div class="stage-line">
      <span>${esc(PHASE_LABEL[phase] || '')}${closed ? '' : ' · ' + ageDays(l) + ' day' + (ageDays(l) === 1 ? '' : 's') + ' in this stage'}</span>
      <span>${l.nextFollowupDate && !closed ? 'Next: ' + esc(prettyDate(l.nextFollowupDate)) : ''}</span>
    </div>
    <div class="dates">
      ${dateBox('appGenDate', 'App. gen.')}${dateBox('sentRODate', 'Sent to RO')}${dateBox('sanctionDate', 'Sanction')}${dateBox('disbDate', 'Disbursed')}
    </div>

    <div class="card">
      <div class="card-title">Loan</div>
      ${kv('Product', Store.productName(l.product) + ' (' + l.group + ')')}
      ${l.projectCost ? kv('Project cost', inrFull(l.projectCost)) : ''}
      ${l.projectCost ? kv('Own contribution', inrFull(l.margin) + (marginPct !== null ? ' (' + marginPct + '%)' : '')) : ''}
      ${kv('Loan required', inrFull(l.amount))}
      ${l.projectDesc ? kvBlock('Project', l.projectDesc) : ''}
      ${l.security ? kvBlock('Security offered', l.security) : ''}
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-title">Borrower profile</div>
      ${incomeTxt ? kv('Income', incomeTxt) : ''}
      ${familyTxt ? kv('Family', familyTxt) : ''}
      ${l.familyNote ? kvBlock('', l.familyNote) : ''}
      ${resTxt ? kv('Residence', resTxt) : ''}
      ${l.requirement ? kvBlock('Requirement', l.requirement) : ''}
      ${bizTxt ? kv('Business', bizTxt) : ''}
      ${l.obligations ? kvBlock('Existing obligations', l.obligations) : ''}
      ${!incomeTxt && !familyTxt && !resTxt && !l.requirement ? '<p style="margin:0;font-size:13px;color:var(--text-3)">Profile not filled yet — tap Edit.</p>' : ''}
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-title">Lead</div>
      ${l.dealerId && Store.dealerOf(l)
        ? `<button class="kv" style="width:100%;text-align:left" data-dealer="${esc(l.dealerId)}"><span class="k">Source</span><span class="v" style="color:var(--brand-2)">${esc(l.source)} · ${esc(l.sourceName)} ›</span></button>`
        : kv('Source', l.source + (l.sourceName ? ' · ' + l.sourceName : ''))}
      ${kv('Lead by', Store.ownerName(l) || '—')}
      ${kv('Branch', l.branch || CFG.BRANCH_NAME)}
      ${kv('Created', l.createdAt ? prettyDate(l.createdAt) : '—')}
      ${kv('Last updated', l.updatedAt ? prettyTime(l.updatedAt) : '—')}
    </div>

    ${l.remarks ? `<div class="card" style="margin-top:12px">
      <div class="card-title">Latest remark</div>
      <div style="font-size:14.5px;line-height:1.5">${esc(l.remarks)}</div>
    </div>` : ''}

    ${hist.length ? `<div style="margin-top:18px">
      <div class="sec-head"><h2>Follow-up history</h2></div>
      <div class="timeline">${hist.map(f => `
        <div class="tl">
          <div class="tm">${esc(prettyTime(f.at))}</div>
          <div class="tn">${esc(f.note || '—')}</div>
          <div class="tb">${esc(f.by || '')}${f.stageTo && f.stageTo !== f.stageFrom ? ' · moved to ' + esc(f.stageTo) : ''}${f.nextDate ? ' · next ' + esc(prettyDate(f.nextDate)) : ''}</div>
        </div>`).join('')}</div>
    </div>` : ''}

    ${editable ? `<button class="btn ghost" data-act="delete" data-id="${esc(l.id)}" style="margin-top:16px;color:var(--danger)">${ICON.trash} Delete lead</button>` : ''}
  `);
}

function kv(k, v) { return `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`; }
function kvBlock(k, v) { return `<div class="kv block">${k ? `<span class="k">${esc(k)}</span>` : ''}<span class="v">${esc(v)}</span></div>`; }

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const id = a.dataset.id;
  if (a.dataset.act === 'edit') { closeSheet(); openForm(id); }
  if (a.dataset.act === 'followup') { closeSheet(); openFollowupForm(id); }
  if (a.dataset.act === 'share') { openShare(id); }
  if (a.dataset.act === 'delete') {
    if (confirm('Delete this lead? It will be marked deleted in the Sheet.')) {
      Store.deleteLead(id); closeSheet(); toast('Lead deleted', 'ok'); render();
    }
  }
});

/* ============================================================
   SHARE PROPOSAL
   ============================================================ */
function proposalText(l) {
  const B = s => '*' + s + '*';
  const lines = [];
  const money = n => inrFull(n) + (n >= 100000 ? ' (' + inr(n) + ')' : '');
  lines.push(B('LOAN PROPOSAL — ' + Store.productName(l.product)));
  lines.push(CFG.BANK_NAME + ' · ' + (l.branch || CFG.BRANCH_NAME) + ' branch');
  lines.push(longDate());
  lines.push('');

  lines.push(B('Borrower'));
  lines.push(l.name + (l.mobile ? ' · ' + l.mobile : ''));
  const cityDup = l.locality && l.city && l.locality.toLowerCase().includes(l.city.toLowerCase());
  if (l.locality || l.city) lines.push([l.locality, cityDup ? '' : l.city].filter(Boolean).join(', '));
  lines.push('');

  if (l.incomeSource || l.income) {
    lines.push(B('Income'));
    lines.push([l.incomeSource, l.income ? inrFull(l.income) + (l.incomePeriod === 'Annual' ? ' per annum' : ' per month') : ''].filter(Boolean).join(' · '));
    lines.push('');
  }
  if (l.dependents || l.earners || l.familyNote) {
    lines.push(B('Family'));
    if (l.dependents || l.earners) lines.push(`${l.dependents || 0} dependents · ${l.earners || 0} earning member${l.earners == 1 ? '' : 's'}`);
    if (l.familyNote) lines.push(l.familyNote);
    lines.push('');
  }
  if (l.residence || l.locality) {
    lines.push(B('Residence'));
    lines.push([l.residence, l.locality, l.resYears ? l.resYears + ' years' : ''].filter(Boolean).join(' · '));
    lines.push('');
  }
  if (l.requirement) { lines.push(B('Requirement')); lines.push(l.requirement); lines.push(''); }
  if (l.bizNature) {
    lines.push(B('Business'));
    lines.push([l.bizNature, l.bizPlace, l.bizYears ? l.bizYears + ' years' : ''].filter(Boolean).join(' · '));
    lines.push('');
  }
  if (l.obligations) { lines.push(B('Existing obligations')); lines.push(l.obligations); lines.push(''); }
  if (l.security) { lines.push(B('Security offered')); lines.push(l.security); lines.push(''); }

  lines.push(B('Project'));
  if (l.projectDesc) lines.push(l.projectDesc);
  if (l.projectCost > 0) {
    lines.push('Project cost: ' + money(l.projectCost));
    const pct = Math.round((l.margin / l.projectCost) * 1000) / 10;
    lines.push('Own contribution: ' + money(l.margin) + ' (' + pct + '%)');
  }
  lines.push('Loan required: ' + money(l.amount));
  lines.push('');
  lines.push('Submitted by ' + ((Store.user || {}).name || Store.ownerName(l)) + ', Branch Manager, ' + (l.branch || CFG.BRANCH_NAME));
  if (l.source === 'DSE/Dealer' && l.sourceName) lines.push('Lead via ' + l.sourceName);
  return lines.join('\n');
}

function openShare(id) {
  const l = Store.leads.find(x => x.id === id); if (!l) return;
  const text = proposalText(l);
  const subject = 'Loan proposal — ' + l.name + ' — ' + Store.productName(l.product) + ' ' + inr(l.amount);
  openSheet(`
    <h3>Share proposal</h3>
    <p class="sub">Ready to send to a sanctioning authority. WhatsApp shows the *bold* headers.</p>
    <div class="proposal" id="propText">${esc(text)}</div>
    <div class="btn-row">
      <a class="btn" style="background:#128c7e;box-shadow:0 6px 18px rgba(18,140,126,.3)" href="${waLink('', text)}" target="_blank" rel="noopener">${ICON.wa} WhatsApp</a>
      <button class="btn ghost" id="propCopy">${ICON.copy} Copy</button>
    </div>
    <div class="btn-row" style="margin-top:10px">
      <a class="btn ghost" href="mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text.replace(/\*/g, ''))}">${ICON.mail} Email</a>
      <button class="btn ghost" id="propShare">${ICON.share} Share…</button>
    </div>
  `);
  $('#propCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(text); toast('Copied', 'ok'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copied', 'ok'); } catch (e2) { toast('Could not copy', 'err'); }
      ta.remove();
    }
  };
  $('#propShare').onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: subject, text }); } catch (e) {} }
    else toast('Use WhatsApp, Email or Copy on this device');
  };
}

/* ============================================================
   ADD / EDIT FORM
   ============================================================ */
let formLead = null;

function blankLead() {
  const firstGroup = (Store.settings.groups || [])[0] || '';
  const firstProd = Store.productsIn(firstGroup)[0];
  return {
    id: '', group: firstGroup, product: firstProd ? firstProd.code : '',
    name: '', mobile: '', city: '', branch: CFG.BRANCH_NAME,
    amount: '', stage: Store.stageDef('Enquiry') ? 'Enquiry' : (Store.stageNames()[0] || 'Enquiry'), stageSince: '',
    source: CFG.SOURCES[0], sourceName: '', dealerId: '', nextFollowupDate: '', remarks: '',
    appGenDate: '', sentRODate: '', sanctionDate: '', disbDate: '',
    incomeSource: '', income: '', incomePeriod: 'Monthly', dependents: '', earners: '', familyNote: '',
    residence: '', locality: '', resYears: '', requirement: '', bizNature: '', bizPlace: '', bizYears: '',
    obligations: '', security: '', projectCost: '', margin: '', projectDesc: '',
    leadBy: (Store.user || {}).username
  };
}

function openForm(id) {
  const src = id ? Store.leads.find(l => l.id === id) : null;
  formLead = Object.assign(blankLead(), src ? JSON.parse(JSON.stringify(src)) : {});
  if (!formLead.group) formLead.group = Store.groupOf(formLead.product);
  $('#formTitle').textContent = id ? 'Edit Lead' : 'New Lead';
  drawForm();
  $('#form').classList.add('on');
  $('#form').scrollTop = 0;
}
function closeForm() { $('#form').classList.remove('on'); }
$('#formClose').addEventListener('click', closeForm);

const sel = (id, opts, val, extra = '') => `<select id="${id}" ${extra}>${opts.map(o => `<option value="${esc(o)}"${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
const num = (id, val, ph = '0', extra = '') => `<input id="${id}" type="number" inputmode="numeric" value="${esc(val === 0 ? '' : val)}" placeholder="${ph}" ${extra}>`;

function drawForm() {
  const l = formLead;
  const groups = Store.settings.groups || [];
  const stages = Store.stageNames();
  const hasCost = Number(l.projectCost) > 0;

  $('#formBody').innerHTML = `
    <div class="field"><label>Product</label>
      <select id="fProd">${groups.map(g => `<optgroup label="${esc(g)}">${Store.productsIn(g).map(p => `<option value="${esc(p.code)}"${p.code === l.product ? ' selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}</select>
    </div>

    <div class="field"><label>Customer name *</label>
      <input id="fName" value="${esc(l.name)}" placeholder="Full name" autocomplete="name"></div>

    <div class="row2">
      <div class="field"><label>Mobile</label>
        <input id="fMobile" type="tel" inputmode="numeric" value="${esc(l.mobile)}" placeholder="10 digit number"></div>
      <div class="field"><label>City / village</label>
        <input id="fCity" value="${esc(l.city || '')}" placeholder="City"></div>
    </div>

    <div class="row2">
      <div class="field"><label>Lead source</label>${sel('fSource', CFG.SOURCES, l.source)}</div>
      <div class="field" id="fDealerWrap" ${l.source === 'DSE/Dealer' ? '' : 'style="display:none"'}><label>DSE / Dealer</label>
        <select id="fDealer"><option value="">— pick from directory —</option>
          ${Store.dealers.slice().sort((a, b) => String(a.company).localeCompare(b.company)).map(d => `<option value="${esc(d.id)}"${d.id === l.dealerId ? ' selected' : ''}>${esc(d.company)}${d.contact ? ' · ' + esc(d.contact) : ''}</option>`).join('')}
          <option value="__other"${l.sourceName && !l.dealerId ? ' selected' : ''}>Other / not listed…</option></select></div>
    </div>
    <div class="field" id="fSourceNameWrap" ${l.source === 'DSE/Dealer' && !l.dealerId ? '' : 'style="display:none"'}><label>DSE / Dealer name</label>
      <input id="fSourceName" value="${esc(l.sourceName || '')}" placeholder="Who referred this? (Add them under More → DSE & Dealers to reuse)"></div>

    <div class="row2">
      <div class="field"><label>Stage</label>${sel('fStage', stages, l.stage)}</div>
      <div class="field"><label>Next follow-up</label>
        <input id="fNext" type="date" value="${esc(l.nextFollowupDate || '')}"></div>
    </div>

    <div class="field"><label>Branch</label><input id="fBranch" value="${esc(l.branch || CFG.BRANCH_NAME)}"></div>
    ${leadForField(l)}

    <div class="form-sec">Project</div>
    <div class="row2">
      <div class="field"><label>Project cost (₹)</label>${num('fCost', l.projectCost, 'Total cost')}</div>
      <div class="field"><label>Own contribution (₹)</label>${num('fMargin', l.margin, 'Margin')}</div>
    </div>
    <div class="field"><label>Loan required (₹)</label>
      ${num('fAmount', l.amount, 'Loan amount', hasCost ? 'readonly' : '')}
      <div class="hint" id="fAmountHint">${hasCost ? 'Calculated: project cost − own contribution' : 'Enter project cost and margin above to calculate this automatically'}</div></div>
    <div class="field"><label>Project description</label>
      <textarea id="fProjDesc" rows="2" placeholder="Two lines about the house, vehicle, shop, land…">${esc(l.projectDesc || '')}</textarea></div>
    <div class="field"><label>Security offered</label>
      <input id="fSecurity" value="${esc(l.security || '')}" placeholder="Property, vehicle, gold, TDR, hypothecation…"></div>

    <div class="form-sec">Borrower profile</div>
    <div class="row3">
      <div class="field"><label>Income source</label>${sel('fIncSrc', [''].concat(CFG.INCOME_SOURCES), l.incomeSource)}</div>
      <div class="field"><label>Income (₹)</label>${num('fIncome', l.income, 'Approx.')}</div>
      <div class="field"><label>Per</label>${sel('fIncPer', ['Monthly', 'Annual'], l.incomePeriod || 'Monthly')}</div>
    </div>
    <div class="row2">
      <div class="field"><label>Dependents</label>${num('fDep', l.dependents, '0')}</div>
      <div class="field"><label>Earning members</label>${num('fEarn', l.earners, '1')}</div>
    </div>
    <div class="field"><label>Family note</label>
      <input id="fFamily" value="${esc(l.familyNote || '')}" placeholder="One line about the family"></div>
    <div class="row3">
      <div class="field"><label>Residence</label>${sel('fRes', [''].concat(CFG.RESIDENCE_TYPES), l.residence)}</div>
      <div class="field" style="grid-column:span 2"><label>Locality</label><input id="fLocality" value="${esc(l.locality || '')}" placeholder="Area / village"></div>
    </div>
    <div class="field"><label>Years at this residence</label>${num('fResYears', l.resYears, '')}</div>
    <div class="field"><label>Requirement — in the customer's words</label>
      <textarea id="fReq" rows="2" placeholder="What is the money actually for?">${esc(l.requirement || '')}</textarea></div>

    <details class="acc" ${l.bizNature ? 'open' : ''}><summary>Business setup (only if they have one)</summary><div class="acc-body">
      <div class="field"><label>Nature of business</label><input id="fBizNature" value="${esc(l.bizNature || '')}" placeholder="e.g. Hardware trading"></div>
      <div class="row2">
        <div class="field"><label>Where</label><input id="fBizPlace" value="${esc(l.bizPlace || '')}"></div>
        <div class="field"><label>Years running</label>${num('fBizYears', l.bizYears, '')}</div>
      </div>
    </div></details>

    <div class="field"><label>Existing obligations</label>
      <input id="fOblig" value="${esc(l.obligations || '')}" placeholder="Current loans / EMIs elsewhere, one line"></div>

    <div class="form-sec">Notes</div>
    <div class="field"><label>Remarks</label>
      <textarea id="fRemarks" rows="2" placeholder="Latest note">${esc(l.remarks || '')}</textarea></div>

    <details class="acc"><summary>Stage dates</summary><div class="acc-body">
      <p class="hint" style="margin:0 0 10px;font-size:12px;color:var(--text-3)">Filled automatically when a lead reaches the stage. Edit only to correct a date.</p>
      <div class="row2">
        <div class="field"><label>Application generated</label><input id="fAppGen" type="date" value="${esc(l.appGenDate || '')}"></div>
        <div class="field"><label>Sent to RO</label><input id="fSentRO" type="date" value="${esc(l.sentRODate || '')}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Sanctioned</label><input id="fSanc" type="date" value="${esc(l.sanctionDate || '')}"></div>
        <div class="field"><label>Disbursed</label><input id="fDisb" type="date" value="${esc(l.disbDate || '')}"></div>
      </div>
    </div></details>
  `;

  const dealerUI = () => {
    const isD = $('#fSource').value === 'DSE/Dealer';
    $('#fDealerWrap').style.display = isD ? '' : 'none';
    $('#fSourceNameWrap').style.display = isD && $('#fDealer').value === '__other' ? '' : 'none';
  };
  $('#fSource').onchange = dealerUI;
  $('#fDealer').onchange = dealerUI;
  const recalc = () => {
    const c = Number($('#fCost').value) || 0, m = Number($('#fMargin').value) || 0;
    const a = $('#fAmount');
    if (c > 0) { a.value = Math.max(0, c - m); a.readOnly = true; $('#fAmountHint').textContent = 'Calculated: project cost − own contribution' + (m > 0 ? ' (' + (Math.round(m / c * 1000) / 10) + '% margin)' : ''); }
    else { a.readOnly = false; $('#fAmountHint').textContent = 'Enter project cost and margin above to calculate this automatically'; }
  };
  $('#fCost').oninput = recalc; $('#fMargin').oninput = recalc;
}

// Admin-only: create or move a lead into any active login's name.
function leadForField(l) {
  if ((Store.user || {}).role !== 'Admin') return '';
  const people = Store.users.filter(u => u.active !== false);
  if (people.length < 2) return '';
  const cur = (Store.users.find(u => u.username === l.leadBy || u.name === l.leadBy) || {}).username || l.leadBy;
  return `<div class="field"><label>Lead for</label><select id="fLeadBy">${people.map(u =>
    `<option value="${esc(u.username)}"${u.username === cur ? ' selected' : ''}>${esc(u.name)} (@${esc(u.username)})</option>`).join('')}</select></div>`;
}

function collectForm() {
  const g = id => { const e = $(id); return e ? e.value : ''; };
  const l = formLead;
  l.product = g('#fProd');
  l.group = Store.groupOf(l.product) || l.group;
  l.name = g('#fName').trim();
  l.mobile = g('#fMobile').replace(/\s/g, '');
  l.city = g('#fCity').trim();
  l.source = g('#fSource');
  const dsel = g('#fDealer');
  if (l.source === 'DSE/Dealer' && dsel && dsel !== '__other') {
    const d = Store.dealers.find(x => x.id === dsel);
    l.dealerId = dsel; l.sourceName = d ? [d.contact, d.company].filter(Boolean).join(' – ') : '';
  } else {
    l.dealerId = '';
    l.sourceName = l.source === 'DSE/Dealer' ? g('#fSourceName').trim() : '';
  }
  l.stage = g('#fStage');
  l.nextFollowupDate = g('#fNext');
  l.branch = g('#fBranch').trim() || CFG.BRANCH_NAME;
  if ($('#fLeadBy')) l.leadBy = g('#fLeadBy');
  l.projectCost = g('#fCost'); l.margin = g('#fMargin'); l.amount = g('#fAmount');
  l.projectDesc = g('#fProjDesc').trim();
  l.security = g('#fSecurity').trim();
  l.incomeSource = g('#fIncSrc'); l.income = g('#fIncome'); l.incomePeriod = g('#fIncPer');
  l.dependents = g('#fDep'); l.earners = g('#fEarn'); l.familyNote = g('#fFamily').trim();
  l.residence = g('#fRes'); l.locality = g('#fLocality').trim(); l.resYears = g('#fResYears');
  l.requirement = g('#fReq').trim();
  l.bizNature = g('#fBizNature').trim(); l.bizPlace = g('#fBizPlace').trim(); l.bizYears = g('#fBizYears');
  l.obligations = g('#fOblig').trim();
  l.remarks = g('#fRemarks').trim();
  l.appGenDate = g('#fAppGen'); l.sentRODate = g('#fSentRO'); l.sanctionDate = g('#fSanc'); l.disbDate = g('#fDisb');
  ['income', 'dependents', 'earners', 'resYears', 'bizYears', 'projectCost', 'margin', 'amount'].forEach(k => l[k] = Number(l[k]) || 0);
}

$('#formSave').addEventListener('click', () => {
  collectForm();
  if (!formLead.name) { toast('Customer name is required', 'err'); return; }
  if (formLead.mobile && !/^\d{10}$/.test(formLead.mobile)) { toast('Mobile should be 10 digits', 'err'); return; }
  // a prospect has not been pitched yet, so the amount may still be unknown
  if (!formLead.amount && !formLead.projectCost && formLead.stage !== 'Prospect') { toast('Enter the loan amount or project cost', 'err'); return; }
  const existing = formLead.id ? Store.leads.find(l => l.id === formLead.id) : null;
  Store.saveLead(formLead);
  closeForm();
  toast(existing ? 'Lead updated' : 'Lead added', 'ok');
  render();
});

/* ============================================================
   FOLLOW-UP FORM
   ============================================================ */
function openFollowupForm(id) {
  const l = Store.leads.find(x => x.id === id); if (!l) return;
  const stages = Store.stageNames();
  const next = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  openSheet(`
    <h3>Follow-up</h3>
    <p class="sub">${esc(l.name)} · ${esc(Store.productName(l.product))} · ${esc(l.stage)}</p>
    <div class="field"><label>What happened?</label>
      <textarea id="fuNote" rows="3" placeholder="e.g. Collected salary slips; sale deed copy still pending."></textarea></div>
    <div class="row2">
      <div class="field"><label>Move stage to</label>${sel('fuStage', stages, l.stage)}</div>
      <div class="field"><label>Next follow-up</label>
        <input id="fuDate" type="date" value="${esc(l.nextFollowupDate || next)}"></div>
    </div>
    <button class="btn" id="fuSave">Save follow-up</button>
  `);
  $('#fuSave').onclick = () => {
    const note = $('#fuNote').value.trim();
    if (!note) { toast('Add a short note', 'err'); return; }
    Store.addFollowup({ leadId: l.id, note, stageFrom: l.stage, stageTo: $('#fuStage').value, nextDate: $('#fuDate').value });
    closeSheet(); toast('Follow-up saved', 'ok'); render();
  };
}

/* ============================================================
   CHASE SCREEN — follow-ups + ageing
   ============================================================ */
let chaseTab = 'due';
function renderChase() {
  const tabs = [['due', 'Due & overdue'], ['stuck', 'Stuck files'], ['team', 'With branch'], ['ro', 'At RO'], ['sanc', 'To disburse'], ['week', 'Next 7 days'], ['done', 'Recent activity']];
  $('#chaseChips').innerHTML = tabs.map(([k, t]) => `<button class="chip${chaseTab === k ? ' on' : ''}" data-ctab="${k}">${t}</button>`).join('');

  const scope = Store.leads;
  let html = '', note = '';

  if (chaseTab === 'done') {
    const recent = Store.followups.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 40);
    html = recent.length ? `<div class="card"><div class="timeline">${recent.map(f => {
      const l = Store.leads.find(x => x.id === f.leadId);
      return `<div class="tl">
        <div class="tm">${esc(prettyTime(f.at))} · ${esc(f.by || '')}</div>
        <div class="tn">${esc(f.note || '')}</div>
        <div class="tb">${esc(l ? l.name : 'Deleted lead')}${f.stageTo && f.stageTo !== f.stageFrom ? ' → ' + esc(f.stageTo) : ''}</div>
      </div>`;
    }).join('')}</div></div>` : emptyBlock('No activity yet', 'Log a follow-up from any lead.');
  } else {
    let list = scope.filter(l => !Store.isClosed(l));
    if (chaseTab === 'due') { list = list.filter(isDue); note = 'Follow-up date is today or has passed.'; }
    if (chaseTab === 'stuck') { list = list.filter(isStuck).sort((a, b) => ageDays(b) - ageDays(a)); note = 'In the same stage for ' + CFG.STUCK_DAYS + '+ days (RO files excluded).'; }
    if (chaseTab === 'team') { list = byPhase(list, 'branch').sort((a, b) => ageDays(b) - ageDays(a)); note = 'Up to Application Generated — branch work.'; }
    if (chaseTab === 'ro') { list = byPhase(list, 'ro').sort((a, b) => ageDays(b) - ageDays(a)); note = 'At Regional Office — waiting, not chasing.'; }
    if (chaseTab === 'sanc') { list = byPhase(list, 'sanctioned').sort((a, b) => ageDays(b) - ageDays(a)); note = 'Sanctioned but not yet disbursed.'; }
    if (chaseTab === 'week') { list = list.filter(l => { const n = daysFrom(l.nextFollowupDate); return n !== null && n > 0 && n <= 7; }); note = 'Follow-ups due in the next 7 days.'; }
    if (chaseTab === 'due' || chaseTab === 'week') list.sort((a, b) => String(a.nextFollowupDate || '9999').localeCompare(String(b.nextFollowupDate || '9999')));
    html = list.length ? list.map(leadCard).join('') : emptyBlock('All clear', 'Nothing in this bucket.');
    note = list.length + ' file' + (list.length === 1 ? '' : 's') + ' · ' + inr(sum(list)) + (note ? ' — ' + note : '');
  }
  $('#chaseNote').textContent = note;
  $('#chaseList').innerHTML = html;
}
function emptyBlock(t, p) { return `<div class="empty">${ICON.inbox}<b>${esc(t)}</b><p>${esc(p)}</p></div>`; }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ctab]');
  if (t) { chaseTab = t.dataset.ctab; renderChase(); }
});

/* ============================================================
   DEALERS — DSE / dealer directory
   ============================================================ */
const dFilters = { q: '', type: '' };
const dealerAge = d => d.lastContact ? -daysFrom(d.lastContact) : null;

function dealerCard(d) {
  const n = dealerAge(d);
  const leads = Store.leadsForDealer(d.id);
  const disb = leads.filter(l => Store.phaseOf(l) === 'done').length;
  const cls = n === null || n >= CFG.DEALER_STALE_DAYS ? ' stuck' : n >= Math.ceil(CFG.DEALER_STALE_DAYS / 2) ? ' warn' : '';
  const txt = n === null ? 'never contacted' : n === 0 ? 'contacted today' : n + 'd since contact';
  return `<button class="lead" data-dealer="${esc(d.id)}" style="--acc:${typeColor(d.type)}">
    <div class="ini">${esc(initials(d.company || d.contact))}</div>
    <div class="body">
      <div class="r1"><span class="nm">${esc(d.company || d.contact)}</span><span class="badge b-branch">${esc(d.type || 'Dealer')}</span></div>
      <div class="meta">${esc([d.contact, d.location].filter(Boolean).join(' · '))}</div>
      <div class="r3">
        <span class="age${cls}">${ICON.clock}${txt}</span>
        <span>${leads.length} lead${leads.length === 1 ? '' : 's'}${disb ? ' · ' + disb + ' disbursed' : ''}</span>
        <span class="who">${esc(d.mobile || '')}</span>
      </div>
    </div>
  </button>`;
}
function typeColor(t) {
  const i = CFG.DEALER_TYPES.indexOf(t);
  return ['#3b82f6', '#f59e0b', '#0ea5e9', '#22a06b', '#a855f7', '#64748b'][i < 0 ? 5 : i % 6];
}

function renderDealers() {
  $('#dealerChips').innerHTML = chip('dtype', '', 'All types', !dFilters.type) +
    CFG.DEALER_TYPES.map(t => chip('dtype', t, t, dFilters.type === t, typeColor(t))).join('');
  const q = dFilters.q.toLowerCase();
  const list = Store.dealers.filter(d => {
    if (dFilters.type && d.type !== dFilters.type) return false;
    if (!q) return true;
    return [d.company, d.contact, d.location, d.mobile, d.notes, d.type].some(x => String(x || '').toLowerCase().includes(q));
  }).sort((a, b) => {
    // longest-uncontacted first, so the list is a call sheet
    const r = d => { const n = dealerAge(d); return n === null ? -1e6 : -n; };
    return r(a) - r(b);
  });
  const stale = list.filter(d => { const n = dealerAge(d); return n === null || n >= CFG.DEALER_STALE_DAYS; }).length;
  $('#dealerCount').textContent = list.length + ' contact' + (list.length === 1 ? '' : 's') + (stale ? ' · ' + stale + ' not contacted in ' + CFG.DEALER_STALE_DAYS + '+ days' : '');
  $('#dealerList').innerHTML = list.length ? list.map(dealerCard).join('')
    : `<div class="empty">${ICON.inbox}<b>No dealers yet</b><p>Tap + Add to save a car, CV or tractor dealer you get leads from.</p></div>`;
}
$('#dealerSearch').addEventListener('input', e => { dFilters.q = e.target.value; renderDealers(); });
$('#addDealerBtn').addEventListener('click', () => openDealerForm(null));

function openDealerDetail(id) {
  const d = Store.dealers.find(x => x.id === id); if (!d) return;
  const mob = String(d.mobile || '').replace(/\D/g, '');
  const msg = 'Hello ' + (d.contact || '') + ', ' + (Store.user || {}).name + ' here from ' + CFG.BANK_NAME + ', ' + CFG.BRANCH_NAME + ' branch. Any customers this week who need finance? Happy to help with quick sanction.';
  const leads = Store.leadsForDealer(d.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const n = dealerAge(d);
  const isAdmin = (Store.user || {}).role === 'Admin';
  openSheet(`
    <div class="d-hero">
      <div class="ini" style="background:${typeColor(d.type)}">${esc(initials(d.company || d.contact))}</div>
      <div style="flex:1;min-width:0">
        <h3 class="nm">${esc(d.company || d.contact)}</h3>
        <div class="mb">${esc([d.contact, d.mobile].filter(Boolean).join(' · ') || 'No contact')}</div>
      </div>
      <span class="badge b-branch">${esc(d.type || 'Dealer')}</span>
    </div>
    <div class="actions">
      <a class="act call" href="${mob ? 'tel:' + mob : '#'}">${ICON.phone}<span>Call</span></a>
      <a class="act wa" href="${waLink(d.mobile, msg)}" target="_blank" rel="noopener">${ICON.wa}<span>WhatsApp</span></a>
      <a class="act sms" href="${mob ? 'sms:' + mob : '#'}">${ICON.sms}<span>SMS</span></a>
      <button class="act share" data-dact="newlead" data-id="${esc(d.id)}">${ICON.users}<span>New lead</span></button>
    </div>
    <div class="btn-row">
      <button class="btn" data-dact="contacted" data-id="${esc(d.id)}">${ICON.clock} Contacted today</button>
      <button class="btn ghost" data-dact="edit" data-id="${esc(d.id)}">${ICON.edit} Edit</button>
    </div>
    <div class="card" style="margin-top:14px">
      ${kv('Location', d.location || '—')}
      ${kv('Last contacted', d.lastContact ? prettyDate(d.lastContact) + (n > 0 ? ' (' + n + 'd ago)' : '') : 'Never')}
      ${d.notes ? kvBlock('Notes', d.notes) : ''}
    </div>
    <div style="margin-top:18px">
      <div class="sec-head"><h2>Leads from this dealer</h2><span style="font-size:13px;color:var(--text-2);font-weight:600">${leads.length} · ${inr(sum(leads))}</span></div>
      <div class="list" style="padding:0">${leads.length ? leads.map(leadCard).join('') : '<p style="font-size:13px;color:var(--text-3);margin:0">None yet. Tap "New lead" to add one with this dealer as the source.</p>'}</div>
    </div>
    ${isAdmin ? `<button class="btn ghost" data-dact="delete" data-id="${esc(d.id)}" style="margin-top:16px;color:var(--danger)">${ICON.trash} Remove dealer</button>` : ''}
  `);
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-dact]');
  if (a) {
    const id = a.dataset.id;
    const d = Store.dealers.find(x => x.id === id);
    if (a.dataset.dact === 'contacted' && d) {
      Store.saveDealer(Object.assign({}, d, { lastContact: todayStr() })); toast('Marked contacted today', 'ok'); openDealerDetail(id); render();
    }
    if (a.dataset.dact === 'edit') { closeSheet(); openDealerForm(id); }
    if (a.dataset.dact === 'newlead' && d) {
      closeSheet(); openForm(null);
      formLead.source = 'DSE/Dealer'; formLead.dealerId = d.id; formLead.sourceName = [d.contact, d.company].filter(Boolean).join(' – ');
      drawForm();
    }
    if (a.dataset.dact === 'delete') {
      if (confirm('Remove this dealer from the directory? Leads keep the dealer name.')) { Store.deleteDealer(id); closeSheet(); toast('Dealer removed', 'ok'); render(); }
    }
    return;
  }
  const c = e.target.closest('.chip[data-f="dtype"]');
  if (c) { dFilters.type = c.dataset.v; renderDealers(); return; }
  const dd = e.target.closest('[data-dealer]');
  if (dd) { e.stopPropagation(); openDealerDetail(dd.dataset.dealer); }
}, true);

function openDealerForm(id) {
  const d = id ? JSON.parse(JSON.stringify(Store.dealers.find(x => x.id === id))) : { company: '', contact: '', type: CFG.DEALER_TYPES[0], location: '', mobile: '', notes: '', lastContact: '' };
  openSheet(`
    <h3>${id ? 'Edit dealer' : 'Add DSE / dealer'}</h3>
    <p class="sub">Dealers and DSEs who send you leads.</p>
    <div class="field"><label>Company / showroom *</label><input id="dCompany" value="${esc(d.company)}" placeholder="e.g. Maruti Arena, Ramgarh"></div>
    <div class="row2">
      <div class="field"><label>Contact person</label><input id="dContact" value="${esc(d.contact)}" placeholder="DSE name"></div>
      <div class="field"><label>Mobile</label><input id="dMobile" type="tel" inputmode="numeric" value="${esc(d.mobile)}" placeholder="10 digits"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Type</label>${sel('dType', CFG.DEALER_TYPES, d.type)}</div>
      <div class="field"><label>Location</label><input id="dLocation" value="${esc(d.location)}" placeholder="Area / road"></div>
    </div>
    <div class="field"><label>Last contacted</label><input id="dLast" type="date" value="${esc(d.lastContact || '')}"></div>
    <div class="field"><label>Notes</label><textarea id="dNotes" rows="2" placeholder="What they sell, who to ask for, commission expectations…">${esc(d.notes)}</textarea></div>
    <button class="btn" id="dSave">Save dealer</button>
  `);
  $('#dSave').onclick = () => {
    const rec = Object.assign(d, {
      company: $('#dCompany').value.trim(), contact: $('#dContact').value.trim(), mobile: $('#dMobile').value.replace(/\s/g, ''),
      type: $('#dType').value, location: $('#dLocation').value.trim(), lastContact: $('#dLast').value, notes: $('#dNotes').value.trim()
    });
    if (!rec.company && !rec.contact) { toast('Enter a company or contact name', 'err'); return; }
    if (rec.mobile && !/^\d{10}$/.test(rec.mobile)) { toast('Mobile should be 10 digits', 'err'); return; }
    Store.saveDealer(rec);
    closeSheet(); toast(id ? 'Dealer updated' : 'Dealer added', 'ok');
    if (current !== 'dealers') go('dealers'); else render();
  };
}

/* ============================================================
   MORE
   ============================================================ */
function renderMore() {
  const u = Store.user || {};
  $('#moreAvatar').textContent = initials(u.name);
  $('#moreName').textContent = u.name || '—';
  $('#moreRole').textContent = (u.role || 'Staff') + ' · @' + (u.username || '');
  $('#verLabel').textContent = CFG.APP_NAME + ' v' + CFG.VERSION +
    (Store.lastSync ? ' · synced ' + prettyTime(Store.lastSync) : '');

  const isAdmin = u.role === 'Admin';
  const dark = document.documentElement.dataset.theme === 'dark';
  const items = [
    { k: 'sync', i: ICON.cloud, t: 'Sync now', s: Store.queue.length ? Store.queue.length + ' pending change(s)' : 'Everything is up to date' },
    { k: 'export', i: ICON.down, t: 'Export CSV', s: 'Download the leads currently on screen' },
    { k: 'dealers', i: ICON.store, t: 'DSE & Dealers', s: Store.dealers.length + ' contacts · car, CV, tractor dealers' },
    isAdmin ? { k: 'products', i: ICON.box, t: 'Products & groups', s: (Store.settings.products || []).length + ' products in ' + (Store.settings.groups || []).length + ' groups' } : null,
    isAdmin ? { k: 'stages', i: ICON.flow, t: 'Pipeline stages', s: (Store.settings.stages || []).length + ' stages' } : null,
    isAdmin ? { k: 'staff', i: ICON.users, t: 'Logins & PINs', s: Store.users.length + ' login' + (Store.users.length === 1 ? '' : 's') } : null,
    { k: 'pin', i: ICON.key, t: 'Change my PIN', s: 'Keep your account secure' },
    { k: 'theme', i: ICON.moon, t: 'Dark mode', s: dark ? 'On' : 'Follows your phone', toggle: dark },
    isAdmin ? { k: 'sheet', i: ICON.sheet, t: 'Open Google Sheet', s: 'The database behind this app' } : null
  ].filter(Boolean);

  $('#moreMenu').innerHTML = items.map(it => `
    <button class="listrow" data-more="${it.k}" style="width:100%">
      <div class="ic">${it.i}</div>
      <div class="tx"><b>${esc(it.t)}</b><span>${esc(it.s)}</span></div>
      ${it.toggle === undefined ? `<span class="arrow">${ICON.chev}</span>` : `<span class="switch${it.toggle ? ' on' : ''}"></span>`}
    </button>`).join('');
}

document.addEventListener('click', async e => {
  const m = e.target.closest('[data-more]'); if (!m) return;
  const k = m.dataset.more;
  if (k === 'sync') { await doSync(); }
  if (k === 'export') exportCSV();
  if (k === 'dealers') go('dealers');
  if (k === 'products') editProducts();
  if (k === 'stages') editStages();
  if (k === 'staff') editStaff();
  if (k === 'pin') changePin();
  if (k === 'sheet') window.open(CFG.SHEET_URL, '_blank');
  if (k === 'theme') {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem(LS.THEME, dark ? 'light' : 'dark'); } catch (err) {}
    renderMore();
  }
});

/* ---------------- products & groups editor ---------------- */
function editProducts() {
  const s = JSON.parse(JSON.stringify(Store.settings));
  const prodRow = p => `<div class="editrow" data-prow>
      <input class="code" data-code value="${esc(p.code)}" placeholder="Code">
      <input data-name value="${esc(p.name)}" placeholder="Full product name">
      <button class="del">${ICON.trash}</button></div>`;
  openSheet(`
    <h3>Products & groups</h3>
    <p class="sub">The short code shows on cards; the full name on the proposal.</p>
    <div id="prodEdit">
      ${s.groups.map(g => `<details class="acc" open><summary><span><i class="cd" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${gColor(g)};margin-right:8px"></i>${esc(g)}</span></summary><div class="acc-body">
        <div class="editlist" data-g="${esc(g)}">${s.products.filter(p => p.group === g).map(prodRow).join('')}</div>
        <button class="btn ghost sm" data-addp="${esc(g)}">+ Add product</button>
        <button class="btn ghost sm" data-delg="${esc(g)}" style="margin-left:8px;color:var(--danger)">Remove group</button>
      </div></details>`).join('')}
      <button class="btn ghost sm" id="addGroup">+ Add group</button>
    </div>
    <button class="btn" id="saveProd" style="margin-top:16px">Save changes</button>
  `);

  $('#sheetBody').onclick = ev => {
    const del = ev.target.closest('.del'); if (del) { del.closest('.editrow').remove(); return; }
    const add = ev.target.closest('[data-addp]');
    if (add) {
      const list = $(`.editlist[data-g="${CSS.escape(add.dataset.addp)}"]`);
      list.insertAdjacentHTML('beforeend', prodRow({ code: '', name: '' }));
      list.lastElementChild.querySelector('input').focus(); return;
    }
    const dg = ev.target.closest('[data-delg]');
    if (dg) {
      const g = dg.dataset.delg;
      if (Store.leads.some(l => (l.group || Store.groupOf(l.product)) === g)) { toast('Group has leads — move them first', 'err'); return; }
      if (confirm('Remove group "' + g + '" and its products?')) dg.closest('details').remove();
      return;
    }
    if (ev.target.closest('#addGroup')) {
      const g = prompt('New group name:'); if (!g || !g.trim()) return;
      const name = g.trim();
      $('#addGroup').insertAdjacentHTML('beforebegin', `<details class="acc" open><summary>${esc(name)}</summary><div class="acc-body">
        <div class="editlist" data-g="${esc(name)}">${prodRow({ code: '', name: '' })}</div>
        <button class="btn ghost sm" data-addp="${esc(name)}">+ Add product</button>
        <button class="btn ghost sm" data-delg="${esc(name)}" style="margin-left:8px;color:var(--danger)">Remove group</button>
      </div></details>`);
    }
  };

  $('#saveProd').onclick = () => {
    const groups = [], products = [];
    $$('#prodEdit .editlist[data-g]').forEach(list => {
      const g = list.dataset.g; groups.push(g);
      list.querySelectorAll('[data-prow]').forEach(r => {
        const code = r.querySelector('[data-code]').value.trim(), name = r.querySelector('[data-name]').value.trim();
        if (code) products.push({ code, name: name || code, group: g });
      });
    });
    if (!products.length) { toast('Keep at least one product', 'err'); return; }
    s.groups = groups; s.products = products;
    Store.saveSettings(s);
    closeSheet(); toast('Products saved', 'ok'); render();
  };
}

/* ---------------- stages editor ---------------- */
function editStages() {
  const s = JSON.parse(JSON.stringify(Store.settings));
  const phases = [['branch', 'With branch'], ['ro', 'At RO'], ['sanctioned', 'Sanctioned'], ['done', 'Disbursed'], ['lost', 'Closed / lost']];
  const row = st => `<div class="editrow" data-srow data-datekey="${esc(st.dateKey || '')}">
      <input data-sname value="${esc(st.name)}" placeholder="Stage name">
      <select data-sphase>${phases.map(([v, t]) => `<option value="${v}"${st.phase === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <button class="del">${ICON.trash}</button></div>`;
  openSheet(`
    <h3>Pipeline stages</h3>
    <p class="sub">In order, top to bottom. The phase tells the dashboard who is responsible.</p>
    <div class="editlist" id="stageEdit">${s.stages.map(row).join('')}</div>
    <button class="btn ghost sm" id="addStage">+ Add stage</button>
    <button class="btn" id="saveStages" style="margin-top:16px">Save stages</button>
  `);
  $('#sheetBody').onclick = ev => {
    const del = ev.target.closest('.del');
    if (del) {
      const name = del.closest('.editrow').querySelector('[data-sname]').value;
      if (Store.leads.some(l => l.stage === name)) { toast('Leads are in this stage — move them first', 'err'); return; }
      del.closest('.editrow').remove(); return;
    }
    if (ev.target.closest('#addStage')) $('#stageEdit').insertAdjacentHTML('beforeend', row({ name: '', phase: 'branch', dateKey: '' }));
  };
  $('#saveStages').onclick = () => {
    const out = $$('#stageEdit [data-srow]').map(r => ({
      name: r.querySelector('[data-sname]').value.trim(),
      phase: r.querySelector('[data-sphase]').value,
      dateKey: r.dataset.datekey || ''
    })).filter(x => x.name);
    if (!out.length) { toast('Keep at least one stage', 'err'); return; }
    // renamed stages: save the new list first, then carry leads along (their days-in-stage are kept)
    const oldNames = s.stages.map(x => x.name);
    s.stages = out;
    Store.saveSettings(s);
    out.forEach((st, i) => { if (oldNames[i] && oldNames[i] !== st.name && !oldNames.includes(st.name)) {
      Store.leads.filter(l => l.stage === oldNames[i]).forEach(l => { l.stage = st.name; Store.enqueue('saveLead', { lead: l }); });
    } });
    closeSheet(); toast('Stages saved', 'ok'); render();
  };
}

/* ---------------- staff editor ---------------- */
function editStaff() {
  const users = JSON.parse(JSON.stringify(Store.users));
  const baseline = users.map(u => u.username);
  openSheet(`
    <h3>Logins & PINs</h3>
    <p class="sub">Usernames that can open this app. Keep at least one Admin. A PIN you set here is temporary — the person must choose their own the first time they sign in.</p>
    <div id="staffList">${users.map(u => staffRow(u, false)).join('')}</div>
    <button class="btn ghost sm" id="addStaff" style="margin-top:6px">+ Add login</button>
    <button class="btn" id="saveStaff" style="margin-top:14px">Save logins</button>
  `);
  $('#addStaff').onclick = () => $('#staffList').insertAdjacentHTML('beforeend',
    staffRow({ username: '', name: '', role: 'Staff', active: true }, true));
  $('#staffList').addEventListener('click', ev => {
    const d = ev.target.closest('.del');
    if (d) {
      const un = d.closest('.card').querySelector('[data-u]').value.trim().toLowerCase();
      if (un && un === (Store.user || {}).username) { toast('You cannot remove your own login', 'err'); return; }
      d.closest('.card').remove();
    }
    const sw = ev.target.closest('.switch'); if (sw) sw.classList.toggle('on');
  });
  $('#saveStaff').onclick = () => {
    const out = [];
    for (const c of $$('#staffList .card')) {
      const u = {
        username: c.querySelector('[data-u]').value.trim().toLowerCase(),
        name: c.querySelector('[data-n]').value.trim(),
        pin: c.querySelector('[data-p]').value.trim(),
        role: c.querySelector('[data-r]').value,
        active: c.querySelector('.switch').classList.contains('on'),
        isNew: c.dataset.new === '1'
      };
      if (!u.username && !u.name) continue;
      if (!u.username || !u.name) { toast('Every login needs a name and a username', 'err'); return; }
      if (!/^[a-z0-9._-]+$/.test(u.username)) { toast('Username "' + u.username + '": letters and numbers only', 'err'); return; }
      if (u.isNew && !u.pin) { toast('Set a temporary PIN for ' + u.name, 'err'); return; }
      if (u.pin && !/^\d{4,6}$/.test(u.pin)) { toast('PIN for ' + u.name + ' must be 4-6 digits', 'err'); return; }
      if (out.some(x => x.username === u.username)) { toast('Username "' + u.username + '" is used twice', 'err'); return; }
      out.push(u);
    }
    if (!out.some(u => u.role === 'Admin' && u.active)) { toast('Keep at least one active Admin', 'err'); return; }
    Store.saveUsers(out, baseline);
    closeSheet(); toast('Logins saved', 'ok'); render();
  };
}
function staffRow(u, isNew) {
  return `<div class="card" style="margin-bottom:10px" data-new="${isNew ? 1 : 0}">
    <div class="row2">
      <div class="field" style="margin-bottom:8px"><label>Name</label><input data-n value="${esc(u.name)}"></div>
      <div class="field" style="margin-bottom:8px"><label>Username</label><input data-u value="${esc(u.username)}" autocapitalize="none" ${isNew ? '' : 'readonly'}></div>
    </div>
    <div class="row2">
      <div class="field" style="margin-bottom:8px"><label>${isNew ? 'Temporary PIN' : 'Reset PIN'}</label><input data-p inputmode="numeric" maxlength="6" placeholder="${isNew ? '4-6 digits' : 'Leave blank to keep'}"></div>
      <div class="field" style="margin-bottom:8px"><label>Role</label>
        <select data-r><option${u.role !== 'Admin' ? ' selected' : ''}>Staff</option><option${u.role === 'Admin' ? ' selected' : ''}>Admin</option></select></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:13px;color:var(--text-2);flex:1">Active${u.mustChangePin ? ' · <em>has a temporary PIN</em>' : ''}</span>
      <span class="switch${u.active !== false ? ' on' : ''}"></span>
      <button class="del" style="width:36px;height:36px;border-radius:11px;background:var(--surface-2);color:var(--danger);display:grid;place-items:center">${ICON.trash}</button>
    </div>
  </div>`;
}

/* ---------------- change PIN ---------------- */
// forcedOld: set when signing in with a temporary PIN — the sheet cannot be dismissed.
function changePin(forcedOld) {
  const forced = typeof forcedOld === 'string';
  openSheet(`
    <h3>${forced ? 'Choose your own PIN' : 'Change PIN'}</h3>
    <p class="sub">${forced ? 'You signed in with a temporary PIN. Pick a new 4 to 6 digit PIN to continue.' : 'Use 4 to 6 digits.'}</p>
    ${forced ? '' : '<div class="field"><label>Current PIN</label><input id="pOld" inputmode="numeric" type="password"></div>'}
    <div class="field"><label>New PIN</label><input id="pNew" inputmode="numeric" type="password" maxlength="6"></div>
    <div class="field"><label>Confirm new PIN</label><input id="pNew2" inputmode="numeric" type="password" maxlength="6"></div>
    <button class="btn" id="pSave">Update PIN</button>
  `, forced);
  $('#pSave').onclick = async () => {
    const o = forced ? forcedOld : $('#pOld').value.trim(), n = $('#pNew').value.trim(), n2 = $('#pNew2').value.trim();
    if (!/^\d{4,6}$/.test(n)) { toast('PIN must be 4-6 digits', 'err'); return; }
    if (n !== n2) { toast('New PINs do not match', 'err'); return; }
    if (n === o) { toast('Pick a PIN different from the old one', 'err'); return; }
    try {
      const r = await Store.api('changePin', { oldPin: o, newPin: n });
      if (r.ok) {
        if (r.token) Store.setSession(r.token, Store.user);
        closeSheet(); toast('PIN updated', 'ok');
      }
      else toast(r.message || 'Could not update PIN', 'err');
    } catch (err) {
      if (String(err.message) === 'SESSION_EXPIRED') { closeSheet(); showLogin(); toast('Session expired, sign in again', 'err'); }
      else toast('Needs internet connection', 'err');
    }
  };
}

/* ---------------- export ---------------- */
function exportCSV() {
  let rows;
  if (current === 'leads') rows = filteredLeads();
  else if (current === 'chase') rows = Array.from($$('#chaseList [data-lead]')).map(b => Store.leads.find(l => l.id === b.dataset.lead)).filter(Boolean);
  else rows = Store.leads;
  if (!rows.length) { toast('Nothing to export', 'err'); return; }
  const head = ['SR', 'Group', 'Product', 'Name', 'Mobile', 'City', 'Branch', 'Loan Required', 'Project Cost', 'Margin', 'Stage', 'Days in Stage', 'Source', 'DSE/Dealer',
    'Next Followup', 'App Generated', 'Sent to RO', 'Sanctioned', 'Disbursed', 'Income Source', 'Income', 'Per', 'Dependents', 'Earners', 'Residence', 'Locality',
    'Requirement', 'Business', 'Obligations', 'Security', 'Project', 'Remarks'];
  const body = rows.map((l, i) => [i + 1, l.group, Store.productName(l.product), l.name, l.mobile, l.city, l.branch, l.amount, l.projectCost, l.margin, l.stage, Store.isClosed(l) ? '' : ageDays(l),
    l.source, l.sourceName, l.nextFollowupDate, l.appGenDate, l.sentRODate, l.sanctionDate, l.disbDate, l.incomeSource, l.income, l.incomePeriod, l.dependents, l.earners,
    l.residence, l.locality, l.requirement, [l.bizNature, l.bizPlace, l.bizYears ? l.bizYears + ' yrs' : ''].filter(Boolean).join(', '), l.obligations, l.security, l.projectDesc, l.remarks]);
  const csv = [head, ...body].map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'loan-crm-' + todayStr() + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('CSV downloaded', 'ok');
}
$('#exportBtn').addEventListener('click', exportCSV);

/* ============================================================
   SYNC
   ============================================================ */
async function doSync() {
  const btn = $('#syncBtn');
  btn.style.opacity = '.5';
  const r = await Store.sync();
  btn.style.opacity = '';
  if (r.offline) toast('You are offline — will sync later');
  else if (r.ok) {
    if (r.failed && r.failed.length) toast(r.failed[0], 'err');
    else toast(r.pushed ? 'Synced ' + r.pushed + ' change(s)' : 'Up to date', 'ok');
  }
  else if (r.error === 'SESSION_EXPIRED') { showLogin(); toast('Session expired, sign in again', 'err'); }
  else if (!r.skipped) toast(r.error || 'Sync failed', 'err');
  render();
}
$('#syncBtn').addEventListener('click', doSync);
window.addEventListener('online', () => { toast('Back online — syncing'); doSync(); });
window.addEventListener('offline', () => { toast('Offline — changes saved on this phone'); render(); });

/* ============================================================
   BOOT
   ============================================================ */
function render() {
  if (current === 'home') renderHome();
  if (current === 'leads') renderLeads();
  if (current === 'chase') renderChase();
  if (current === 'dealers') renderDealers();
  if (current === 'more') renderMore();
}
Store.on(() => { if (!$('#app').classList.contains('hidden')) render(); });

function showLogin() {
  $('#login').classList.remove('hidden');
  $('#app').classList.add('hidden');
}

async function enterApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  go('home');
  const r = await Store.sync();
  if (r.error === 'SESSION_EXPIRED') { showLogin(); toast('Session expired, sign in again', 'err'); return; }
  render();
}

$('#logoutBtn').addEventListener('click', () => {
  if (Store.queue.length && !confirm('You have unsynced changes. Sign out anyway?')) return;
  Store.clearSession();
  showLogin();
});

(function boot() {
  try {
    const th = localStorage.getItem(LS.THEME);
    if (th) document.documentElement.dataset.theme = th;
  } catch (e) {}

  Store.load();
  renderPinpad();

  if (Store.token && Store.user) enterApp();
  else showLogin();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  // Push pending changes and pull everyone else's every minute while the app is open.
  const bgSync = async () => {
    if (!Store.token || !navigator.onLine || document.hidden) return;
    const r = await Store.sync({ silent: true });
    if (r.error === 'SESSION_EXPIRED') { showLogin(); toast('Session expired, sign in again', 'err'); }
  };
  setInterval(bgSync, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) bgSync(); });
})();

})();
