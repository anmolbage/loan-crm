/**
 * Loan CRM — Google Apps Script backend
 * Database: Google Sheets
 *
 * SETUP
 * 1. Open your Google Sheet -> Extensions -> Apps Script
 * 2. Delete everything, paste this file, Save.
 * 3. Run the function `setup` once and approve permissions.
 *    It creates the tabs and an `admin` login with a random temporary
 *    PIN, written in the Users tab. You choose your own PIN at first sign-in.
 * 4. Deploy -> New deployment -> type "Web app"
 *      Execute as: Me
 *      Who has access: Anyone
 *    Copy the /exec URL into js/config.js of the web app.
 *
 * PINs: a PIN typed into the Users tab by hand (plain digits) is treated as
 * temporary — it works once and the person must then pick their own, which
 * is stored only as a salted hash.
 */

// ============================================================ CONFIG
var SHEET_ID = '1Q5o8u2aVCYHx-rIdjCxK7upGORchQ2mBDW_6gZD5im8';
var TOKEN_TTL_DAYS = 30;
var MAX_PIN_TRIES = 5;          // wrong PINs in a row before a login is locked
var LOCK_MINUTES = 15;          // ...for this long

var TABS = {
  LEADS: 'Leads',
  USERS: 'Users',
  FOLLOWUPS: 'Followups',
  SETTINGS: 'Settings',
  DEALERS: 'Dealers',
  LOG: 'ActivityLog'
};

// One column per field so the Sheet stays readable and filterable.
var LEAD_COLS = [
  'id', 'createdAt', 'updatedAt',
  'group', 'product', 'name', 'mobile', 'city', 'branch',
  'amount', 'stage', 'stageSince', 'source', 'sourceName', 'dealerId',
  'nextFollowupDate', 'remarks',
  'appGenDate', 'sentRODate', 'sanctionDate', 'disbDate',
  'incomeSource', 'income', 'incomePeriod',
  'dependents', 'earners', 'familyNote',
  'residence', 'locality', 'resYears',
  'requirement', 'bizNature', 'bizPlace', 'bizYears',
  'obligations', 'security',
  'projectCost', 'margin', 'projectDesc',
  'leadBy', 'createdBy', 'deleted'
];
var NUM_COLS = ['amount', 'income', 'dependents', 'earners', 'resYears', 'bizYears', 'projectCost', 'margin'];
var DATE_COLS = ['stageSince', 'nextFollowupDate', 'appGenDate', 'sentRODate', 'sanctionDate', 'disbDate'];

var USER_COLS = ['username', 'name', 'pin', 'role', 'mobile', 'active'];
var DEALER_COLS = ['id', 'createdAt', 'updatedAt', 'company', 'contact', 'type', 'location', 'mobile', 'notes', 'lastContact', 'addedBy', 'deleted'];
var FOLLOWUP_COLS = ['id', 'leadId', 'at', 'by', 'note', 'stageFrom', 'stageTo', 'nextDate'];
var SETTING_COLS = ['key', 'value'];
var LOG_COLS = ['at', 'by', 'action', 'entity', 'entityId', 'detail'];

// ============================================================ DEFAULTS
function defaultSettings_() {
  return {
    groups: ['Retail', 'SME', 'Agri', 'Secured'],
    products: [
      { code: 'HTL',      name: 'Home Term Loan',                    group: 'Retail' },
      { code: 'CAR',      name: 'Car Loan',                          group: 'Retail' },
      { code: 'PTL',      name: 'Personal Term Loan',                group: 'Retail' },
      { code: 'SME',      name: 'SME / Business Loan',               group: 'SME' },
      { code: 'GST Plus', name: 'GST Plus (GST-return based)',       group: 'SME' },
      { code: 'SRTO',     name: 'Small Road Transport Operator Loan', group: 'SME' },
      { code: 'ATL',      name: 'Agri Term Loan',                    group: 'Agri' },
      { code: 'Gold',     name: 'Gold Loan',                         group: 'Secured' },
      { code: 'LATDR',    name: 'Loan Against Term Deposit',         group: 'Secured' },
      { code: 'BT',       name: 'Loan Takeover / Balance Transfer',  group: 'Secured' }
    ],
    // phase: branch = with your team | ro = waiting on Regional Office |
    //        sanctioned = sanctioned, disbursement pending | done = disbursed | lost = closed without disbursement
    // dateKey: which date column gets stamped when a lead enters that stage
    stages: [
      { name: 'Prospect',                phase: 'branch',     dateKey: '' },  // shortlisted, not pitched yet
      { name: 'Enquiry',                 phase: 'branch',     dateKey: '' },
      { name: 'Basic Documents Pending', phase: 'branch',     dateKey: '' },
      { name: 'Full Documents Pending',  phase: 'branch',     dateKey: '' },
      { name: 'Application Generated',   phase: 'branch',     dateKey: 'appGenDate' },
      { name: 'Processing at RO',        phase: 'ro',         dateKey: 'sentRODate' },
      { name: 'Sanctioned',              phase: 'sanctioned', dateKey: 'sanctionDate' },
      { name: 'Disbursed',               phase: 'done',       dateKey: 'disbDate' },
      { name: 'Rejected',                phase: 'lost',       dateKey: '' },
      { name: 'Dropped',                 phase: 'lost',       dateKey: '' }
    ]
  };
}

