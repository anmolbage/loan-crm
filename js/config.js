/* ============================================================
   Loan CRM — configuration
   ------------------------------------------------------------
   After you deploy the Apps Script web app, paste its /exec URL
   into API_URL below. That is the ONLY thing you must change.
   ============================================================ */

window.LOAN_CONFIG = {

  // 👇 PASTE YOUR APPS SCRIPT WEB APP URL HERE
  API_URL: 'PASTE_YOUR_APPS_SCRIPT_URL_HERE',

  APP_NAME: 'Loan CRM',
  VERSION: '1.0.0',

  // Your branch — pre-filled on every new lead and printed on the shared proposal
  BRANCH_NAME: 'Ramgarh Cantt',
  BANK_NAME: 'Jharkhand Gramin Bank',

  // Google Sheet used as the database (for the "Open Sheet" link in More)
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1Q5o8u2aVCYHx-rIdjCxK7upGORchQ2mBDW_6gZD5im8/edit',

  /* Add ?demo=1 to the URL to try the app on sample data with no backend.
     Sign in with admin / 1234. Nothing touches your Sheet. */
  DEMO_MODE: /[?&]demo=1/.test(location.search),

  // Colour per product group. Groups added later by an Admin get a colour from the fallback list.
  GROUP_COLORS: {
    'Retail':  '#3b82f6',
    'SME':     '#f59e0b',
    'Agri':    '#22a06b',
    'Secured': '#a855f7'
  },
  FALLBACK_COLORS: ['#ef4444', '#0ea5e9', '#ec4899', '#84cc16', '#64748b'],

  // Lead source — exactly three options. "DSE/Dealer" asks for a name alongside.
  SOURCES: ['Branch', 'DSE/Dealer', 'Other'],

  // Dealer / DSE types for the directory
  DEALER_TYPES: ['Car', 'Commercial Vehicle', 'Two Wheeler', 'Tractor', 'Builder / Property', 'Other'],
  // A dealer not contacted for this many days is flagged in the directory
  DEALER_STALE_DAYS: 14,

  // Profile dropdowns
  INCOME_SOURCES: ['Salaried', 'Business', 'Agriculture', 'Rental', 'Mixed'],
  RESIDENCE_TYPES: ['Owned', 'Rented', 'Family-owned'],

  // A file sitting this many days in one stage is flagged as "stuck"
  STUCK_DAYS: 15,

  // Pre-filled WhatsApp message to the customer. {name} and {product} are replaced.
  WA_TEMPLATE: 'Hello {name}, this is from {bank}, {branch} branch regarding your {product} enquiry. Is this a good time to talk?'
};
