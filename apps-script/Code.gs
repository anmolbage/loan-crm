/**
 * Loan CRM — Google Apps Script backend
 * Database: Google Sheets
 *
 * SETUP
 * 1. Open your Google Sheet -> Extensions -> Apps Script
 * 2. Delete everything, paste this file, Save.
 * 3. Run the function `setup` once and approve permissions.
 * 4. Deploy -> New deployment -> type "Web app"
 *      Execute as: Me
 *      Who has access: Anyone
 *    Copy the /exec URL into js/config.js of the web app.
 */

// ============================================================ CONFIG
var SHEET_ID = '1Q5o8u2aVCYHx-rIdjCxK7upGORchQ2mBDW_6gZD5im8';
var TOKEN_TTL_DAYS = 30;

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
      { code: 'LATDR',    name: 'Loan Against Term Deposit',         group: 'Secured' }
    ],
    // phase: branch = with your team | ro = waiting on Regional Office |
    //        sanctioned = sanctioned, disbursement pending | done = disbursed | lost = closed without disbursement
    // dateKey: which date column gets stamped when a lead enters that stage
    stages: [
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

function defaultUsers_() {
  return [
    ['admin', 'Anmol', '1234', 'Admin', '', 'TRUE']
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
    users.getRange(2, 1, defaultUsers_().length, USER_COLS.length).setValues(defaultUsers_());
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
  return 'Setup complete. Now deploy as a Web app.';
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
function ss_() { return SpreadsheetApp.openById(SHEET_ID); }

// ============================================================ ROUTING
function doGet(e) {
  return json_({ ok: true, service: 'Loan CRM API', version: 1 });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    var action = req.action;

    if (action === 'ping') return json_({ ok: true, time: new Date().toISOString() });
    if (action === 'login') return json_(login_(req));

    var user = verifyToken_(req.token);
    if (!user) return json_({ ok: false, error: 'AUTH', message: 'Session expired. Please log in again.' });

    switch (action) {
      case 'bootstrap':    return json_(bootstrap_(user));
      case 'saveLead':     lock.waitLock(20000); return json_(saveLead_(user, req.lead));
      case 'deleteLead':   lock.waitLock(20000); return json_(deleteLead_(user, req.id));
      case 'addFollowup':  lock.waitLock(20000); return json_(addFollowup_(user, req.followup));
      case 'saveDealer':   lock.waitLock(20000); return json_(saveDealer_(user, req.dealer));
      case 'deleteDealer': lock.waitLock(20000); return json_(deleteDealer_(user, req.id));
      case 'saveSettings': lock.waitLock(20000); return json_(saveSettings_(user, req.settings));
      case 'saveUsers':    lock.waitLock(20000); return json_(saveUsers_(user, req.users));
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
function login_(req) {
  var username = String(req.username || '').trim().toLowerCase();
  var pin = String(req.pin || '').trim();
  if (!username || !pin) return { ok: false, error: 'BAD_INPUT', message: 'Enter username and PIN.' };

  var rows = readTab_(TABS.USERS, USER_COLS);
  for (var i = 0; i < rows.length; i++) {
    var u = rows[i];
    if (String(u.username).trim().toLowerCase() === username) {
      if (String(u.active).toUpperCase() === 'FALSE') return { ok: false, error: 'DISABLED', message: 'This account is disabled.' };
      if (String(u.pin).trim() !== pin) return { ok: false, error: 'BAD_PIN', message: 'Incorrect PIN.' };
      var safe = { username: String(u.username).trim(), name: u.name, role: u.role || 'Staff' };
      log_(safe.name, 'login', 'user', safe.username, '');
      return { ok: true, token: makeToken_(safe), user: safe };
    }
  }
  return { ok: false, error: 'NO_USER', message: 'User not found.' };
}

function makeToken_(user) {
  var exp = Date.now() + TOKEN_TTL_DAYS * 86400000;
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify({ u: user, e: exp }));
  return payload + '.' + sign_(payload);
}
function sign_(text) {
  var secret = props_().getProperty('SECRET') || 'change-me';
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, secret));
}
function verifyToken_(token) {
  if (!token) return null;
  var parts = String(token).split('.');
  if (parts.length !== 2) return null;
  if (sign_(parts[0]) !== parts[1]) return null;
  try {
    var data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    if (!data.e || data.e < Date.now()) return null;
    return data.u;
  } catch (err) { return null; }
}

function changePin_(user, oldPin, newPin) {
  newPin = String(newPin || '').trim();
  if (!/^\d{4,6}$/.test(newPin)) return { ok: false, message: 'PIN must be 4 to 6 digits.' };
  var sh = ss_().getSheetByName(TABS.USERS);
  var rows = readTab_(TABS.USERS, USER_COLS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].username).trim().toLowerCase() === String(user.username).toLowerCase()) {
      if (String(rows[i].pin).trim() !== String(oldPin).trim()) return { ok: false, message: 'Current PIN is incorrect.' };
      sh.getRange(i + 2, USER_COLS.indexOf('pin') + 1).setValue("'" + newPin);
      return { ok: true, message: 'PIN updated.' };
    }
  }
  return { ok: false, message: 'User not found.' };
}

