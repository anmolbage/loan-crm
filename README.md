# Loan CRM

A mobile app for tracking **loan leads** from first enquiry to disbursement. It runs on your phone like a normal app, works without signal, and keeps every record in a Google Sheet in your Drive. You sign in with a username and PIN — no Google account needed.

Built on the same foundation as your CVE (insurance) CRM, so if you've set that one up, this will feel familiar.

---

## The three pieces, and what each one does

Before clicking anything, here is what you are putting together:

| Piece | What it is | Where it lives |
|---|---|---|
| **The Google Sheet** | The database. Every lead, follow-up and login is a row here. You can open it any time and read or edit it like a normal spreadsheet. | Your Google Drive — already created: **"Loan CRM Database"** |
| **The Apps Script** | A small program that sits *inside* the Sheet. When the app on a phone wants to read or save something, it talks to this script, and the script reads or writes the Sheet. It also checks the username and PIN on every request, so nobody can touch the data without logging in. | Inside the Sheet (Extensions → Apps Script) |
| **The app** | The screens you tap on. It is a folder of files that GitHub hosts for free as a web page. Phones "install" it from that web page. | GitHub Pages |

The app only needs to know one thing: the web address of your Apps Script. That is the single line you edit in `js/config.js`.

---

## Setup — about 15 minutes, once

### Step 1 — Put the script inside your Sheet

1. Open **Loan CRM Database** in your Drive:
   `https://docs.google.com/spreadsheets/d/1Q5o8u2aVCYHx-rIdjCxK7upGORchQ2mBDW_6gZD5im8/edit`
2. In the Sheet's menu, click **Extensions → Apps Script**. A new tab opens with a code editor and a file called `Code.gs`.
3. Delete everything in that editor.
4. Open `apps-script/Code.gs` from this folder (any text editor will do — Notepad is fine), select all, copy, and paste it into the Apps Script editor.
5. Click the **Save** icon (💾).
6. At the top there is a dropdown that probably says `doGet`. Change it to **`setup`**, then click **▶ Run**.
7. Google will ask for permission. Click **Review permissions → your account → Advanced → Go to Untitled project (unsafe) → Allow**. This is normal: you are allowing *your own* script to edit *your own* Sheet.
8. At the bottom of the editor, the **Execution log** shows a line like
   `Admin login created. Username: admin   Temporary PIN: 483920`. Note that PIN.
9. Go back to the Sheet tab. You should now see six tabs at the bottom: **Leads, Users, Followups, Settings, Dealers, ActivityLog**. The same temporary PIN is in the **Users** tab, in the `pin` column.

### Step 2 — Publish the script as a web address

1. In the Apps Script editor, click **Deploy → New deployment** (top right).
2. Click the gear icon ⚙ next to "Select type" → **Web app**.
3. Fill in:
   - **Description:** `Loan CRM API`
   - **Execute as:** `Me`
   - **Who has access:** **`Anyone`** ← must be *Anyone*, not "Anyone with Google account"
4. Click **Deploy**, then **Copy** the **Web app URL**. It is long and ends in `/exec`.

> "Anyone" only means the address is reachable. The script refuses every request that does not carry a valid username and PIN, so your data stays private.

### Step 3 — Tell the app where the script is

1. Open `js/config.js` in a text editor.
2. Find the line near the top that says:
   ```js
   API_URL: 'PASTE_YOUR_APPS_SCRIPT_URL_HERE',
   ```
3. Replace the text between the quotes with the URL you just copied. Save the file.

That is the only file you need to edit.

### Step 4 — Put the app on GitHub

1. Go to github.com, sign in, click **New repository**. Name it `loan-crm`, keep it **Public**, click **Create repository**.
2. On the next page click **uploading an existing file**. Drag the *contents* of this folder in (index.html, manifest.json, sw.js, the css, js, icons and apps-script folders). Click **Commit changes**.

   Or, if you use git:
   ```bash
   cd Loan-CRM-App
   git init
   git add .
   git commit -m "Loan CRM v1"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/loan-crm.git
   git push -u origin main
   ```
