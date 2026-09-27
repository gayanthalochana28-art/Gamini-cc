# Sri Gamini Central College — School Management Website

Official website and administration system for **Sri Gamini Central College (National School)**,
built with **HTML5, CSS3 and vanilla JavaScript (ES6+) only**.

No React, no Vue, no Angular, no Bootstrap, no jQuery, no build step, no package manager.

It runs two ways from the same source: as an **offline demonstration** on
`localStorage`, and — once you paste your own Firebase keys into one file — as a
**real multi-user system** with Firebase Authentication, Cloud Firestore, student
self-registration with administrator approval, and roster import from Google Sheets.
See [Connecting a real backend](#connecting-a-real-backend).

---

## Contents

1. [Quick start](#quick-start)
2. [Demo sign-in (development only)](#demo-sign-in-development-only)
3. [What works end to end](#what-works-end-to-end)
4. [Project structure](#project-structure)
5. [Script load order](#script-load-order)
6. [Data model](#data-model)
7. [Authentication design](#authentication-design)
8. [Security warning — read before deploying](#security-warning--read-before-deploying)
9. [Connecting a real backend](#connecting-a-real-backend)
10. [Languages and theming](#languages-and-theming)
11. [Branding and assets](#branding-and-assets)
12. [Resetting the demonstration data](#resetting-the-demonstration-data)
13. [Accessibility and SEO](#accessibility-and-seo)
14. [Known limitations](#known-limitations)

---

## Quick start

### Option A — Visual Studio Code with Live Server (recommended)

1. Install [Visual Studio Code](https://code.visualstudio.com/).
2. Open the `school-website/` folder as the workspace root
   (not the parent folder — `index.html` must sit at the root of the workspace).
3. In the Extensions view (`Ctrl+Shift+X`) install **Live Server** by Ritwick Dey.
4. Right-click `index.html` → **Open with Live Server**.
5. The site opens at `http://127.0.0.1:5500/index.html`.

### Option B — open the files directly

Double-click `index.html`. Every script is a classic `<script>` tag, so the site works over
the `file://` protocol too. Two caveats: the Google Maps embed on the contact page needs a
real HTTP origin, and some browsers restrict `localStorage` per `file://` path.

### Option C — any static server

```bash
# Python 3
python -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000/`.

There is **no npm install, no bundler and no transpiler**. The JavaScript targets the ES6
supported by every current browser.

---

## Demo sign-in (development only)

> ### ⚠️ DEVELOPMENT / DEMO CREDENTIALS — NOT REAL ACCOUNTS

**No credential is printed on the website.** The login page shows a sign-in form and nothing
else — no account list, no example ID, no password hint. This README deliberately does not
reprint them either.

An offline build with no server can only check a password that the browser already holds, so
the development values live in exactly two source files:

| Where | What it holds |
|---|---|
| `js/auth.js` → `DEMO_PASSWORDS` | one development password per role |
| `js/storage.js` → `SEED_USERS` | the sign-in IDs (`admin`, the teacher numbers, the student IDs) and the password each seeded account starts with |

Read those two blocks if you need the values while trying the portals out.

* Changing a password in **Settings** or on the profile page replaces the development value
  for that account.
* **Before you hand this to anyone**, edit both files and set your own throwaway values, or
  delete `DEMO_PASSWORDS` and the `demoPassword` fields entirely once Firebase is connected.
* These accounts exist only in the offline demonstration build. Once
  `js/firebase-config.js` is configured they stop working — sign-in then goes to
  Firebase Authentication, and no password is published anywhere at all.

---

## What works end to end

This is a working application, not a mock-up. The following flows were verified in a browser:

| Action | Result |
|---|---|
| Admin publishes a notice | Appears on the public Notices page **and** the home page immediately |
| Admin marks a notice **Important** | Surfaces in the prominent notice strip on the home page |
| Admin adds a teacher | New card on the public Teachers page, searchable and filterable |
| Admin adds a student | **That student can sign in straight away** with the development student password |
| Admin deletes a student | The linked sign-in account is removed with the record |
| Student registers at `student-signup.html` | Account is created **Pending**; sign-in is refused until it is approved |
| Admin ✔ Approves a Pending registration | Both the admission record and the sign-in turn Active; the student can now log in |
| Admin ✕ Rejects a Pending registration | The student is told the office could not approve it |
| Admin **Import roster** from a CSV / Google Sheets export | Existing Student IDs are updated, unknown ones admitted, blank cells left alone |
| Teacher marks the register | Entry appears in the student's Attendance view, with reason and teacher name |
| Teacher enters examination marks | Student's Results view shows the mark, total and grade chip |
| Teacher publishes exam information | Appears as an `Exam` category notice to students |
| Teacher or student writes a message | Recipient's unread badge updates; reply threads back |
| Visitor submits the contact form | Lands in the admin Messages console and can be replied to |
| Anyone updates their profile | Persisted and reflected across every portal and the top bar |
| Logout | Session cleared; the dashboards redirect to the login page |
| Open `admin-dashboard.html` while signed out | Redirects to `login.html?next=admin-dashboard.html` |
| Student opens the admin dashboard | Redirected to their own portal with an access warning |
| Language switch (EN / සිංහල) | Relabels the interface and swaps Sinhala content where it exists |
| Dark / light mode | Remembered on the device and shared between the site and the portals |

---

## Project structure

```
school-website/
├── index.html                  home page
├── login.html                  role-aware sign-in
├── student-signup.html         student self-registration (awaits admin approval)
├── profile.html                signed-in profile (all three roles)
├── student-dashboard.html      student portal
├── teacher-dashboard.html      teacher portal
├── admin-dashboard.html        administration console
│
├── firebase.json               Firebase Hosting, Firestore and Storage deploy manifest
├── firestore.rules             ← the real access control; deploy before inviting anyone
├── storage.rules               ← who may upload a photograph, and what is public
├── firestore.indexes.json      composite indexes (none are needed today)
│
├── pages/
│   ├── about.html              about, history, vision, principal's message
│   ├── academics.html          bands, streams, departments
│   ├── teachers.html           public staff directory (search + filters)
│   ├── students.html           explains that student data is not public
│   ├── notices.html            public notice board
│   ├── updates.html            news feed with like / view counters
│   ├── events.html             upcoming, past and monthly calendar
│   ├── gallery.html            categories, filters, lightbox
│   ├── achievements.html       academic, sport, culture, service
│   ├── downloads.html          forms, circulars, papers
│   └── contact.html            details, map embed, enquiry form
│
├── css/
│   ├── style.css               design system, colours, components, public pages
│   ├── dashboard.css           portal shell, widgets, panels, tables, forms
│   ├── animations.css          keyframes, reveal-on-scroll, transitions
│   └── responsive.css          mobile-first breakpoints
│
├── js/
│   ├── utils.js                SGC.utils — DOM, escaping, toasts, modals, SVG charts
│   ├── storage.js              SGC.db — collections, seed data, CRUD, write-through
│   ├── auth.js                 SGC.auth — session, roles, route guards, adapter, signup
│   ├── firebase-config.js      ★ the only file you edit to go live (SGC_FIREBASE)
│   ├── backend.js              SGC.backend — Firebase Auth + Firestore, optional
│   ├── notices.js              SGC.notices — shared notice rendering
│   ├── updates.js              SGC.updates — news feed
│   ├── events.js               SGC.events — cards and calendar
│   ├── gallery.js              SGC.gallery — grid and lightbox
│   ├── downloads.js → pages.js SGC.downloads, SGC.teachers, SGC.principalCard + public pages
│   ├── home.js                 home page controller
│   ├── dash.js                 SGC.dash — shared portal building blocks
│   ├── student.js              student portal
│   ├── teacher.js              teacher portal
│   ├── admin.js                administration console
│   ├── profile.js              signed-in profile page
│   └── app.js                  chrome, navigation, i18n, theme, search, boot — LAST
│
└── assets/
    ├── logo.png                official crest — used unchanged
    ├── school-front.jpg        entrance photograph — hero and profile covers
    ├── teachers/               staff portraits (optional, initials fallback)
    ├── students/               student photographs (optional)
    ├── gallery/                g01.jpg … g10.jpg
    └── documents/              the six seeded downloadable files
```

### Deviation from the brief's file allocation

The brief suggested twelve JavaScript files. This build has fifteen, because four concerns
were large enough to deserve their own module:

| Added | Why |
|---|---|
| `js/home.js` | Keeps the home page controller out of `app.js`, which is shared by all 17 pages |
| `js/pages.js` | Groups the small public-page controllers (about, academics, contact, students) |
| `js/gallery.js` | Isolates the lightbox |
| `js/dash.js` | Shared portal building blocks — tables, forms, panels — so the three dashboards stay identical |

`js/downloads.js` was folded into `js/pages.js`. Every file is still plain ES6 with no
tooling, and each has a single clear responsibility.

---

## Script load order

Scripts are classic `<script>` tags loaded in dependency order. **`app.js` must always be
last** — it boots the page and calls the controller registered by the other modules.

```html
<script src="js/utils.js"></script>
<script src="js/storage.js"></script>
<script src="js/auth.js"></script>
<script src="js/firebase-config.js"></script>  <!-- plain values, always safe -->
<script src="js/backend.js"></script>          <!-- inert until configured -->
<script src="js/notices.js"></script>
<script src="js/updates.js"></script>
<script src="js/events.js"></script>
<script src="js/gallery.js"></script>
<script src="js/pages.js"></script>
<script src="js/dash.js"></script>       <!-- portal pages only -->
<script src="js/home.js"></script>       <!-- or student / teacher / admin / profile -->
<script src="js/app.js"></script>        <!-- always last -->
```

`app.js` awaits `SGC.backend.init()` before it renders anything. When
`js/firebase-config.js` is still unconfigured that call resolves immediately,
touches no network, and the page boots exactly as it always did — which is why
the site still opens from `file://` with no console output.

Each module attaches itself to the single global `window.SGC` namespace inside an IIFE:

```js
SGC.utils  SGC.charts  SGC.db  SGC.auth  SGC.app  SGC.i18n  SGC.backend
SGC.pages  SGC.notices SGC.updates  SGC.events  SGC.gallery
SGC.downloads  SGC.achievements  SGC.teachers  SGC.principalCard  SGC.dash
```

Every page declares its contract on the `<body>`:

```html
<body data-page="student-dashboard" data-base="" data-chrome="dash" data-loader="off">
```

| Attribute | Meaning |
|---|---|
| `data-page` | Key looked up in `SGC.pages`; its `init()` runs on boot |
| `data-base` | `""` at the root, `"../"` inside `pages/` — used to re-link every generated URL |
| `data-chrome` | `site` (nav + footer), `dash` (portal shell), `none` |
| `data-loader` | `off` suppresses the loading screen |

Navigation inside a portal is SPA-style: `SGC.app.showView(name)` swaps the visible
`<section class="view">`, updates the document title and calls the view's render function.
No page reloads, no router library, and every view is still a real bookmarkable panel.

---

## Data model

All records live in `localStorage` under the `sgc.` prefix, managed by `SGC.db`
(`js/storage.js`).

| Collection | Holds |
|---|---|
| `schoolStudents` | Enrolment, class, guardian, contact |
| `schoolTeachers` | Staff number, department, subjects, public biography |
| `schoolClasses` | Class groups, grade, stream |
| `schoolSubjects` | Subjects and their department |
| `schoolTimetable` | Period slots — also the teacher↔class allocation |
| `schoolAttendance` | One register entry per student per date |
| `schoolResults` | One mark per student per subject per examination |
| `schoolAssignments` | Work set by teachers |
| `schoolSubmissions` | Student hand-ins |
| `schoolNotices` | Notices, with category, priority, audience, expiry, attachment |
| `schoolUpdates` | News feed items |
| `schoolEvents` | Events with venue, organiser, times |
| `schoolGallery` | Photographs by category |
| `schoolAchievements` | Awards by level and category |
| `schoolDownloads` | Files and circulars |
| `schoolMessages` | Messaging threads and public enquiries |
| `schoolSettings` | College identity, contact, announcement, statistics, principal |
| `schoolUsers` | Sign-in records — deliberately separate from profile records |
| `schoolUserPrefs` | Per-user device preferences |

The reusable API works over any collection:

```js
SGC.db.all('schoolNotices')                       // array
SGC.db.insertData('schoolNotices', { title: '…' }) // returns the record, id generated
SGC.db.findData('schoolStudents', 'S001')          // by id, or by predicate
SGC.db.updateData('schoolStudents', id, patch)
SGC.db.deleteData('schoolStudents', id)
SGC.db.count('schoolTeachers')
SGC.db.loadData(key, fallback)
SGC.db.saveData(key, value)
SGC.db.getSettings() / saveSettings(patch) / resetDemoData()
SGC.utils.uid('St')                                // generateId
```

`schoolUsers` is keyed separately from `schoolStudents` and `schoolTeachers` on purpose:
when a real identity provider is connected, only that one table is replaced.

Sample data covers 10 students, 5 teachers, 7 notices, 5 updates, 5 events, 10 gallery
images, 5 achievements, 6 downloads and 7 messages, all with invented Sri Lankan names.
**No real personal information is included.**

---

## Authentication design

`js/auth.js` provides:

```js
SGC.auth.login(role, identifier, password, remember)  // async, returns { ok, redirect }
SGC.auth.logout()
SGC.auth.getSession()          // null unless a valid, active user
SGC.auth.hasRole('admin')
SGC.auth.requireAuth(['admin']) // guard: redirects and returns null
SGC.auth.isStaff() / isAdmin()
SGC.auth.profile()              // the linked student / teacher record
SGC.auth.signup(payload)        // self-registration; returns { ok, status }
SGC.auth.setPassword(userId, newPassword)   // async in both modes
SGC.auth.setRemember(on) / remembered()
```

* The session lives in `sessionStorage`, and additionally in `localStorage` when
  **keep me signed in** is ticked.
* `requireAuth()` runs at the top of every portal controller. Unauthenticated visitors are
  sent to `login.html?next=…`; a signed-in user with the wrong role is sent to their own
  home page.
* A user whose record is set to anything other than `Active` is logged out on the next read,
  and a `Pending` or `Rejected` registration is refused at the door with its own message.
* Role checks also drive the interface: student-only panels are never rendered for staff,
  and the whole administration console is invisible to other roles.
* Every call above is a thin shell over `SGC.auth.adapter`. When `js/firebase-config.js` is
  live the adapter forwards to Firebase Authentication; otherwise it uses the demo table.
  No caller knows the difference — including `setPassword()`, which is async in both modes.

**Students are never publicly exposed.** `pages/students.html` explains the portal and
links to the login page; no student record is rendered outside an authenticated session.
`student-signup.html` is the one student-facing form that writes, and what it writes is
marked `Pending` until an administrator approves it.

---

## Security warning — read before deploying

This project is HTML, CSS and JavaScript only. That has hard consequences:

* **`localStorage` authentication is NOT secure and must not be used in production.**
* **Do not store real passwords in production** — or in this demo, which keeps them in
  plain text so the portals can be tried without a server.
* **Do not expose sensitive student information publicly.**
* Front-end role checks are a **usability convenience, not access control**. Anyone can edit
  `localStorage` in DevTools and become an administrator. Every rule enforced here must be
  enforced again on a server.

The code separates the two worlds so the swap is mechanical: `SGC.auth.adapter` is the only
place that verifies a credential, and `SGC.db` is the only place that persists data.

---

## Connecting a real backend

The Firebase integration is **already written** — `js/backend.js` and
`firestore.rules`. Going live is a configuration task, not a coding task. Two
other options are sketched afterwards for comparison.

### 1 · Firebase Authentication + Firestore (included)

#### What is already in place

| Piece | File | Role |
|---|---|---|
| Configuration | `js/firebase-config.js` | The only file you edit. Seven keys plus three options. |
| Backend layer | `js/backend.js` | Loads the SDK **only when configured**, signs in, pulls and writes data. |
| Security rules | `firestore.rules` | The actual access control. Roles, ownership, draft hiding. |
| Storage rules | `storage.rules` | Who may upload a picture, and which files are public. |
| Write-through | `js/storage.js` | Every `SGC.db` save is mirrored to Firestore when it is live. |
| Uploads | `js/backend.js` | A chosen file goes to Cloud Storage and the record keeps its address. |
| Sign-in / sign-up | `js/auth.js` | `SGC.auth` delegates to Firebase when it is live, to `localStorage` when it is not. |

The design is **hydrate once, then read locally**: at start-up every collection
the visitor is allowed to see is pulled into the same `localStorage` keys the
demo already used, so all twenty pages keep reading synchronously and none of
them was rewritten. Writes go to `localStorage` first and to Firestore
immediately afterwards, on a serialized queue that never throws into the
interface. If the network drops mid-save the change is kept on the device and
the administrator sees a toast saying so.

#### Step-by-step

1. **Create the project.** <https://console.firebase.google.com> → *Add project*.
   Any name; Google Analytics is optional.
2. **Register a web app.** Project settings → *Your apps* → `</>` → add a nickname.
   Copy the shown `firebaseConfig` object.
3. **Paste it into `js/firebase-config.js`** — the seven values under `config`, over the
   `REPLACE_…` placeholders. The file deliberately ships with no project identity in it:
   your API key, app ID and sender ID stay in your copy only, and never in a shared or
   published version of this code. `enabled` stays `false` until step 6, because a live
   site with no rules is an open database. `isConfigured()` refuses to go live while any
   value still begins with `REPLACE`, so a half-filled file cannot break the site.
4. **Turn on Email/Password.** Authentication → *Sign-in method* → Email/Password → enable.
   No other provider is used.
5. **Create Firestore.** Data storage (Cloud Firestore) → *Create database* →
   **production mode** → a region close to Sri Lanka (`asia-south1`, Mumbai).

   A brand-new database is **empty**, and live mode replaces the demonstration
   content on the device with what the server holds — so the public pages will
   correctly show nothing until the college publishes something. Import the
   roster, add your classes and publish a first notice before anyone is sent to
   the new address. If the server cannot be reached at all, the site detects it
   and keeps running on the data already cached on that device.

   **Also create the Storage bucket** while you are there: Storage → *Get started* →
   the same region. Photographs and PDF attachments are uploaded there instead of being
   written inside the record, because Firestore allows about 1 MiB per document and one
   phone photograph is already larger than that.
6. **Deploy both rules files.** Firestore → Rules → paste `firestore.rules` → Publish,
   Storage → Rules → paste `storage.rules` → Publish, or:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init        # select Hosting, Firestore and Storage, keep the existing files
   firebase deploy --only firestore:rules,storage
   ```
   **Nothing is private until this step is done.** Do not add real student records before it.
   Deploy it **before anybody registers**: a sign-up creates the Authentication account
   first and its college record second, so with no rules in place the person ends up with a
   password and no record, and the next attempt tells them the ID is already registered. An
   administrator can rescue that from the Students register; nobody else needs to know.
7. **Create the first administrator** (an empty database has no admin, so the rules
   would otherwise refuse to make one):
   * put one private Staff ID in `bootstrapAdminId` in `js/firebase-config.js`, **and the
     same ID into `bootstrapId()` in `firestore.rules`**, then redeploy the rules;
   * open `student-signup.html?role=staff` and register that ID once — it is the only
     registration the site activates without approval;
   * sign in from the **Administrator** tab and confirm the console opens;
   * set `bootstrapAdminId` back to `''`, delete the `bootstrapId()` / `isBootstrap()`
     lines from `firestore.rules`, redeploy. Nobody can now promote themselves.
8. **Deploy the site.** Firebase Hosting serves over https, which live mode needs:
   ```bash
   firebase deploy --only hosting
   ```
   Live mode cannot run from `file://`: the Firebase SDK is loaded as an ES module
   from Google's CDN and browsers block that from a `file://` origin. Live Server,
   any static host or Hosting all work.

#### What each role can see, once rules are deployed

| Action | Visitor | Student | Teacher | Administrator |
|---|---|---|---|---|
| Notices, updates, events, gallery, downloads, achievements, subjects, classes, settings | published only | published only | all | all |
| Staff directory | yes | yes | yes | yes |
| The whole student roster | no | **own row only** | yes | yes |
| Post a public enquiry from the Contact page | **yes** (one shape only, see `schoolMessages`) | yes | yes | yes |
| Mark the register, enter marks, set coursework | no | no | yes | yes |
| Attendance, results, submissions | no | **own rows only** | yes | yes |
| Timetable and assignments | no | own class | yes | yes |
| Messages | no | own thread | own thread | yes |
| Sign-in records (`schoolUsers`) | no | own row | own row | yes |
| Add / edit / delete any record | no | no | no | yes |
| Approve or reject a registration | no | no | no | yes |

Anything not listed is denied: Firestore refuses every request that no rule
explicitly allows, so a collection added later is closed by default.

Because the browser is not the access-control layer, a student's own contact
details are readable only through their own session; the public site never
renders a student record.

#### Student approval, start to finish

```
student opens student-signup.html
  → chooses a password, submits
  → Firebase account <StudentID>@sgcc.sch.lk is created
  → schoolUsers row: status 'Pending'   +   schoolStudents row: status 'Pending'
  → the page confirms and signs them out

administrator opens admin-dashboard → Students → filters Status: Pending
  → ✔ Approve  → both rows become 'Active'
  → ✕ Reject   → both rows become 'Rejected'

student returns to login.html → signs in
  → Pending  → “Your registration is awaiting approval by the college office.”
  → Rejected → “The office could not approve this registration.”
  → Active   → student portal
```

If the office already admitted the student (by hand or by roster import), the
same registration form **links** the new sign-in to that existing record
instead of creating a duplicate — the ID is the join key, so the student picks
their own password without the college ever seeing it.

#### Importing the roster from Google Sheets

Admin console → **Students → ⬆ Import roster**. Two ways in:

* **Paste CSV** — in Google Sheets choose *File → Download → CSV*, paste the text.
  Nothing is published and nothing is shared. This is the default.
* **Fetch a sheet** — set `rosterCsvUrl` in `js/firebase-config.js` to the
  `…/spreadsheets/d/e/<id>/pub?output=csv` link from *File → Share → Publish to web*.
  A published sheet is readable by **anyone who has the link**, and it contains
  names, guardians and telephone numbers. Use it only while you are importing,
  then unpublish it, or keep the sheet to Student ID / name / class columns.
  The link must be a **published** one: an ordinary
  `…/export?format=csv&key=…` address asks the browser to send your Google
  sign-in cookie, the sheet's host refuses the cross-origin request, and the
  import reports that it could not read the sheet. Paste the CSV in that case.

Recognised headers (case, spaces, `-` and `_` are all ignored): `studentId`,
`fullName`, `class`, `grade`, `admissionNo`, `guardianName`, `phone`, `email`,
`status`. `class` accepts a class ID (`CLS11A`), a full class name
(`Grade 11 - Science`) or a bare grade number. An existing Student ID is
updated, an unknown one is admitted as Active, and **empty cells never overwrite
data that is already there** — a partial sheet cannot wipe a student's class.
The import runs through the same `SGC.db` write path, so it reaches Firestore
exactly like a hand-typed record and creates the matching sign-in row.

#### Optional: custom claims

`firestore.rules` derives a role by reading the caller's own `schoolUsers` row
with `get()`, which needs no server code. If you would rather carry the role in
the token, add a Cloud Function that sets `role` and `linkedId` claims on user
creation and simplify the rules to `request.auth.token.role == 'admin'`. The
client does not depend on claims, so this is a pure optimisation.

#### Going back to the demo

Set `enabled: false` in `js/firebase-config.js`. The SDK is never fetched again, and
the rows the server had already put on the device stay there — except that any
collection the server left **empty** is refilled with the demonstration content on the
next load, so a switch back never produces a blank website. (A collection *you* emptied
while running the demo is left alone; only a device that was live is repaired.) Admin
console → *Settings → Reset demonstration data* restores the whole sample college.

### 2 · Supabase

```js
async verify(identifier, password, role) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: identifier + '@sgcc.sch.lk', password });
  if (error) return { ok: false, error: error.message };
  const { data: me } = await supabase.from('users').select('role, linked_id').single();
  return me.role === role ? { ok: true, userId: data.user.id, role, linkedId: me.linked_id }
                          : { ok: false, error: 'Wrong portal.' };
}
```

Enable Row Level Security on every table; policies check `auth.uid()` and the role stored
against that user. Supabase Storage replaces the `assets/` uploads.

### 3 · PHP + MySQL

```js
async verify(identifier, password, role) {
  const r = await fetch('/api/login.php', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password, role }),
  });
  return r.json();          // { ok, userId, role, name, linkedId }
}
```

Server side: `password_hash()` on write, `password_verify()` on read, a session cookie with
`HttpOnly`, `Secure` and `SameSite=Lax`, and a role column checked in **every** endpoint —
never trust a value the browser sends. Rewrite `SGC.db` as `fetch()` calls to prepared
statements.

### In all three cases

1. Delete `DEMO_PASSWORDS` from `js/auth.js`, and the `demoPassword` field from every
   record in `SEED_USERS` in `js/storage.js`. The login page already shows nothing —
   the demonstration block that used to list accounts there has been removed.
2. Delete the **Reset demonstration data** panel from the administration console.
3. Serve the site over HTTPS.
4. Clear the site's data on every device that used the demo — sign-in records,
   notices and settings left in `localStorage` belong to nobody once the server
   is the source of truth. A visitor can do it from their browser's site
   settings; the console's reset panel rewrites the demonstration content.

---

## Languages and theming

* **English** and **Sinhala (සිංහල)** switch with the `EN | සිං` control in the navigation
  bar, the portal sidebars and Settings. The choice is remembered on the device.
* Content records carry Sinhala in a suffixed field — `title` / `titleSi`,
  `body` / `bodySi`, `name` / `nameSi`. `SGC.i18n.loc(record, 'title')` returns the Sinhala
  version when it exists and falls back to English when it does not, so partial translation
  never produces blanks.
* Interface strings live in the `I18N` table in `js/app.js` and are applied through
  `data-i18n` attributes. **Technical and administrative labels — "Attendance", "Results",
  "Register", field names in the console — stay in English by design**, since these are
  terms of art in Sri Lankan school administration and translating them would make the
  console harder to use.
* Dark mode toggles `data-theme="dark"` on `<html>` and is shared between the website and
  all three portals.
* When Sinhala is active, `SGC.i18n` adds an `is-si` class to `<html>`, which swaps in a
  Sinhala-first font stack (`Noto Sans/Serif Sinhala`, `Iskoola Pota`, `Nirmala UI`) so
  conjuncts shape correctly instead of falling back mid-word.

> **Please have the Sinhala copy reviewed by a native speaker before publishing.** The
> seeded Sinhala strings are plausible placeholder content, not an approved translation.

---

## Branding and assets

* `assets/logo.png` is the official crest. It is used **exactly as supplied** — never
  recoloured, redrawn, stretched or filtered — in the navigation bar, announcement bar,
  login page, loading screen, all three portal sidebars, the profile card, notices, the
  footer and the favicon.
* `assets/school-front.jpg` is the entrance photograph used in the home hero, the login
  page background and the profile card covers.
* Staff and student photographs are **optional**. Drop a file named after the record's
  identifier into `assets/teachers/` or `assets/students/`, or upload one through the
  console — an image that fails to load falls back to a coloured initials avatar, so no
  broken image icon can ever appear.
* The six files in `assets/documents/` are **generated placeholders** so the Downloads page
  is functional out of the box. Replace them with the real circulars.

Colours follow the National School palette: deep maroon `#6E172D`, gold `#D4A842`, cream,
white and near-black text, defined as CSS custom properties at the top of `css/style.css`.

---

## Resetting the demonstration data

Administration console → **School Information** → **Danger zone** → *Reset demonstration
data*. This restores every seeded collection and setting in this browser and signs you out.

Or from DevTools:

```js
SGC.db.resetDemoData(); location.reload();
```

Data is per browser and per device. Nothing is shared between machines, and clearing site
data removes it permanently.

---

## Accessibility and SEO

* Semantic landmarks (`header`, `nav`, `main`, `section`, `article`, `footer`), one `h1`
  per page, ordered headings.
* Every form control has a real `<label>`; icon-only buttons carry `aria-label`; modals use
  `role="dialog"` with `aria-modal`, focus trapping and `Esc` to close.
* Skip-to-content link, visible focus rings, keyboard-operable menus, tabs, filters,
  lightbox (`←` `→` `Esc`) and search (`Ctrl` / `Cmd` + `K`).
* `prefers-reduced-motion` disables the animation layer.
* Per-page `<title>` and meta description, Open Graph and Twitter cards, canonical
- friendly URLs, `noindex, nofollow` on the authenticated pages, JSON-LD
  `EducationalOrganization` on the home page, and the crest as the favicon and
  apple-touch-icon.
* Print stylesheet hides the navigation, portal chrome and actions.

---

## Known limitations

* **In the offline demonstration build, authentication and authorisation are front-end
  only** — see the security warning. With Firebase configured, both move to Google's
  servers and `firestore.rules`.
* Live mode needs an HTTP origin: the Firebase SDK is an ES module from a CDN, which
  `file://` blocks. The demonstration build is unaffected.
* The live read model pulls each collection once at start-up rather than subscribing to
  changes, so a second administrator's edits appear on reload, not instantly. Attach
  `onSnapshot` inside `pullAll()` if you want live pushing.
* **Uploads behave differently in the two modes.** With a backend live, a chosen
  photograph or PDF is sent to Cloud Storage under `sgc/…` and the record keeps only its
  download address (`storage.rules` decides who may write there). In the offline
  demonstration there is no bucket, so an image is kept as a data URL inside
  `localStorage` — which caps near 5 MB per origin — and a PDF records its name and size
  only, with a message saying so. Files referenced by path under `assets/` (the crest,
  the entrance photograph) are served by Hosting and are never uploaded.
* An uploaded file is not deleted when its record is deleted: the console removes the row
  and the picture stays in the bucket until it is cleared from the Storage tab. Add a
  Cloud Function triggered on document delete if that matters.
* **The Contact page writes to Firestore without signing in** — `firestore.rules` allows
  exactly one shape (a public enquiry addressed to the office, bounded in length) so that
  visitors can reach the office from the website. Anyone on the internet can therefore
  post that shape. Register the site with Firebase **App Check** (console → App Check →
  register a web app) before publishing the page, or delete the anonymous clause from the
  `schoolMessages` block and tell visitors to telephone or e-mail instead.
* The contact form records the enquiry; it sends no e-mail until a backend function is
  attached to the submission.
* The Google Maps embed needs an HTTP origin, so it stays blank under `file://`.
* Sinhala content is partial by design; untranslated fields fall back to English.
* Charts are hand-drawn SVG (`SGC.charts.bar / line / donut`) — enough for the school
  dashboard, not a general charting library.
