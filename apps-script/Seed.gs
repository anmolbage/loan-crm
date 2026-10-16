/**
 * Loan CRM — sample data
 * ------------------------------------------------------------
 * Six sample leads spread across the products, so you can see
 * every stage of the pipeline working before real data goes in.
 *
 * HOW TO RUN
 *  1. Open your Sheet -> Extensions -> Apps Script
 *  2. Make sure Code.gs is already pasted in and `setup` has been run once.
 *  3. Click the + next to "Files" -> Script -> name it "Seed"
 *  4. Paste this whole file in, Save.
 *  5. Choose `seedSampleLeads` in the function dropdown -> Run.
 *  6. Open the app and tap the sync icon.
 *
 * Running it twice does nothing — it skips any lead whose name and
 * mobile already exist. To remove the samples later, run
 * `removeSampleLeads` (it only touches rows this script created).
 */

function sampleLeads_() {
  var d = function (n) { return Utilities.formatDate(new Date(Date.now() + n * 86400000), Session.getScriptTimeZone(), 'yyyy-MM-dd'); };
  return [
    {
      group: 'Retail', product: 'HTL', name: 'Rajesh Mahto', mobile: '9431012345', city: 'Ramgarh',
      stage: 'Full Documents Pending', stageSince: d(-18), source: 'Branch', sourceName: '',
      nextFollowupDate: d(-2), remarks: 'Sale deed copy and 6-month salary slips still awaited.',
      incomeSource: 'Salaried', income: 45000, incomePeriod: 'Monthly',
      dependents: 3, earners: 1, familyNote: 'Wife homemaker, two school-going children.',
      residence: 'Rented', locality: 'Marar, Ramgarh', resYears: 6,
      requirement: 'Buying a ready 2BHK flat near Ramgarh Cantt for own stay.',
      bizNature: '', bizPlace: '', bizYears: 0,
      obligations: 'Two-wheeler loan EMI ₹2,800, 8 months left.',
      security: 'Mortgage of the flat being purchased.',
      projectCost: 2800000, margin: 800000, projectDesc: '2BHK, 950 sq ft, 3rd floor, Shree Residency, Marar. Builder agreement in hand.',
      leadBy: 'Anmol'
    },
    {
      group: 'Retail', product: 'CAR', name: 'Sunita Devi', mobile: '9835567890', city: 'Ramgarh Cantt',
      stage: 'Processing at RO', stageSince: d(-4), source: 'DSE/Dealer', sourceName: 'Vikas Kumar – Maruti Arena, Ramgarh', dealerId: 'SD1',
      nextFollowupDate: d(3), remarks: 'Application sent to RO with dealer quotation.',
      incomeSource: 'Business', income: 60000, incomePeriod: 'Monthly',
      dependents: 2, earners: 2, familyNote: 'Husband runs a medical store; both earning.',
      residence: 'Owned', locality: 'Cantt Bazaar', resYears: 15,
      requirement: 'New family car; current vehicle is 12 years old.',
      bizNature: 'Readymade garments shop', bizPlace: 'Cantt Bazaar, Ramgarh', bizYears: 9,
      obligations: 'None.',
      security: 'Hypothecation of the car.',
      projectCost: 920000, margin: 150000, projectDesc: 'Maruti Brezza VXi, on-road price ₹9.20 L incl. insurance and registration.',
      appGenDate: d(-6), sentRODate: d(-4),
      leadBy: 'Anmol'
    },
    {
      group: 'SME', product: 'SME', name: 'Mohd Imran', mobile: '7004123456', city: 'Ramgarh',
      stage: 'Sanctioned', stageSince: d(-2), source: 'Branch', sourceName: '',
      nextFollowupDate: d(0), remarks: 'Sanctioned ₹11.25 L. Documentation and mortgage creation pending.',
      incomeSource: 'Business', income: 1200000, incomePeriod: 'Annual',
      dependents: 4, earners: 1, familyNote: 'Joint family; brother helps in the shop.',
      residence: 'Owned', locality: 'Subhash Chowk, Ramgarh', resYears: 20,
      requirement: 'Expand hardware shop to adjacent unit and add stock.',
      bizNature: 'Hardware & sanitary trading', bizPlace: 'Subhash Chowk, Ramgarh', bizYears: 11,
      obligations: 'CC limit ₹5 L with another bank, regular.',
      security: 'Shop premises (own) + hypothecation of stock.',
      projectCost: 1500000, margin: 375000, projectDesc: 'Interior work ₹4 L, shelving ₹1.5 L, additional stock ₹9.5 L.',
      appGenDate: d(-14), sentRODate: d(-11), sanctionDate: d(-2),
      leadBy: 'Anmol'
    },
    {
      group: 'Agri', product: 'ATL', name: 'Birsa Oraon', mobile: '9470987654', city: 'Gola',
      stage: 'Basic Documents Pending', stageSince: d(-22), source: 'Other', sourceName: 'Existing KCC customer',
      nextFollowupDate: d(-5), remarks: 'Land records (khatiyan) not yet received from CO office.',
      incomeSource: 'Agriculture', income: 350000, incomePeriod: 'Annual',
      dependents: 5, earners: 2, familyNote: 'Son works with him on the farm.',
      residence: 'Owned', locality: 'Village Chitarpur, Gola', resYears: 40,
      requirement: 'Tractor for own 8 acres plus custom hiring in the village.',
      bizNature: '', bizPlace: '', bizYears: 0,
      obligations: 'KCC ₹1.2 L with us, regular.',
      security: 'Hypothecation of tractor; land mortgage if required.',
      projectCost: 450000, margin: 100000, projectDesc: 'Swaraj 735 FE, 40 HP, with trolley. Dealer quotation attached.',
      leadBy: 'Anmol'
    },
    {
      group: 'Secured', product: 'Gold', name: 'Kavita Kumari', mobile: '8210456789', city: 'Ramgarh',
      stage: 'Disbursed', stageSince: d(-6), source: 'Branch', sourceName: '',
      nextFollowupDate: '', remarks: 'Disbursed. Suggest SBI Life cross-sell at next visit.',
      incomeSource: 'Mixed', income: 25000, incomePeriod: 'Monthly',
      dependents: 2, earners: 1, familyNote: '',
      residence: 'Owned', locality: 'Nai Sarai, Ramgarh', resYears: 10,
      requirement: 'Daughter’s college admission fees.',
      bizNature: 'Tailoring from home', bizPlace: 'Nai Sarai', bizYears: 5,
      obligations: 'None.',
      security: '42 g gold ornaments, 22 ct.',
      projectCost: 0, margin: 0, amount: 150000, projectDesc: '',
      appGenDate: d(-7), sanctionDate: d(-6), disbDate: d(-6),
      leadBy: 'Anmol'
    },
    {
      group: 'SME', product: 'SRTO', name: 'Santosh Yadav', mobile: '9162345678', city: 'Ramgarh',
      stage: 'Enquiry', stageSince: d(-1), source: 'DSE/Dealer', sourceName: 'Ranjit Singh – Tata Motors – Hazaribagh Road', dealerId: 'SD2',
      nextFollowupDate: d(0), remarks: 'Walked in with dealer quotation. Wants to know margin and EMI.',
      incomeSource: 'Business', income: 40000, incomePeriod: 'Monthly',
      dependents: 3, earners: 1, familyNote: '',
      residence: 'Rented', locality: 'Bijulia, Ramgarh', resYears: 3,
      requirement: 'Second truck for coal transport contract with a local washery.',
      bizNature: 'Transport (one 12-wheeler already)', bizPlace: 'Ramgarh', bizYears: 4,
      obligations: 'Existing truck loan EMI ₹38,000, 14 months left.',
      security: 'Hypothecation of the new truck.',
      projectCost: 2200000, margin: 440000, projectDesc: 'Tata LPT 2818 tipper, ex-showroom ₹21 L + body ₹1 L.',
      leadBy: 'Anmol'
    }
  ];
}