// The first Admin gets a random temporary PIN (plain digits = temporary).
function defaultUsers_() {
  var pin = String(100000 + Math.floor(Math.random() * 900000));
  return [
    ['admin', 'Anmol', "'" + pin, 'Admin', '', 'TRUE']
  ];
}

// ============================================================ SETUP
function setup() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  ensureTab_(ss, TABS.LEADS, LEAD_COLS);
  ensureTab_(ss, TABS.FOLLOWUPS, FOLLOWUP_COLS);
  ensureTab_(ss, TABS.LOG, LOG_COLS);
  ensureTab_(ss, TABS.DEALERS, DEALER_COLS);

  var users = ensureTab_(ss, TABS.USERS, USER_COLS);
  if (users.getLastRow() < 2) {
    var first = defaultUsers_();
    users.getRange(2, 1, first.length, USER_COLS.length).setValues(first);
    Logger.log('Admin login created. Username: admin   Temporary PIN: ' + String(first[0][2]).replace("'", ''));
  }

  var settings = ensureTab_(ss, TABS.SETTINGS, SETTING_COLS);
  if (settings.getLastRow() < 2) {
    var d = defaultSettings_();
    settings.getRange(2, 1, 3, 2).setValues([
      ['groups', JSON.stringify(d.groups)],
      ['products', JSON.stringify(d.products)],
      ['stages', JSON.stringify(d.stages)]
    ]);
  }

  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && ss.getSheets().length > 1 && s1.getLastRow() === 0) ss.deleteSheet(s1);

  if (!props_().getProperty('SECRET')) {
    props_().setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
  }
  props_().setProperty('SETUP_DONE', '2');
  props_().setProperty('MIGRATION', String(MIGRATIONS.length));
  Logger.log('Setup complete. Your starting PIN is in the Users tab. Now deploy as a Web app.');
  return 'Setup complete. Now deploy as a Web app.';
}

// Runs setup automatically the first time the web app is called, in case it was skipped.
function ensureSetup_() {
  if (props_().getProperty('SETUP_DONE') === '2') return;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { if (props_().getProperty('SETUP_DONE') !== '2') setup(); }
  finally { lock.releaseLock(); }
}

// One-time changes to an existing Sheet, run in order on the next request after an update.
// A fresh setup already has them, so setup() marks them all as done.
var MIGRATIONS = [
  // 1: add the "Prospect" stage (shortlisted, not pitched yet) before Enquiry
  function () {
    var s = readSettings_();
    if (s.stages.some(function (x) { return x.name === 'Prospect'; })) return;
    s.stages.unshift({ name: 'Prospect', phase: 'branch', dateKey: '' });
    writeSettings_(s);
  },
  // 2: add the "BT" product (loan takeover / balance transfer from another bank)
  function () {
    var s = readSettings_();
    if (s.products.some(function (p) { return p.code === 'BT'; })) return;
    if (s.groups.indexOf('Secured') < 0) s.groups.push('Secured');
    s.products.push({ code: 'BT', name: 'Loan Takeover / Balance Transfer', group: 'Secured' });
    writeSettings_(s);
  }
];
function runMigrations_() {
  var done = Number(props_().getProperty('MIGRATION') || 0);
  if (done >= MIGRATIONS.length) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    done = Number(props_().getProperty('MIGRATION') || 0);
    for (var i = done; i < MIGRATIONS.length; i++) {
      MIGRATIONS[i]();
      props_().setProperty('MIGRATION', String(i + 1));
    }
  } finally { lock.releaseLock(); }
}

function ensureTab_(ss, name, cols) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var head = sh.getRange(1, 1, 1, cols.length).getValues()[0];
  if (head.join('|') !== cols.join('|')) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  }
  sh.getRange(1, 1, 1, cols.length)
    .setFontWeight('bold').setBackground('#0f2a4a').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  return sh;
}

function props_() { return PropertiesService.getScriptProperties(); }
// Opening the spreadsheet is slow, so do it once per request (globals reset every run).
var SS_ = null;
function ss_() { return SS_ || (SS_ = SpreadsheetApp.openById(SHEET_ID)); }

