/* ============================================================
   Loan CRM — data layer
   State, Google Sheets API calls, and the offline write queue.
   ============================================================ */

const CFG = window.LOAN_CONFIG;
const LS = {
  TOKEN: 'loan_token',
  USER:  'loan_user',
  CACHE: 'loan_cache',
  QUEUE: 'loan_queue',
  THEME: 'loan_theme'
};

const todayISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const Store = {
  token: null,
  user: null,
  leads: [],
  followups: [],
  users: [],
  dealers: [],
  settings: { groups: [], products: [], stages: [] },
  queue: [],
  syncing: false,
  lastSync: null,
  listeners: [],

  /* ---------------- persistence ---------------- */
  on(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); },

  load() {
    try { this.token = localStorage.getItem(LS.TOKEN); } catch (e) {}
    try { this.user = JSON.parse(localStorage.getItem(LS.USER) || 'null'); } catch (e) {}
    try {
      const c = JSON.parse(localStorage.getItem(LS.CACHE) || 'null');
      if (c) {
        this.leads = c.leads || [];
        this.followups = c.followups || [];
        this.users = c.users || [];
        this.dealers = c.dealers || [];
        this.settings = c.settings || this.settings;
        this.lastSync = c.lastSync || null;
      }
    } catch (e) {}
    try { this.queue = JSON.parse(localStorage.getItem(LS.QUEUE) || '[]'); } catch (e) { this.queue = []; }
  },

  persist() {
    try {
      localStorage.setItem(LS.CACHE, JSON.stringify({
        leads: this.leads, followups: this.followups,
        users: this.users, dealers: this.dealers, settings: this.settings, lastSync: this.lastSync
      }));
      localStorage.setItem(LS.QUEUE, JSON.stringify(this.queue));
    } catch (e) { console.warn('cache write failed', e); }
  },

  setSession(token, user) {
    this.token = token; this.user = user;
    try {
      localStorage.setItem(LS.TOKEN, token);
      localStorage.setItem(LS.USER, JSON.stringify(user));
    } catch (e) {}
  },

  clearSession() {
    this.token = null; this.user = null;
    this.leads = []; this.followups = []; this.users = []; this.dealers = []; this.queue = [];
    try { [LS.TOKEN, LS.USER, LS.CACHE, LS.QUEUE].forEach(k => localStorage.removeItem(k)); } catch (e) {}
  },

  /* ---------------- transport ---------------- */
  configured() {
    return !!(CFG.API_URL && CFG.API_URL.indexOf('PASTE_YOUR') === -1);
  },

  async api(action, payload = {}) {
    if (!this.configured()) throw new Error('API_URL is not set in js/config.js');

    const res = await fetch(CFG.API_URL, {
      method: 'POST',
      // text/plain keeps this a "simple request" so the browser skips
      // the CORS preflight that Apps Script cannot answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action, token: this.token }, payload)),
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('Server responded ' + res.status);
    const data = await res.json();
    if (data && data.error === 'AUTH') { this.clearSession(); throw new Error('SESSION_EXPIRED'); }
    return data;
  },

  /* ---------------- auth ---------------- */
  async login(username, pin) {
    const r = await this.api('login', { username, pin });
    if (!r.ok) throw new Error(r.message || 'Login failed');
    this.setSession(r.token, r.user);
    return r;
  },

  /* ---------------- sync ---------------- */
  async pull() {
    const r = await this.api('bootstrap');
    if (!r.ok) throw new Error(r.message || 'Could not load data');
    this.leads = r.leads || [];
    this.followups = r.followups || [];
    this.users = r.users || [];
    this.dealers = r.dealers || [];
    this.settings = r.settings || this.settings;
    if (r.user) this.setSession(this.token, r.user);
    this.lastSync = new Date().toISOString();
    this.persist();
    this.emit();
    return r;
  },

  enqueue(action, payload) {
    this.queue.push({ id: 'q' + Date.now() + Math.random().toString(36).slice(2, 6), action, payload, at: Date.now() });
    this.persist();
    this.emit();
  },

  async sync({ silent = false } = {}) {
    if (this.syncing || !this.token) return { ok: false, skipped: true };
    if (!navigator.onLine) return { ok: false, offline: true };
    this.syncing = true; this.emit();
    let pushed = 0, failed = [];
    try {
      while (this.queue.length) {
        const job = this.queue[0];
        try {
          const r = await this.api(job.action, job.payload);
          if (r && r.ok === false && r.error !== 'AUTH') failed.push(r.message || 'Rejected');
          this.queue.shift(); pushed++;
          this.persist();
        } catch (err) {
          if (String(err.message) === 'SESSION_EXPIRED') throw err;
          break; // still offline / transient — keep the job for later
        }
      }
      await this.pull();
      return { ok: true, pushed, failed };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      this.syncing = false; this.emit();
    }
  },

  /* ---------------- settings helpers ---------------- */
  stageDef(name) { return (this.settings.stages || []).find(s => s.name === name) || null; },
  phaseOf(lead) { const s = this.stageDef(lead.stage); return s ? s.phase : 'branch'; },
  isClosed(lead) { const p = this.phaseOf(lead); return p === 'done' || p === 'lost'; },
  stageNames() { return (this.settings.stages || []).map(s => s.name); },
  productDef(code) { return (this.settings.products || []).find(p => p.code === code) || null; },
  productName(code) { const p = this.productDef(code); return p ? p.name : code; },
  groupOf(code) { const p = this.productDef(code); return p ? p.group : ''; },
  productsIn(group) { return (this.settings.products || []).filter(p => p.group === group); },

  // Fill the stage date for the stage the lead is in, if blank. Same rule as the server.
  stampStage(lead, prevStage) {
    if (prevStage !== lead.stage || !lead.stageSince) lead.stageSince = todayISO();
    const s = this.stageDef(lead.stage);
    if (s && s.dateKey && !lead[s.dateKey]) lead[s.dateKey] = todayISO();
  },

  /* ---------------- mutations (optimistic) ---------------- */
  saveLead(lead) {
    const now = new Date().toISOString();
    const prev = this.leads.find(l => l.id === lead.id) || null;
    if (!prev) {
      lead.id = lead.id || ('L' + Date.now() + Math.floor(Math.random() * 1000));
      lead.createdAt = now;
      lead.createdBy = this.user.name;
    }
    lead.updatedAt = now;
    // leadBy holds the owner's username
    if (!lead.leadBy || this.user.role !== 'Admin') {
      lead.leadBy = (prev && prev.leadBy) || this.user.username;
    }
    lead.projectCost = Number(lead.projectCost) || 0;
    lead.margin = Number(lead.margin) || 0;
    if (lead.projectCost > 0) lead.amount = Math.max(0, lead.projectCost - lead.margin);
    lead.amount = Number(lead.amount) || 0;
    this.stampStage(lead, prev ? prev.stage : null);

    const i = this.leads.findIndex(l => l.id === lead.id);
    if (i >= 0) this.leads[i] = Object.assign({}, this.leads[i], lead);
    else this.leads.unshift(lead);

    this.enqueue('saveLead', { lead });
    this.persist();
    this.trySync();
    return lead;
  },

  deleteLead(id) {
    this.leads = this.leads.filter(l => l.id !== id);
    this.followups = this.followups.filter(f => f.leadId !== id);
    this.enqueue('deleteLead', { id });
    this.persist(); this.trySync();
  },

  addFollowup(f) {
    const rec = Object.assign({
      id: 'F' + Date.now() + Math.floor(Math.random() * 1000),
      at: new Date().toISOString(),
      by: this.user.name
    }, f);
    this.followups.push(rec);

    const lead = this.leads.find(l => l.id === rec.leadId);
    if (lead) {
      if (rec.note) lead.remarks = rec.note;
      lead.nextFollowupDate = rec.nextDate || '';
      if (rec.stageTo && rec.stageTo !== lead.stage) {
        const prevStage = lead.stage;
        lead.stage = rec.stageTo;
        this.stampStage(lead, prevStage);
      }
      lead.updatedAt = rec.at;
    }
    this.enqueue('addFollowup', { followup: rec });
    this.persist(); this.trySync();
    return rec;
  },

  saveDealer(d) {
    const now = new Date().toISOString();
    if (!d.id) { d.id = 'D' + Date.now() + Math.floor(Math.random() * 1000); d.createdAt = now; d.addedBy = this.user.name; }
    d.updatedAt = now;
    const i = this.dealers.findIndex(x => x.id === d.id);
    if (i >= 0) this.dealers[i] = Object.assign({}, this.dealers[i], d); else this.dealers.unshift(d);
    this.enqueue('saveDealer', { dealer: d });
    this.persist(); this.trySync();
    return d;
  },

  deleteDealer(id) {
    this.dealers = this.dealers.filter(x => x.id !== id);
    this.enqueue('deleteDealer', { id });
    this.persist(); this.trySync();
  },

  dealerOf(lead) { return lead.dealerId ? this.dealers.find(d => d.id === lead.dealerId) : null; },
  leadsForDealer(id) { return this.leads.filter(l => l.dealerId === id); },

  saveSettings(settings) {
    this.settings = settings;
    this.enqueue('saveSettings', { settings });
    this.persist(); this.trySync();
  },

  // baseline = usernames this phone knew about, so the server only removes
  // logins the Admin actually deleted here, never ones added elsewhere meanwhile.
  saveUsers(users, baseline) {
    this.users = users.map(u => Object.assign({}, u, { pin: undefined }));
    this.enqueue('saveUsers', { users, baseline });
    this.persist(); this.trySync();
  },

  trySync() {
    clearTimeout(this._t);
    this._t = setTimeout(() => this.sync({ silent: true }).then(() => this.emit()), 600);
  },

  /* ---------------- derived ---------------- */
  canEdit(lead) {
    if (!this.user) return false;
    if (this.user.role === 'Admin') return true;
    return this.isOwner(lead, this.user);
  },

  // Older rows may hold the owner's display name instead of the username.
  isOwner(lead, u) {
    const o = String(lead.leadBy || '');
    return !o || o === u.username || o === u.name;
  },

  ownerName(lead) {
    const o = String(lead.leadBy || '');
    const u = this.users.find(x => x.username === o || x.name === o);
    return u ? u.name : o;
  },

  followupsFor(leadId) {
    return this.followups
      .filter(f => f.leadId === leadId)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
};

window.Store = Store;
window.LS = LS;