3. In the repository, go to **Settings → Pages**. Under *Build and deployment* set **Source: Deploy from a branch**, **Branch: main / (root)**, click **Save**.
4. Wait a minute, then open:
   ```
   https://YOUR-USERNAME.github.io/loan-crm/
   ```

> A public repository is safe here: it contains no customer data and no PINs. All of that is in your Sheet, which stays private. The only thing in the repository is the script's web address, which is useless without a login.
>
> Already done for you: the app lives at **https://github.com/anmolbage/loan-crm**, is published at **https://anmolbage.github.io/loan-crm/**, and `js/config.js` already points at your deployed script.

### Step 5 — Install on your phone

Open the link on your phone:

- **Android / Chrome:** menu ⋮ → **Add to Home screen**
- **iPhone / Safari:** Share button → **Add to Home Screen**

It then opens full-screen with its own icon, like any installed app.

---

## Login and PINs

Your first login is `admin` with the **temporary PIN** from Step 1. The moment you sign in, the app asks you to choose your own 4–6 digit PIN. After that:

- Your PIN is stored only in scrambled (hashed) form in the Users tab — nobody, including you, can read it back from the Sheet.
- Changing your PIN (More → Change my PIN) signs out every other phone using your login.
- After **5 wrong PINs** a login is locked for 15 minutes.
- **Forgot your PIN?** Open the Sheet → Users tab and type a new PIN (just digits) into your `pin` cell. It works once, and the app makes you pick a new one.

**Adding staff** (More → Logins & PINs): give them a name, a username and a temporary PIN. They choose their own PIN the first time they sign in. Switching a login off, deleting it, or changing its role takes effect on their phone straight away. Usernames can't be renamed — add a new login instead.

Staff see every lead but can only edit, move, follow up or delete their **own**. An Admin can edit anything and, when there is more than one login, gets a **Lead for** box on the lead form to put a lead in someone else's name. The server enforces all of this, not just the screens.

---

## How the pipeline works

Every lead sits in one of these stages:

```
Enquiry → Basic Documents Pending → Full Documents Pending → Application Generated
        → Processing at RO → Sanctioned → Disbursed
                                        ↘ Rejected / Dropped
```

Each stage belongs to a **phase**, and the phase is what the dashboard is built around:

| Phase | Stages | Meaning |
|---|---|---|
| **With branch** | Enquiry → Application Generated | Branch work — you should be chasing these |
| **At RO** | Processing at RO | Out of your hands — waiting on Regional Office |
| **Sanctioned** | Sanctioned | RO has said yes; documentation and disbursement are back with you |
| **Disbursed** | Disbursed | Done |
| **Closed** | Rejected, Dropped | Rejected = bank declined. Dropped = customer walked away before application. |

**Dates fill themselves.** When a lead reaches Application Generated, Processing at RO, Sanctioned or Disbursed, that date is stamped automatically. You can correct a date from the lead's edit form under *Stage dates*.