// ============================================================ ROUTING
function doGet(e) {
  // Switch reminders on by itself once calendar permission has been granted in the editor
  // (tries at most every 2 minutes until it works).
  if (props_().getProperty('CAL_ON') !== '1' && !CacheService.getScriptCache().get('cal_auto')) {
    CacheService.getScriptCache().put('cal_auto', '1', 120);
    try { setupTasks(); }
    catch (err) { props_().setProperty('CAL_LAST_RESULT', 'setup error: ' + String(err && err.message || err).slice(0, 200)); }
  }
  // Public health check. Counts only — no customer data.
  var p = props_().getProperties();
  return json_({ ok: true, service: 'Loan CRM API', version: 1,
    reminders: { on: p.CAL_ON === '1', kind: 'Google Tasks', tasks: Object.keys(p).filter(function (k) { return k.indexOf('task:') === 0; }).length, lastSync: p.CAL_LAST || null, lastResult: p.CAL_LAST_RESULT || null } });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    var action = req.action;
    ensureSetup_();
    runMigrations_();

    if (action === 'ping') return json_({ ok: true, time: new Date().toISOString() });
    if (action === 'login') return json_(login_(req));

    var user = verifyToken_(req.token);
    if (!user) return json_({ ok: false, error: 'AUTH', message: 'Session expired. Please log in again.' });

    switch (action) {
      case 'bootstrap':    return json_(bootstrap_(user, req.since));
      case 'saveLead':     lock.waitLock(20000); var saved = saveLead_(user, req.lead);
                           return json_(afterLeadWrite_(saved, saved && saved.lead ? saved.lead.id : req.lead && req.lead.id));
      case 'deleteLead':   lock.waitLock(20000); return json_(afterLeadWrite_(deleteLead_(user, req.id), req.id));
      case 'addFollowup':  lock.waitLock(20000); return json_(afterLeadWrite_(addFollowup_(user, req.followup), req.followup && req.followup.leadId));
      case 'saveDealer':   lock.waitLock(20000); return json_(saveDealer_(user, req.dealer));
      case 'deleteDealer': lock.waitLock(20000); return json_(deleteDealer_(user, req.id));
      case 'saveSettings': lock.waitLock(20000); return json_(saveSettings_(user, req.settings));
      case 'saveUsers':    lock.waitLock(20000); return json_(saveUsers_(user, req.users, req.baseline));
      case 'changePin':    lock.waitLock(20000); return json_(changePin_(user, req.oldPin, req.newPin));
      default: return json_({ ok: false, error: 'UNKNOWN_ACTION', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    return json_({ ok: false, error: 'SERVER', message: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================ AUTH
// Stored PIN formats in the Users tab:
//   h1$<salt>$<hash>  — the person's own PIN (salted, keyed hash)
//   plain digits      — temporary PIN set by setup or an Admin; must be changed at sign-in
function hashPin_(pin, salt) {
  var secret = props_().getProperty('SECRET') || 'change-me';
  var raw = Utilities.computeHmacSha256Signature(salt + ':' + String(pin), secret);
  return raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function makePinHash_(pin) {
  var salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  return 'h1$' + salt + '$' + hashPin_(pin, salt);
}
function isTempPin_(stored) { return String(stored || '').indexOf('h1$') !== 0; }
function pinMatches_(stored, pin) {
  stored = String(stored == null ? '' : stored).trim();
  pin = String(pin == null ? '' : pin).trim();
  if (!stored || !pin) return false;
  if (isTempPin_(stored)) return stored === pin;
  var parts = stored.split('$');
  return parts.length === 3 && hashPin_(pin, parts[1]) === parts[2];
}
// Changes whenever the stored PIN changes, so a PIN change signs out every other phone.
function pinVersion_(stored) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(stored || ''));
  return Utilities.base64EncodeWebSafe(raw).slice(0, 10);
}

function findUser_(username) {
  username = String(username || '').trim().toLowerCase();
  var rows = readTab_(TABS.USERS, USER_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].username).trim().toLowerCase() === username) return { row: i + 2, u: rows[i] };
  }
  return null;
}
function publicUser_(u) {
  return { username: String(u.username).trim().toLowerCase(), name: String(u.name || ''), role: u.role === 'Admin' ? 'Admin' : 'Staff' };
}

function login_(req) {
  var username = String(req.username || '').trim().toLowerCase();
  var pin = String(req.pin || '').trim();
  if (!username || !pin) return { ok: false, error: 'BAD_INPUT', message: 'Enter username and PIN.' };

  var cache = CacheService.getScriptCache();
  var key = 'fails_' + username;
  var fails = Number(cache.get(key) || 0);
  if (fails >= MAX_PIN_TRIES) {
    return { ok: false, error: 'LOCKED', message: 'Too many wrong PINs. Try again in ' + LOCK_MINUTES + ' minutes.' };
  }

  var found = findUser_(username);
  if (!found) return { ok: false, error: 'BAD_LOGIN', message: 'Wrong username or PIN.' };
  var u = found.u;
  if (String(u.active).toUpperCase() === 'FALSE') return { ok: false, error: 'DISABLED', message: 'This account is disabled.' };
  if (!pinMatches_(u.pin, pin)) {
    cache.put(key, String(fails + 1), LOCK_MINUTES * 60);
    log_(username, 'login-failed', 'user', username, '');
    var left = MAX_PIN_TRIES - fails - 1;
    return { ok: false, error: 'BAD_LOGIN', message: left > 0 ? 'Wrong username or PIN. ' + left + ' tries left.' : 'Too many wrong PINs. Try again in ' + LOCK_MINUTES + ' minutes.' };
  }
  cache.remove(key);
  var safe = publicUser_(u);
  log_(safe.name, 'login', 'user', safe.username, '');
  return { ok: true, token: makeToken_(safe.username, u.pin), user: safe, mustChangePin: isTempPin_(u.pin) };
}

function makeToken_(username, storedPin) {
  var exp = Date.now() + TOKEN_TTL_DAYS * 86400000;
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify({ n: username, v: pinVersion_(storedPin), e: exp }));
  return payload + '.' + sign_(payload);
}
function sign_(text) {
  var secret = props_().getProperty('SECRET') || 'change-me';
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, secret));
}
// Checks the signature and expiry, then re-reads the Users tab so that a disabled
// login, a role change or a PIN change takes effect on the very next request.
function verifyToken_(token) {
  if (!token) return null;
  var parts = String(token).split('.');
  if (parts.length !== 2) return null;
  if (sign_(parts[0]) !== parts[1]) return null;
  var data;
  try { data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); }
  catch (err) { return null; }
  if (!data || !data.n || !data.e || data.e < Date.now()) return null;
  var found = findUser_(data.n);
  if (!found || String(found.u.active).toUpperCase() === 'FALSE') return null;
  if (pinVersion_(found.u.pin) !== data.v) return null;
  return publicUser_(found.u);
}

