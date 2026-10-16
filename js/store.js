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
    return CFG.DEMO_MODE || (CFG.API_URL && CFG.API_URL.indexOf('PASTE_YOUR') === -1);
  },

  async api(action, payload = {}) {
    if (CFG.DEMO_MODE) return Demo.handle(action, payload);
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
    return r.user;
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
    if (!lead.leadBy || this.user.role !== 'Admin') {
      lead.leadBy = (prev && prev.leadBy) || lead.leadBy || this.user.name;
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

  saveUsers(users) {
    this.users = users;
    this.enqueue('saveUsers', { users });
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
    return !lead.leadBy || lead.leadBy === this.user.name;
  },

  followupsFor(leadId) {
    return this.followups
      .filter(f => f.leadId === leadId)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
};

/* ============================================================
   DEMO MODE — lets you click through the app with no backend.
   Same sample leads as apps-script/Seed.gs.
   ============================================================ */
const Demo = {
  key: 'loan_demo_db',
  db() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.key) || 'null'); } catch (e) {}
    if (!d || d.v !== 4) { d = this.seed(); this.save(d); }
    return d;
  },
  save(d) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) {} },
  seed() {
    const d = n => { const t = new Date(); t.setDate(t.getDate() + n); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
    const ago = n => new Date(Date.now() - n * 86400000).toISOString();
    const base = (o) => Object.assign({
      branch: CFG.BRANCH_NAME, city: '', sourceName: '', dealerId: '', remarks: '', nextFollowupDate: '',
      appGenDate: '', sentRODate: '', sanctionDate: '', disbDate: '',
      incomeSource: '', income: 0, incomePeriod: 'Monthly', dependents: 0, earners: 0, familyNote: '',
      residence: '', locality: '', resYears: 0, requirement: '', bizNature: '', bizPlace: '', bizYears: 0,
      obligations: '', security: '', projectCost: 0, margin: 0, projectDesc: '', amount: 0,
      createdAt: ago(20), updatedAt: ago(1)
    }, o, { createdBy: o.leadBy, amount: o.projectCost > 0 ? o.projectCost - o.margin : (o.amount || 0) });

    return {
      v: 4,
      dealers: [
        { id: 'SD1', company: 'Maruti Arena, Ramgarh', contact: 'Vikas Kumar', type: 'Car', location: 'Hazaribagh Road, Ramgarh', mobile: '9876500001', notes: 'Handles Brezza / Dzire enquiries. Prefers WhatsApp.', lastContact: d(-3), addedBy: 'Anmol', createdAt: ago(60), updatedAt: ago(3) },
        { id: 'SD2', company: 'Tata Motors – Hazaribagh Road', contact: 'Ranjit Singh', type: 'Commercial Vehicle', location: 'Ramgarh', mobile: '9876500002', notes: 'Tipper and LPT buyers; coal washery contracts.', lastContact: d(-1), addedBy: 'Anmol', createdAt: ago(60), updatedAt: ago(1) },
        { id: 'SD3', company: 'Hyundai Showroom, Ramgarh', contact: 'Pooja Verma', type: 'Car', location: 'Cantt Road, Ramgarh', mobile: '9876500003', notes: '', lastContact: d(-21), addedBy: 'Anmol', createdAt: ago(50), updatedAt: ago(21) },
        { id: 'SD4', company: 'Mahindra Tractors, Gola', contact: 'Sanjay Mahto', type: 'Tractor', location: 'Gola', mobile: '9876500004', notes: 'Agri term loan referrals.', lastContact: '', addedBy: 'Anmol', createdAt: ago(30), updatedAt: ago(30) }
      ],
      users: [
        { username: 'admin', name: 'Anmol', pin: '1234', role: 'Admin', mobile: '', active: true }
      ],
      settings: {
        groups: ['Retail', 'SME', 'Agri', 'Secured'],
        products: [
          { code: 'HTL', name: 'Home Term Loan', group: 'Retail' },
          { code: 'CAR', name: 'Car Loan', group: 'Retail' },
          { code: 'PTL', name: 'Personal Term Loan', group: 'Retail' },
          { code: 'SME', name: 'SME / Business Loan', group: 'SME' },
          { code: 'GST Plus', name: 'GST Plus (GST-return based)', group: 'SME' },
          { code: 'SRTO', name: 'Small Road Transport Operator Loan', group: 'SME' },
          { code: 'ATL', name: 'Agri Term Loan', group: 'Agri' },
          { code: 'Gold', name: 'Gold Loan', group: 'Secured' },
          { code: 'LATDR', name: 'Loan Against Term Deposit', group: 'Secured' }
        ],
        stages: [
          { name: 'Enquiry', phase: 'branch', dateKey: '' },
          { name: 'Basic Documents Pending', phase: 'branch', dateKey: '' },
          { name: 'Full Documents Pending', phase: 'branch', dateKey: '' },
          { name: 'Application Generated', phase: 'branch', dateKey: 'appGenDate' },
          { name: 'Processing at RO', phase: 'ro', dateKey: 'sentRODate' },
          { name: 'Sanctioned', phase: 'sanctioned', dateKey: 'sanctionDate' },
          { name: 'Disbursed', phase: 'done', dateKey: 'disbDate' },
          { name: 'Rejected', phase: 'lost', dateKey: '' },
          { name: 'Dropped', phase: 'lost', dateKey: '' }
        ]
      },
      leads: [
        base({ id: 'SAMPLE1', group: 'Retail', product: 'HTL', name: 'Rajesh Mahto', mobile: '9431012345', city: 'Ramgarh',
          stage: 'Full Documents Pending', stageSince: d(-18), source: 'Branch', nextFollowupDate: d(-2),
          remarks: 'Sale deed copy and 6-month salary slips still awaited.',
          incomeSource: 'Salaried', income: 45000, incomePeriod: 'Monthly', dependents: 3, earners: 1, familyNote: 'Wife homemaker, two school-going children.',
          residence: 'Rented', locality: 'Marar, Ramgarh', resYears: 6, requirement: 'Buying a ready 2BHK flat near Ramgarh Cantt for own stay.',
          obligations: 'Two-wheeler loan EMI ₹2,800, 8 months left.', security: 'Mortgage of the flat being purchased.',
          projectCost: 2800000, margin: 800000, projectDesc: '2BHK, 950 sq ft, 3rd floor, Shree Residency, Marar. Builder agreement in hand.', leadBy: 'Anmol' }),
        base({ id: 'SAMPLE2', group: 'Retail', product: 'CAR', name: 'Sunita Devi', mobile: '9835567890', city: 'Ramgarh Cantt',
          stage: 'Processing at RO', stageSince: d(-4), source: 'DSE/Dealer', sourceName: 'Vikas Kumar – Maruti Arena, Ramgarh', dealerId: 'SD1', nextFollowupDate: d(3),
          remarks: 'Application sent to RO with dealer quotation.',
          incomeSource: 'Business', income: 60000, incomePeriod: 'Monthly', dependents: 2, earners: 2, familyNote: 'Husband runs a medical store; both earning.',
          residence: 'Owned', locality: 'Cantt Bazaar', resYears: 15, requirement: 'New family car; current vehicle is 12 years old.',
          bizNature: 'Readymade garments shop', bizPlace: 'Cantt Bazaar, Ramgarh', bizYears: 9, obligations: 'None.', security: 'Hypothecation of the car.',
          projectCost: 920000, margin: 150000, projectDesc: 'Maruti Brezza VXi, on-road price ₹9.20 L incl. insurance and registration.',
          appGenDate: d(-6), sentRODate: d(-4), leadBy: 'Anmol' }),
        base({ id: 'SAMPLE3', group: 'SME', product: 'SME', name: 'Mohd Imran', mobile: '7004123456', city: 'Ramgarh',
          stage: 'Sanctioned', stageSince: d(-2), source: 'Branch', nextFollowupDate: d(0),
          remarks: 'Sanctioned ₹11.25 L. Documentation and mortgage creation pending.',
          incomeSource: 'Business', income: 1200000, incomePeriod: 'Annual', dependents: 4, earners: 1, familyNote: 'Joint family; brother helps in the shop.',
          residence: 'Owned', locality: 'Subhash Chowk, Ramgarh', resYears: 20, requirement: 'Expand hardware shop to adjacent unit and add stock.',
          bizNature: 'Hardware & sanitary trading', bizPlace: 'Subhash Chowk, Ramgarh', bizYears: 11, obligations: 'CC limit ₹5 L with another bank, regular.',
          security: 'Shop premises (own) + hypothecation of stock.',
          projectCost: 1500000, margin: 375000, projectDesc: 'Interior work ₹4 L, shelving ₹1.5 L, additional stock ₹9.5 L.',
          appGenDate: d(-14), sentRODate: d(-11), sanctionDate: d(-2), leadBy: 'Anmol' }),
        base({ id: 'SAMPLE4', group: 'Agri', product: 'ATL', name: 'Birsa Oraon', mobile: '9470987654', city: 'Gola',
          stage: 'Basic Documents Pending', stageSince: d(-22), source: 'Other', sourceName: 'Existing KCC customer', nextFollowupDate: d(-5),
          remarks: 'Land records (khatiyan) not yet received from CO office.',
          incomeSource: 'Agriculture', income: 350000, incomePeriod: 'Annual', dependents: 5, earners: 2, familyNote: 'Son works with him on the farm.',
          residence: 'Owned', locality: 'Village Chitarpur, Gola', resYears: 40, requirement: 'Tractor for own 8 acres plus custom hiring in the village.',
          obligations: 'KCC ₹1.2 L with us, regular.', security: 'Hypothecation of tractor; land mortgage if required.',
          projectCost: 450000, margin: 100000, projectDesc: 'Swaraj 735 FE, 40 HP, with trolley. Dealer quotation attached.', leadBy: 'Anmol' }),
        base({ id: 'SAMPLE5', group: 'Secured', product: 'Gold', name: 'Kavita Kumari', mobile: '8210456789', city: 'Ramgarh',
          stage: 'Disbursed', stageSince: d(-6), source: 'Branch', nextFollowupDate: '',
          remarks: 'Disbursed. Suggest SBI Life cross-sell at next visit.',
          incomeSource: 'Mixed', income: 25000, incomePeriod: 'Monthly', dependents: 2, earners: 1,
          residence: 'Owned', locality: 'Nai Sarai, Ramgarh', resYears: 10, requirement: 'Daughter’s college admission fees.',
          bizNature: 'Tailoring from home', bizPlace: 'Nai Sarai', bizYears: 5, obligations: 'None.', security: '42 g gold ornaments, 22 ct.',
          amount: 150000, appGenDate: d(-7), sanctionDate: d(-6), disbDate: d(-6), leadBy: 'Anmol' }),
        base({ id: 'SAMPLE6', group: 'SME', product: 'SRTO', name: 'Santosh Yadav', mobile: '9162345678', city: 'Ramgarh',
          stage: 'Enquiry', stageSince: d(-1), source: 'DSE/Dealer', sourceName: 'Ranjit Singh – Tata Motors – Hazaribagh Road', dealerId: 'SD2', nextFollowupDate: d(0),
          remarks: 'Walked in with dealer quotation. Wants to know margin and EMI.',
          incomeSource: 'Business', income: 40000, incomePeriod: 'Monthly', dependents: 3, earners: 1,
          residence: 'Rented', locality: 'Bijulia, Ramgarh', resYears: 3, requirement: 'Second truck for coal transport contract with a local washery.',
          bizNature: 'Transport (one 12-wheeler already)', bizPlace: 'Ramgarh', bizYears: 4, obligations: 'Existing truck loan EMI ₹38,000, 14 months left.',
          security: 'Hypothecation of the new truck.',
          projectCost: 2200000, margin: 440000, projectDesc: 'Tata LPT 2818 tipper, ex-showroom ₹21 L + body ₹1 L.', leadBy: 'Anmol' })
      ],
      followups: [
        { id: 'SF1', leadId: 'SAMPLE1', at: ago(18), by: 'Anmol', note: 'Builder agreement received. Asked for sale deed copy and salary slips.', stageFrom: 'Basic Documents Pending', stageTo: 'Full Documents Pending', nextDate: '' },
        { id: 'SF2', leadId: 'SAMPLE2', at: ago(4), by: 'Anmol', note: 'Application forwarded to RO Hazaribagh with dealer quotation and ITR.', stageFrom: 'Application Generated', stageTo: 'Processing at RO', nextDate: '' },
        { id: 'SF3', leadId: 'SAMPLE3', at: ago(2), by: 'Anmol', note: 'Sanction letter received from RO. Called customer for documentation.', stageFrom: 'Processing at RO', stageTo: 'Sanctioned', nextDate: '' }
      ]
    };
  },
  async handle(action, p) {
    await new Promise(r => setTimeout(r, 150));
    const db = this.db();
    switch (action) {
      case 'login': {
        const u = db.users.find(x => x.username === String(p.username || '').toLowerCase());
        if (!u) return { ok: false, message: 'User not found.' };
        if (String(u.pin) !== String(p.pin)) return { ok: false, message: 'Incorrect PIN.' };
        return { ok: true, token: 'demo-token', user: { username: u.username, name: u.name, role: u.role } };
      }
      case 'bootstrap': {
        const me = JSON.parse(localStorage.getItem(LS.USER) || 'null') || { name: 'Anmol', role: 'Admin', username: 'admin' };
        return { ok: true, user: me, leads: db.leads, followups: db.followups, users: db.users, dealers: db.dealers || [], settings: db.settings };
      }
      case 'saveLead': {
        const i = db.leads.findIndex(l => l.id === p.lead.id);
        if (i >= 0) db.leads[i] = Object.assign({}, db.leads[i], p.lead); else db.leads.unshift(p.lead);
        this.save(db); return { ok: true, lead: p.lead };
      }
      case 'deleteLead':
        db.leads = db.leads.filter(l => l.id !== p.id); this.save(db); return { ok: true };
      case 'addFollowup': {
        db.followups.push(p.followup);
        const l = db.leads.find(x => x.id === p.followup.leadId);
        if (l) {
          if (p.followup.note) l.remarks = p.followup.note;
          l.nextFollowupDate = p.followup.nextDate || '';
          if (p.followup.stageTo && p.followup.stageTo !== l.stage) {
            l.stage = p.followup.stageTo; l.stageSince = todayISO();
            const s = (db.settings.stages || []).find(x => x.name === l.stage);
            if (s && s.dateKey && !l[s.dateKey]) l[s.dateKey] = todayISO();
          }
        }
        this.save(db); return { ok: true };
      }
      case 'saveDealer': {
        db.dealers = db.dealers || [];
        const i = db.dealers.findIndex(x => x.id === p.dealer.id);
        if (i >= 0) db.dealers[i] = Object.assign({}, db.dealers[i], p.dealer); else db.dealers.unshift(p.dealer);
        this.save(db); return { ok: true };
      }
      case 'deleteDealer': db.dealers = (db.dealers || []).filter(x => x.id !== p.id); this.save(db); return { ok: true };
      case 'saveSettings': db.settings = p.settings; this.save(db); return { ok: true };
      case 'saveUsers': db.users = p.users; this.save(db); return { ok: true };
      case 'changePin': {
        const me = JSON.parse(localStorage.getItem(LS.USER) || 'null');
        const u = me && db.users.find(x => x.username === me.username);
        if (!u || String(u.pin) !== String(p.oldPin)) return { ok: false, message: 'Current PIN is incorrect.' };
        u.pin = String(p.newPin); this.save(db); return { ok: true };
      }
      default: return { ok: true };
    }
  }
};

window.Store = Store;
window.LS = LS;