// ============================================================ READ
function bootstrap_(user) {
  var leads = readTab_(TABS.LEADS, LEAD_COLS)
    .filter(function (l) { return l.id && String(l.deleted).toUpperCase() !== 'TRUE'; })
    .map(normalizeLead_);

  var followups = readTab_(TABS.FOLLOWUPS, FOLLOWUP_COLS)
    .filter(function (f) { return f.id; })
    .map(function (f) { f.at = toIso_(f.at); f.nextDate = toDateStr_(f.nextDate); return f; });

  var users = readTab_(TABS.USERS, USER_COLS)
    .filter(function (u) { return u.username; })
    .map(function (u) {
      var o = { username: String(u.username).trim(), name: u.name, role: u.role || 'Staff', mobile: String(u.mobile || ''), active: String(u.active).toUpperCase() !== 'FALSE' };
      if (user.role === 'Admin') o.pin = String(u.pin);
      return o;
    });

  var dealers = readTab_(TABS.DEALERS, DEALER_COLS)
    .filter(function (d) { return d.id && String(d.deleted).toUpperCase() !== 'TRUE'; })
    .map(function (d) {
      var o = {}; DEALER_COLS.forEach(function (c) { o[c] = d[c] == null ? '' : d[c]; });
      o.mobile = String(d.mobile || ''); o.lastContact = toDateStr_(d.lastContact);
      o.createdAt = toIso_(d.createdAt); o.updatedAt = toIso_(d.updatedAt); delete o.deleted; return o;
    });

  return { ok: true, user: user, leads: leads, followups: followups, users: users, dealers: dealers, settings: readSettings_(), serverTime: new Date().toISOString() };
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
  return { ok: true, lead: writeLead_(user, lead) };
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
  if (prev && !isAdmin && storedOwner && storedOwner !== user.name) {
    throw new Error('Only ' + storedOwner + ' or an Admin can change this lead.');
  }
  var owner = isAdmin ? (lead.leadBy || storedOwner || user.name) : (storedOwner || user.name);

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

  // Stage bookkeeping (server-side, so Sheet edits by hand stay consistent)
  var prevStage = prev ? String(prev.stage || '') : '';
  if (!prev || prevStage !== rec.stage || !rec.stageSince) {
    if (!prev || prevStage !== rec.stage) rec.stageSince = todayStr_();
    else rec.stageSince = toDateStr_(prev.stageSince) || todayStr_();
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
      if (user.role !== 'Admin' && String(rows[i].leadBy || '') !== user.name) {
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
  if (user.role !== 'Admin' && String(lead.leadBy || '') !== user.name) {
    return { ok: false, message: 'You can only log follow-ups on your own leads.' };
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
  var sh = ss_().getSheetByName(TABS.SETTINGS);
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).clearContent();
  var out = Object.keys(settings).map(function (k) { return [k, JSON.stringify(settings[k])]; });
  if (out.length) sh.getRange(2, 1, out.length, 2).setValues(out);
  log_(user.name, 'update', 'settings', '', '');
  return { ok: true, settings: readSettings_() };
}

function saveUsers_(user, users) {
  if (user.role !== 'Admin') return { ok: false, message: 'Only an Admin can manage staff.' };
  var sh = ss_().getSheetByName(TABS.USERS);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, USER_COLS.length).clearContent();
  var rows = (users || []).filter(function (u) { return u.username; }).map(function (u) {
    return [String(u.username).trim().toLowerCase(), u.name || '', "'" + String(u.pin || '1234'),
            u.role || 'Staff', "'" + String(u.mobile || ''), u.active === false ? 'FALSE' : 'TRUE'];
  });
  if (rows.length) sh.getRange(2, 1, rows.length, USER_COLS.length).setValues(rows);
  log_(user.name, 'update', 'users', '', rows.length + ' staff');
  return { ok: true };
}

function log_(by, action, entity, entityId, detail) {
  try {
    ss_().getSheetByName(TABS.LOG)
      .appendRow([new Date().toISOString(), by, action, entity, entityId, String(detail || '').slice(0, 200)]);
  } catch (e) { /* logging must never break a request */ }
}