function changePin_(user, oldPin, newPin) {
  newPin = String(newPin || '').trim();
  if (!/^\d{4,6}$/.test(newPin)) return { ok: false, message: 'PIN must be 4 to 6 digits.' };
  var found = findUser_(user.username);
  if (!found) return { ok: false, message: 'User not found.' };
  if (!pinMatches_(found.u.pin, oldPin)) return { ok: false, message: 'Current PIN is incorrect.' };
  if (String(oldPin).trim() === newPin) return { ok: false, message: 'Pick a PIN different from the old one.' };
  var stored = makePinHash_(newPin);
  ss_().getSheetByName(TABS.USERS).getRange(found.row, USER_COLS.indexOf('pin') + 1).setValue(stored);
  log_(user.name, 'change-pin', 'user', user.username, '');
  // a fresh token for this phone; every other session for this login is now invalid
  return { ok: true, message: 'PIN updated.', token: makeToken_(user.username, stored) };
}

// Ownership: leadBy holds the owner's username. Older rows may hold the display name.
function isOwner_(user, leadBy) {
  var o = String(leadBy || '');
  return !o || o === user.username || o === user.name;
}

// ============================================================ READ
// since (ISO time from the previous reply's serverTime): send only leads and follow-ups
// changed after it, plus deleted lead ids, so the minute-by-minute sync stays small.
// Without it, everything is sent. Hand edits in the Sheet don't touch updatedAt, so
// the phone does a full load whenever the app is opened.
function bootstrap_(user, since) {
  var cutoff = since ? new Date(since).getTime() - 2 * 60000 : NaN;   // 2 min overlap for clock skew
  var delta = !isNaN(cutoff);
  var changed = function (v) { var t = v instanceof Date ? v.getTime() : new Date(v).getTime(); return isNaN(t) || t >= cutoff; };

  var leads = [], removed = [];
  readTab_(TABS.LEADS, LEAD_COLS).forEach(function (l) {
    if (!l.id) return;
    if (delta && !changed(l.updatedAt)) return;
    if (String(l.deleted).toUpperCase() === 'TRUE') { if (delta) removed.push(String(l.id)); return; }
    leads.push(normalizeLead_(l));
  });

  var followups = readTab_(TABS.FOLLOWUPS, FOLLOWUP_COLS)
    .filter(function (f) { return f.id && (!delta || changed(f.at)); })
    .map(function (f) { f.at = toIso_(f.at); f.nextDate = toDateStr_(f.nextDate); return f; });

  var users = readTab_(TABS.USERS, USER_COLS)
    .filter(function (u) { return u.username; })
    .map(function (u) {
      var o = { username: String(u.username).trim().toLowerCase(), name: u.name, role: u.role === 'Admin' ? 'Admin' : 'Staff', mobile: String(u.mobile || ''), active: String(u.active).toUpperCase() !== 'FALSE' };
      if (user.role === 'Admin') o.mustChangePin = isTempPin_(u.pin);
      return o;
    });

  var dealers = readTab_(TABS.DEALERS, DEALER_COLS)
    .filter(function (d) { return d.id && String(d.deleted).toUpperCase() !== 'TRUE'; })
    .map(function (d) {
      var o = {}; DEALER_COLS.forEach(function (c) { o[c] = d[c] == null ? '' : d[c]; });
      o.mobile = String(d.mobile || ''); o.lastContact = toDateStr_(d.lastContact);
      o.createdAt = toIso_(d.createdAt); o.updatedAt = toIso_(d.updatedAt); delete o.deleted; return o;
    });

  return { ok: true, delta: delta, user: user, leads: leads, removed: removed, followups: followups, users: users, dealers: dealers, settings: readSettings_(), calendar: calStatus_(), serverTime: new Date().toISOString() };
}

function normalizeLead_(l) {
  var out = {};
  LEAD_COLS.forEach(function (c) { out[c] = l[c] == null ? '' : l[c]; });
  NUM_COLS.forEach(function (c) { out[c] = Number(l[c]) || 0; });
  DATE_COLS.forEach(function (c) { out[c] = toDateStr_(l[c]); });
  out.mobile = String(l.mobile || '');
  out.createdAt = toIso_(l.createdAt);
  out.updatedAt = toIso_(l.updatedAt);
  delete out.deleted;
  return out;
}

function readSettings_() {
  var rows = readTab_(TABS.SETTINGS, SETTING_COLS);
  var out = {};
  rows.forEach(function (r) {
    if (!r.key) return;
    try { out[r.key] = JSON.parse(r.value); } catch (e) { out[r.key] = r.value; }
  });
  var d = defaultSettings_();
  if (!out.groups) out.groups = d.groups;
  if (!out.products) out.products = d.products;
  if (!out.stages) out.stages = d.stages;
  return out;
}