function sampleDealers_() {
  return [
    { id: 'SD1', company: 'Maruti Arena, Ramgarh',          contact: 'Vikas Kumar',   type: 'Car',                location: 'Hazaribagh Road, Ramgarh', mobile: '9876500001', notes: 'Handles Brezza / Dzire enquiries. Prefers WhatsApp.' },
    { id: 'SD2', company: 'Tata Motors – Hazaribagh Road',  contact: 'Ranjit Singh',  type: 'Commercial Vehicle', location: 'Ramgarh',                 mobile: '9876500002', notes: 'Tipper and LPT buyers; coal washery contracts.' },
    { id: 'SD3', company: 'Hyundai Showroom, Ramgarh',      contact: 'Pooja Verma',   type: 'Car',                location: 'Cantt Road, Ramgarh',       mobile: '9876500003', notes: '' },
    { id: 'SD4', company: 'Mahindra Tractors, Gola',         contact: 'Sanjay Mahto',  type: 'Tractor',            location: 'Gola',                    mobile: '9876500004', notes: 'Agri term loan referrals.' }
  ];
}

function seedSampleLeads() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  if (!ss.getSheetByName(TABS.LEADS)) setup();
  var sh = ss.getSheetByName(TABS.LEADS);

  var existing = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, LEAD_COLS.length).getValues().forEach(function (r) {
      var o = {}; LEAD_COLS.forEach(function (c, i) { o[c] = r[i]; });
      existing[String(o.name).trim().toLowerCase() + '|' + String(o.mobile).replace(/\D/g, '')] = true;
    });
  }

  var now = new Date().toISOString();
  var rows = [], skipped = 0;
  sampleLeads_().forEach(function (l, n) {
    var key = String(l.name).trim().toLowerCase() + '|' + String(l.mobile).replace(/\D/g, '');
    if (existing[key]) { skipped++; return; }
    existing[key] = true;
    var rec = {};
    LEAD_COLS.forEach(function (c) { rec[c] = l[c] == null ? '' : l[c]; });
    rec.id = 'SAMPLE' + (n + 1);
    rec.createdAt = now; rec.updatedAt = now;
    rec.branch = 'Ramgarh Cantt';
    rec.createdBy = l.leadBy;
    rec.deleted = 'FALSE';
    if (Number(rec.projectCost) > 0) rec.amount = Number(rec.projectCost) - Number(rec.margin || 0);
    rows.push(LEAD_COLS.map(function (c) { return c === 'mobile' ? "'" + rec[c] : rec[c]; }));
  });

  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, LEAD_COLS.length).setValues(rows);

  // a couple of follow-up entries so the audit trail has something in it
  var fu = ss.getSheetByName(TABS.FOLLOWUPS);
  if (rows.length && fu.getLastRow() < 2) {
    var ago = function (n) { return new Date(Date.now() - n * 86400000).toISOString(); };
    fu.getRange(2, 1, 3, FOLLOWUP_COLS.length).setValues([
      ['SF1', 'SAMPLE1', ago(18), 'Anmol', 'Builder agreement received. Asked for sale deed copy and salary slips.', 'Basic Documents Pending', 'Full Documents Pending', ''],
      ['SF2', 'SAMPLE2', ago(4), 'Anmol', 'Application forwarded to RO Hazaribagh with dealer quotation and ITR.', 'Application Generated', 'Processing at RO', ''],
      ['SF3', 'SAMPLE3', ago(2), 'Anmol', 'Sanction letter received from RO. Called customer for documentation.', 'Processing at RO', 'Sanctioned', '']
    ]);
  }

  // sample dealers
  var dsh = ss.getSheetByName(TABS.DEALERS);
  if (dsh && dsh.getLastRow() < 2) {
    var dvals = sampleDealers_().map(function (d) {
      var rec = { id: d.id, createdAt: now, updatedAt: now, company: d.company, contact: d.contact, type: d.type, location: d.location,
        mobile: d.mobile, notes: d.notes, lastContact: '', addedBy: 'Anmol', deleted: 'FALSE' };
      return DEALER_COLS.map(function (c) { return c === 'mobile' ? "'" + rec[c] : rec[c]; });
    });
    dsh.getRange(2, 1, dvals.length, DEALER_COLS.length).setValues(dvals);
  }

  Logger.log('Added ' + rows.length + ' sample leads, skipped ' + skipped + ' already present.');
  return 'Added ' + rows.length + ' sample leads, skipped ' + skipped + '.';
}

function removeSampleLeads() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var dsh = ss.getSheetByName(TABS.DEALERS);
  for (var r3 = dsh.getLastRow(); r3 >= 2; r3--) {
    if (/^SD\d+$/.test(String(dsh.getRange(r3, 1).getValue()))) dsh.deleteRow(r3);
  }
  var sh = ss.getSheetByName(TABS.LEADS);
  var n = 0;
  for (var r = sh.getLastRow(); r >= 2; r--) {
    if (/^SAMPLE\d+$/.test(String(sh.getRange(r, 1).getValue()))) { sh.deleteRow(r); n++; }
  }
  var fu = ss.getSheetByName(TABS.FOLLOWUPS);
  for (var r2 = fu.getLastRow(); r2 >= 2; r2--) {
    if (/^SF\d+$/.test(String(fu.getRange(r2, 1).getValue()))) { fu.deleteRow(r2); }
  }
  return 'Removed ' + n + ' sample leads.';
}