**Ageing.** Every open lead shows how many days it has sat in its current stage. After 15 days it turns red and appears under *Stuck files* on the Home screen and the Chase tab (RO files are left out — those aren't yours to chase). Change the 15 in `js/config.js` (`STUCK_DAYS`) if you want a different threshold.

---

## Day-to-day use

**Adding a lead** — tap the **+**, pick the product (grouped Retail / SME / Agri / Secured in the dropdown), fill in the customer. Enter **project cost** and **own contribution** and the loan amount calculates itself. Then fill the short **borrower profile** — income, family, residence, requirement, business if any, obligations, security offered. It is meant to be filled on the phone in front of the customer; every field is optional except the name and an amount.

**Lead source** is exactly Branch / DSE-Dealer / Other. Picking DSE/Dealer shows a dropdown of your dealer directory (see below); choose "Other / not listed" to type a name instead.

**DSE & Dealers** (More → DSE & Dealers) — your directory of car, commercial-vehicle, tractor and other dealers and DSEs who send you leads: company, contact person, type, location, mobile, notes. Each entry has Call / WhatsApp / SMS, a **"Contacted today"** button, and a **"New lead"** button that opens the lead form with that dealer already set as the source. The list is sorted so the dealer you have gone longest without contacting is at the top, and anyone not contacted in 14+ days is flagged red — so it doubles as your weekly dealer call sheet. Every dealer shows how many leads came from them and how many were disbursed. The 14 days is `DEALER_STALE_DAYS` in `js/config.js`.

**Following up / moving stage** — open a lead → **Follow-up / move**. Write what happened, move the stage if it changed, set the next date. The note is timestamped and kept forever in the Followups tab.

**Share proposal** — open a lead → **Share proposal**. It builds a clean summary of the borrower profile and project numbers, formatted for WhatsApp (bold headers) or email, signed "Submitted by <you>, Branch Manager, Ramgarh Cantt". Send it straight to the sanctioning authority, or copy it.

**Call / WhatsApp / SMS** — on every lead. WhatsApp opens with a pre-filled message (edit it in `js/config.js` → `WA_TEMPLATE`).

**Chase tab** — Due & overdue · Stuck files · With branch · At RO · To disburse · Next 7 days · Recent activity. This is the daily work list.

**Leads tab** — search by name, mobile, product, city or dealer; filter by product, stage or phase, and source.

**Export CSV** — the download icon on the Leads tab (or More → Export CSV) downloads whatever is on screen, filters included, with every profile field as a column.

---

## Changing products and stages (Admin, no code)

**More → Products & groups** — rename, add or remove products and groups. The short code (HTL, CAR…) shows on cards; the full name goes on the proposal.

**More → Pipeline stages** — rename stages, add new ones, or change which phase a stage belongs to. Renaming a stage moves its leads along with it. You cannot delete a stage that still has leads in it.

Changes save to the Sheet and reach every phone on the next sync.

---

## Files

```
Loan-CRM-App/
├── index.html            the app shell
├── manifest.json         PWA metadata (name, icon, colours)
├── sw.js                 service worker — offline caching
├── css/app.css           all styling, light and dark themes
├── js/config.js          ← the only file you edit
├── js/store.js           state, Sheets API, offline queue
├── js/app.js             screens and interactions
├── icons/                app icons
└── apps-script/
    └── Code.gs           the backend, pasted into your Sheet
```

## Sheet tabs

- **Leads** — one row per lead, one column per field (profile fields included), so you can filter and pivot it like any spreadsheet. `deleted` is set to TRUE instead of removing rows, so nothing is ever truly lost.
- **Users** — username, name, PIN (hashed; plain digits = a temporary PIN), role, active.
- **Followups** — the full follow-up history, one row per note.
- **Settings** — product groups, products and stages as JSON. Edit through the app, not by hand.
- **Dealers** — the DSE / dealer directory, one row per contact.
- **ActivityLog** — who did what, when.

You can edit the Leads tab directly and the app picks it up on next sync. Just don't rename or reorder columns.

---

## Troubleshooting

**"Cannot reach the server"** — the `API_URL` in `js/config.js` is wrong, or the deployment's access isn't "Anyone". Re-check Steps 2 and 3.

**Changes not showing on another phone** — tap the ↻ icon on Home. While the app is open it also syncs every minute, whenever you switch back to it, and whenever it comes back online.

**"Too many wrong PINs"** — wait 15 minutes, or reset the PIN in the Users tab (see *Login and PINs*).

**I edited Code.gs but nothing changed** — Apps Script needs a redeploy: **Deploy → Manage deployments → ✎ → Version: New version → Deploy**. The URL stays the same.

**The app looks stale after you push an update** — close it fully and reopen. The service worker fetches the new version on the next load.

---

## A note on security

PINs are hashed, wrong guesses are rate-limited, and every request is checked against the Users tab, so a disabled login stops working at once. It is still a simple tool rather than bank-grade software: the Sheet itself is the real vault, so keep it shared with no one, and only give logins to people you trust with the whole pipeline.

## Updating the backend later (clasp)

The script inside your Sheet is linked to `apps-script/` with [clasp](https://github.com/google/clasp) (the link lives in `apps-script/.clasp.json`, which is not committed). After editing `Code.gs`:

```bash
cd apps-script
clasp push --force
clasp update-deployment AKfycbxS1pW66sPKOIj7QJivS-_p0UYyYkQ7MSbBHzZO1s38AN7rlpsRD_UBR9U3IkaFY8-Y
```

The web app address stays the same, so the app needs no change.