function readTab_(name, cols) {
  var sh = ss_().getSheetByName(name);
  if (!sh) { setup(); sh = ss_().getSheetByName(name); }
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  return values.map(function (row) {
    var o = {};
    cols.forEach(function (c, i) { o[c] = row[i]; });
    return o;
  });
}

function toDateStr_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}
function toIso_(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}
function todayStr_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// ============================================================ WRITE
function saveLead_(user, lead) {
  var r = writeLead_(user, lead);
  return r && r.ok === false ? r : { ok: true, lead: r };
}

function writeLead_(user, lead) {
  if (!lead || !lead.name) throw new Error('Customer name is required.');
  var sh = ss_().getSheetByName(TABS.LEADS);
  var rows = readTab_(TABS.LEADS, LEAD_COLS);
  var now = new Date().toISOString();
  var rowIndex = -1, prev = null;

  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id && String(rows[i].id) === String(lead.id)) { rowIndex = i + 2; prev = rows[i]; break; }
  }

  // Ownership: a lead belongs to whoever created it. Staff create their own;
  // only an Admin may create a lead on someone else's behalf, or move one.
  var isAdmin = user.role === 'Admin';
  var storedOwner = prev ? String(prev.leadBy || '') : '';
  if (prev && !isAdmin && !isOwner_(user, storedOwner)) {
    return { ok: false, message: 'Only ' + storedOwner + ' or an Admin can change this lead.' };
  }
  var owner;
  if (isAdmin && lead.leadBy && findUser_(lead.leadBy)) owner = String(lead.leadBy).trim().toLowerCase();
  else if (storedOwner && !(storedOwner === user.name && !isAdmin)) owner = storedOwner;
  else owner = user.username;

  var rec = {};
  LEAD_COLS.forEach(function (c) { rec[c] = lead[c] == null ? '' : lead[c]; });
  NUM_COLS.forEach(function (c) { rec[c] = Number(lead[c]) || 0; });
  DATE_COLS.forEach(function (c) { rec[c] = toDateStr_(lead[c]); });

  rec.id = lead.id || ('L' + Date.now() + Math.floor(Math.random() * 1000));
  rec.createdAt = prev ? (toIso_(prev.createdAt) || now) : now;
  rec.updatedAt = now;
  rec.mobile = String(lead.mobile || '').replace(/\s/g, '');
  rec.stage = lead.stage || 'Enquiry';
  rec.leadBy = owner;
  rec.createdBy = prev ? (prev.createdBy || user.name) : user.name;
  rec.deleted = 'FALSE';

  // Loan required = project cost - margin, whenever both are given
  if (rec.projectCost > 0) rec.amount = Math.max(0, rec.projectCost - rec.margin);

  // Stage bookkeeping. The phone stamps stageSince when the stage changes (so an
  // offline edit keeps the day it really happened, and a stage rename keeps the
  // lead's age); fill it here only when the phone did not send one.
  var prevStage = prev ? String(prev.stage || '') : '';
  if (!rec.stageSince) {
    rec.stageSince = (prev && prevStage === rec.stage && toDateStr_(prev.stageSince)) || todayStr_();
  }
  stampStageDate_(rec);

  var rowValues = LEAD_COLS.map(function (c) { return c === 'mobile' ? "'" + rec[c] : rec[c]; });
  if (rowIndex > 0) {
    sh.getRange(rowIndex, 1, 1, LEAD_COLS.length).setValues([rowValues]);
    log_(user.name, 'update', 'lead', rec.id, rec.name + ' · ' + rec.stage);
  } else {
    sh.appendRow(rowValues);
    log_(user.name, 'create', 'lead', rec.id, rec.name + ' · ' + rec.product);
  }
  return normalizeLead_(rec);
}

// When a lead sits in a stage that has a dateKey, make sure that date is filled.
function stampStageDate_(rec) {
  var stages = readSettings_().stages || [];
  for (var i = 0; i < stages.length; i++) {
    var s = stages[i];
    if (s.name === rec.stage && s.dateKey && !rec[s.dateKey]) rec[s.dateKey] = todayStr_();
  }
}

function deleteLead_(user, id) {
  var sh = ss_().getSheetByName(TABS.LEADS);
  var rows = readTab_(TABS.LEADS, LEAD_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) {
      if (user.role !== 'Admin' && !isOwner_(user, rows[i].leadBy)) {
        return { ok: false, message: 'You can only delete your own leads.' };
      }
      sh.getRange(i + 2, LEAD_COLS.indexOf('deleted') + 1).setValue('TRUE');
      sh.getRange(i + 2, LEAD_COLS.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
      log_(user.name, 'delete', 'lead', id, rows[i].name);
      return { ok: true };
    }
  }
  return { ok: false, message: 'Lead not found.' };
}

function addFollowup_(user, f) {
  if (!f || !f.leadId) return { ok: false, message: 'Missing lead.' };

  var leadsSh = ss_().getSheetByName(TABS.LEADS);
  var rows = readTab_(TABS.LEADS, LEAD_COLS);
  var idx = -1;
  for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(f.leadId)) { idx = i; break; }
  if (idx < 0) return { ok: false, message: 'Lead not found.' };

  var lead = rows[idx];
  if (user.role !== 'Admin' && !isOwner_(user, lead.leadBy)) {
    return { ok: false, message: 'You can only log follow-ups on your own leads.' };
  }

  // A phone that lost the reply resends the same follow-up; don't record it twice.
  if (f.id && readTab_(TABS.FOLLOWUPS, FOLLOWUP_COLS).some(function (x) { return String(x.id) === String(f.id); })) {
    return { ok: true, duplicate: true };
  }

  var rec = {
    id: f.id || ('F' + Date.now() + Math.floor(Math.random() * 1000)),
    leadId: f.leadId,
    at: f.at || new Date().toISOString(),
    by: user.name,
    note: f.note || '',
    stageFrom: f.stageFrom || String(lead.stage || ''),
    stageTo: f.stageTo || '',
    nextDate: toDateStr_(f.nextDate)
  };
  ss_().getSheetByName(TABS.FOLLOWUPS).appendRow(FOLLOWUP_COLS.map(function (c) { return rec[c]; }));

  // reflect on the lead row
  var r = idx + 2;
  var col = function (c) { return LEAD_COLS.indexOf(c) + 1; };
  if (rec.note) leadsSh.getRange(r, col('remarks')).setValue(rec.note);
  leadsSh.getRange(r, col('nextFollowupDate')).setValue(rec.nextDate || '');
  if (rec.stageTo && rec.stageTo !== String(lead.stage)) {
    var upd = {}; LEAD_COLS.forEach(function (c) { upd[c] = lead[c]; });
    upd.stage = rec.stageTo; upd.stageSince = todayStr_();
    DATE_COLS.forEach(function (c) { upd[c] = toDateStr_(lead[c]); });
    upd.stageSince = todayStr_();
    stampStageDate_(upd);
    leadsSh.getRange(r, col('stage')).setValue(upd.stage);
    leadsSh.getRange(r, col('stageSince')).setValue(upd.stageSince);
    ['appGenDate', 'sentRODate', 'sanctionDate', 'disbDate'].forEach(function (c) {
      if (upd[c] !== toDateStr_(lead[c])) leadsSh.getRange(r, col(c)).setValue(upd[c]);
    });
  }
  leadsSh.getRange(r, col('updatedAt')).setValue(new Date().toISOString());

  log_(user.name, 'followup', 'lead', rec.leadId, rec.note);
  return { ok: true, followup: rec };
}

// ============================================================ DEALERS (shared directory — anyone can add/edit, Admin deletes)
function saveDealer_(user, d) {
  if (!d || !(d.company || d.contact)) return { ok: false, message: 'Company or contact name is required.' };
  var sh = ss_().getSheetByName(TABS.DEALERS);
  var rows = readTab_(TABS.DEALERS, DEALER_COLS);
  var now = new Date().toISOString();
  var rowIndex = -1, prev = null;
  for (var i = 0; i < rows.length; i++) if (rows[i].id && String(rows[i].id) === String(d.id)) { rowIndex = i + 2; prev = rows[i]; break; }
  var rec = {
    id: d.id || ('D' + Date.now() + Math.floor(Math.random() * 1000)),
    createdAt: prev ? (toIso_(prev.createdAt) || now) : now,
    updatedAt: now,
    company: d.company || '', contact: d.contact || '', type: d.type || '', location: d.location || '',
    mobile: String(d.mobile || '').replace(/\s/g, ''), notes: d.notes || '',
    lastContact: toDateStr_(d.lastContact),
    addedBy: prev ? (prev.addedBy || user.name) : user.name,
    deleted: 'FALSE'
  };
  var vals = DEALER_COLS.map(function (c) { return c === 'mobile' ? "'" + rec[c] : rec[c]; });
  if (rowIndex > 0) sh.getRange(rowIndex, 1, 1, DEALER_COLS.length).setValues([vals]);
  else sh.appendRow(vals);
  log_(user.name, rowIndex > 0 ? 'update' : 'create', 'dealer', rec.id, rec.company + ' · ' + rec.contact);
  return { ok: true, dealer: rec };
}

function deleteDealer_(user, id) {
  if (user.role !== 'Admin') return { ok: false, message: 'Only an Admin can remove a dealer.' };
  var sh = ss_().getSheetByName(TABS.DEALERS);
  var rows = readTab_(TABS.DEALERS, DEALER_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) {
      sh.getRange(i + 2, DEALER_COLS.indexOf('deleted') + 1).setValue('TRUE');
      log_(user.name, 'delete', 'dealer', id, rows[i].company);
      return { ok: true };
    }
  }
  return { ok: false, message: 'Dealer not found.' };
}

function saveSettings_(user, settings) {
  if (user.role !== 'Admin') return { ok: false, message: 'Only an Admin can change settings.' };
  writeSettings_(settings);
  log_(user.name, 'update', 'settings', '', '');
  return { ok: true, settings: readSettings_() };
}

function writeSettings_(settings) {
  var sh = ss_().getSheetByName(TABS.SETTINGS);
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).clearContent();
  var out = Object.keys(settings).map(function (k) { return [k, JSON.stringify(settings[k])]; });
  if (out.length) sh.getRange(2, 1, out.length, 2).setValues(out);
}

// Merges the Admin's edits into the Users tab instead of overwriting it:
//  - logins in `users` are added or updated (a blank PIN keeps the current one;
//    a PIN typed here is stored as a temporary PIN that must be changed at sign-in)
//  - only logins listed in `baseline` but missing from `users` are removed, so a
//    login added from another phone in the meantime is never lost.
function saveUsers_(user, users, baseline) {
  if (user.role !== 'Admin') return { ok: false, message: 'Only an Admin can manage staff.' };
  users = (users || []).filter(function (u) { return u && u.username; });
  var sh = ss_().getSheetByName(TABS.USERS);
  var current = readTab_(TABS.USERS, USER_COLS).filter(function (u) { return u.username; });
  var byName = {};
  current.forEach(function (u) { byName[String(u.username).trim().toLowerCase()] = u; });

  var submitted = {};
  users.forEach(function (u) {
    var un = String(u.username).trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(un)) return;
    var pin = String(u.pin || '').trim();
    if (pin && !/^\d{4,6}$/.test(pin)) return;
    var prev = byName[un];
    submitted[un] = {
      username: un,
      name: String(u.name || (prev && prev.name) || un),
      pin: pin ? "'" + pin : (prev ? (isTempPin_(prev.pin) ? "'" + String(prev.pin) : String(prev.pin)) : ''),
      role: u.role === 'Admin' ? 'Admin' : 'Staff',
      mobile: "'" + String(u.mobile != null ? u.mobile : (prev && prev.mobile) || ''),
      active: u.active === false ? 'FALSE' : 'TRUE'
    };
  });

  var removed = {};
  (baseline || []).forEach(function (b) {
    var un = String(b || '').trim().toLowerCase();
    if (un && !submitted[un] && un !== user.username) removed[un] = true;
  });

  var out = [];
  current.forEach(function (u) {
    var un = String(u.username).trim().toLowerCase();
    if (removed[un]) return;
    if (submitted[un]) { out.push(submitted[un]); delete submitted[un]; return; }
    out.push({ username: un, name: u.name, pin: isTempPin_(u.pin) ? "'" + String(u.pin) : String(u.pin), role: u.role, mobile: "'" + String(u.mobile || ''), active: String(u.active).toUpperCase() === 'FALSE' ? 'FALSE' : 'TRUE' });
  });
  Object.keys(submitted).forEach(function (un) {
    if (!submitted[un].pin) return; // a new login needs a PIN
    out.push(submitted[un]);
  });

  if (!out.some(function (u) { return u.role === 'Admin' && u.active === 'TRUE'; })) {
    return { ok: false, message: 'Keep at least one active Admin.' };
  }
  var rows = out.map(function (u) { return USER_COLS.map(function (c) { return u[c]; }); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, USER_COLS.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, USER_COLS.length).setValues(rows);
  log_(user.name, 'update', 'users', '', rows.length + ' logins');
  return { ok: true };
}

// ============================================================ GOOGLE TASKS REMINDERS
// Every open lead with a next follow-up date gets one task in the "Bank Task" list of the
// Google account that owns this script, due on that date (Google Tasks shows it in the
// Tasks app and in Google Calendar, and notifies on the day). Moving the date moves the
// task; closing the lead ticks it off; clearing the date or deleting the lead removes it.
// Saves update it straight away; a 15-minute trigger re-checks everything (so edits typed
// into the Sheet are picked up too). Needs the Google Tasks permission, granted once by
// running setupTasks from the editor. (Property names keep their old CAL_ prefix.)
var TASK_LIST = 'Bank Task';
var TASK_MAX_CHANGES = 60;        // per run — Google throttles bursts of writes
var APP_URL = 'https://anmolbage.github.io/loan-crm/';

function setupTasks() {
  taskList_();                                      // create it now, so permission is asked here
  props_().setProperty('CAL_ON', '1');
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'syncTasks' || fn === 'syncCalendar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncTasks').timeBased().everyMinutes(15).create();
  var r = syncTasks();
  Logger.log('Follow-up tasks are ON. List "' + TASK_LIST + '": ' + r.events + ' follow-ups, ' + r.changes + ' tasks written.' +
             (r.pending ? ' ' + r.pending + ' more will be added over the next runs.' : ''));
  return r;
}
function setupCalendar() { return setupTasks(); }   // old name from earlier instructions

function calOn_() { return props_().getProperty('CAL_ON') === '1'; }
function calStatus_() { return { on: calOn_(), kind: 'tasks', name: TASK_LIST }; }

function taskList_() {
  var id = props_().getProperty('TASK_LIST_ID');
  if (id) { try { Tasks.Tasklists.get(id); return id; } catch (e) { /* deleted by hand: find or recreate */ } }
  var lists = (Tasks.Tasklists.list({ maxResults: 100 }).items || []).filter(function (l) { return l.title === TASK_LIST; });
  id = lists.length ? lists[0].id : Tasks.Tasklists.insert({ title: TASK_LIST }).id;
  props_().setProperty('TASK_LIST_ID', id);
  return id;
}

// After a lead is saved, followed up or deleted, bring its task up to date.
// Tasks trouble must never fail the save itself.
function afterLeadWrite_(result, leadId) {
  if (!result || result.ok === false || !leadId || !calOn_()) return result;
  try { syncTasks_(String(leadId)); }
  catch (err) { log_('system', 'tasks-error', 'lead', leadId, String(err && err.message || err)); }
  return result;
}

// Trigger entry point (every 15 minutes) and manual re-sync.
function syncTasks() {
  if (!calOn_()) return { changes: 0, events: 0, pending: 0 };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var r = syncTasks_(null);
    props_().setProperties({ CAL_LAST: new Date().toISOString(), CAL_LAST_RESULT: r.events + ' follow-ups, ' + r.changes + ' written, ' + r.pending + ' pending' });
    return r;
  } catch (err) {
    props_().setProperties({ CAL_LAST: new Date().toISOString(), CAL_LAST_RESULT: 'error: ' + String(err && err.message || err).slice(0, 200) });
    throw err;
  } finally { lock.releaseLock(); }
}
function syncCalendar() { return syncTasks(); }     // old trigger name, in case one is left over

// Tasks in the list that carry "Lead ID: x" in their notes, so a task made elsewhere
// (or before the link was saved) is adopted rather than duplicated.
function tasksByLead_(listId) {
  var out = {}, token;
  do {
    var page = Tasks.Tasks.list(listId, { maxResults: 100, showCompleted: true, showHidden: true, pageToken: token });
    (page.items || []).forEach(function (t) {
      var m = /Lead ID: (\S+)/.exec(String(t.notes || ''));
      if (m && !out[m[1]]) out[m[1]] = t.id;
    });
    token = page.nextPageToken;
  } while (token);
  return out;
}

function syncTasks_(onlyId) {
  var listId = taskList_();
  var closed = {};
  (readSettings_().stages || []).forEach(function (st) { if (st.phase === 'done' || st.phase === 'lost') closed[st.name] = true; });
  var users = {};
  readTab_(TABS.USERS, USER_COLS).forEach(function (u) { users[String(u.username).trim().toLowerCase()] = u.name; });
  var store = props_(), all = store.getProperties(), today = todayStr_();
  var seen = {}, changes = 0, events = 0, pending = 0, byLead = null;
  var get = function (taskId) { try { return Tasks.Tasks.get(listId, taskId); } catch (e) { return null; } };
  var remove = function (taskId) { try { Tasks.Tasks.remove(listId, taskId); } catch (e) { /* already gone */ } };

  readTab_(TABS.LEADS, LEAD_COLS).forEach(function (l) {
    var id = String(l.id || '');
    if (!id || (onlyId && id !== onlyId)) return;
    seen[id] = true;
    var key = 'task:' + id, cur = all[key] ? JSON.parse(all[key]) : null;
    var date = toDateStr_(l.nextFollowupDate);
    var deleted = String(l.deleted).toUpperCase() === 'TRUE';
    var isClosed = !!closed[String(l.stage)];

    if (!date || deleted) {                          // no date or deleted lead: remove its task
      if (cur) { remove(cur.t); store.deleteProperty(key); changes++; }
      return;
    }
    if (isClosed) {                                  // closed lead: tick its task off, keep it as history
      if (cur && cur.s !== 'closed') {
        if (changes >= TASK_MAX_CHANGES) { pending++; return; }
        try { Tasks.Tasks.patch({ status: 'completed' }, listId, cur.t); } catch (e) {}
        store.setProperty(key, JSON.stringify({ t: cur.t, s: 'closed' })); changes++;
      }
      return;
    }
    events++;
    if (!cur && date < today) return;                // never create tasks for days already gone

    var owner = users[String(l.leadBy || '').toLowerCase()] || String(l.leadBy || '');
    var title = 'Follow up: ' + l.name + ' (' + l.product + ')' + (l.leadBy && l.leadBy !== 'admin' ? ' · ' + owner : '');
    var mobile = String(l.mobile || '').replace(/\D/g, '');
    var notes = [
      l.name + (mobile ? ' · ' + mobile : ''),
      l.product + ' · ' + l.stage + (l.city ? ' · ' + l.city : ''),
      l.remarks ? 'Latest: ' + String(l.remarks).slice(0, 400) : '',
      '',
      mobile ? 'Call: tel:' + mobile : '',
      'Open Loan CRM: ' + APP_URL,
      'Lead ID: ' + id
    ].filter(function (x, i) { return x !== '' || i === 3; }).join('\n');
    var sig = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, [date, title, notes].join('|')));
    if (cur && cur.s === sig) return;                // already up to date
    if (changes >= TASK_MAX_CHANGES) { pending++; return; }

    var body = { title: title, notes: notes, due: date + 'T00:00:00.000Z', status: 'needsAction' };
    var taskId = cur && cur.t;
    if (!taskId) {                                   // adopt a task already made for this lead
      if (!byLead) byLead = tasksByLead_(listId);
      taskId = byLead[id] || null;
    }
    if (taskId && get(taskId)) Tasks.Tasks.patch(body, listId, taskId);
    else taskId = Tasks.Tasks.insert(body, listId).id;
    store.setProperty(key, JSON.stringify({ t: taskId, s: sig }));
    changes++;
  });

  if (!onlyId) {                                      // rows removed from the Sheet by hand
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('task:') === 0 && !seen[k.slice(5)]) {
        try { remove(JSON.parse(all[k]).t); } catch (e) {}
        store.deleteProperty(k); changes++;
      }
    });
  }
  return { changes: changes, events: events, pending: pending };
}

function log_(by, action, entity, entityId, detail) {
  try {
    ss_().getSheetByName(TABS.LOG)
      .appendRow([new Date().toISOString(), by, action, entity, entityId, String(detail || '').slice(0, 200)]);
  } catch (e) { /* logging must never break a request */ }
}
