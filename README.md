# Dev 360 Tracker (ERAM HCM Business Tools)

Tracks development across SAP B1, ATS, CRM, LMS and other projects: tasks, developers, application users, licences, urgent issues, UAT sign-off, calendar, reminders, team chat and reports.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Prisma 6 · PostgreSQL

> **All pages are rebuilt** on Next.js. The previous single-page app is kept in `legacy/` for reference only; it is not used by the new app.

---

## Project layout

```
prisma/
  schema.prisma          database tables (one model per entity, real relations)
  migrations/            SQL migrations, applied with `prisma migrate`
src/
  app/
    layout.tsx           <html>, fonts, theme
    login/               sign-in / first-run setup
    (app)/               every signed-in page; layout.tsx = sidebar + header + auth check
      page.tsx           Development stats (home)
      tasks/ issues/ users/ licences/ developers/ projects/ accounts/ account/
      approvals/ uat/ plan/ reports/ health/ overview/ delivered/ workload/
      calendar/ reminders/ chat/ daily/ admin/ admin-panel/ manuals/
    api/health/          uptime check
    api/export/          Excel workbook / upload template
    api/reports/[kind]/  day, developer day, week and management summary workbooks
    api/assets/          file upload / download (attachments are stored in Postgres)
  components/            UI: shell/ (sidebar, header), ui/ (panel, chip, toast), tasks/, developers/, projects/
  server/                "use server" actions (all writes) + queries.ts (reads)
  lib/                   db client, session, permissions, audit, dates, constants, navigation
  middleware.ts          sends signed-out visitors to /login
scripts/
  migrate-legacy.ts      copies data from the old app into the new tables
  seed.ts                creates accounts from seed/accounts.json
  set-password.ts        reset a password from the command line
legacy/                  the previous app, kept for reference during the migration
```

**How data flows:** pages are server components that read with Prisma. Forms are client components that call server actions in `src/server/*`. Every action checks the signed-in account and role, writes in a transaction, adds an audit entry, and then refreshes the affected pages.

**Database design:** each entity has its own table: `Project`, `Task`, `Developer`, `Company`, `Issue`, `AccessRecord`, `Licence`, `Meeting` and others. Foreign keys link them, and many-to-many links use join tables (`TaskAssignee`, `LicenceAssignment`, …).

**Accounts vs. Users & access:** only `Account`s use the tracker: they sign in, have a role, and appear in approvals, chat, reminders and the audit log. The **Users & access** page is a register (`AccessRecord`) of people in the companies and the software and licences allocated to them. Those people never sign in, and nothing about permissions depends on them. Task status and priority are Postgres enums. Status history is stored in `TaskEvent` and every change is logged in `AuditEntry`. Tables live in the `app` Postgres schema (`?schema=app`), so they never clash with the old app's tables during migration.

---

## Pages

| Area | Pages |
|---|---|
| Overview | Development stats (developer cards, daily updates, activity, reminders), Approvals, Urgent issues, Calendar, Reminders, Team chat, Admin dashboard (companies, licence position), Eram HCM board (rollout matrix, day notes) |
| Delivery | Development overview, Tasks & assignment (time log, files, history, share), Work on hand (load, hand over), UAT & sign-off, Plan & control (milestones, change requests, releases, risks), Reports, Delivered software, User manuals |
| People & access | Developers, Users & access (register), Licences |
| Setup | Projects, Data health (checks + bulk fixes), Sign-in accounts, Admin panel (notifications & templates, lists, activity log, data) |

Messages (reminders, invites, "send for UAT") open WhatsApp or the email app with the text filled in; the server never sends messages itself. Search everything with **Ctrl+K**.

## Excel upload and download

- **Download Excel** (header button, `GET /api/export`) builds the workbook from the database: Status Report (SAP "Over All Status Report" column order plus extras), Module Summary, Open & Pending, Delivered Software, User Manuals, Developers, Application Users, Companies, Licences and Licence Assignments. `GET /api/export?template=1` is the blank upload template with a Help sheet.
- **Upload** (admins) reads .xlsx/.xls/.csv **in the browser** (SheetJS), so the file itself is never stored. Columns are matched by name (`src/lib/excel/normalize.ts`), and rows whose last four columns slipped left are realigned. Tasks match existing ones by Ref, then Project + S.No, then Project + Details + Module, and unchanged rows are skipped. New developers, projects and companies are created.
- The server runs the import in **one transaction** (`src/server/import.ts`): it all saves, or nothing does. The preview runs the same code and rolls back, so it shows exactly what the import will change.

SheetJS is installed from its official site (`cdn.sheetjs.com`), because the copy on the npm registry is out of date.

## Run locally

Needs Node 20+ and Docker (for Postgres).

```bash
npm install
npm run db:up                       # Postgres 16 on localhost:5433
cp .env.example .env                # then set SESSION_SECRET
npm run db:migrate                  # create the tables
npm run migrate:legacy -- --json seed/eram-hcm-2026-10-26.json   # load data (or --sqlite / LEGACY_DATABASE_URL, below)
npm run db:seed                     # create the sign-in accounts from seed/accounts.json
npm run dev                         # http://localhost:3000
```

Other commands: `npm run db:studio` (browse the data), `npm run typecheck`, `npm run build`, `npm run set-password -- email "new password"`.

To change the schema, edit `prisma/schema.prisma` and run `npm run db:migrate -- --name what-changed`. Commit the generated migration.

## Moving the live data from the old app

`scripts/migrate-legacy.ts` only **reads** the old data. It never changes the old tables. Old ids are kept, so links between records stay valid, and fields with no column yet are kept in each row's `extra` JSON column. Accounts keep their passwords, and anyone already signed in stays signed in if `SESSION_SECRET` is unchanged.

```bash
# 1. preview: reads and transforms, writes nothing, lists any warnings
LEGACY_DATABASE_URL="postgres://...neon.../neondb?sslmode=require" npm run migrate:legacy -- --dry-run

# 2. create the new tables in the same (or a new) database
DATABASE_URL="postgres://...neon.../neondb?sslmode=require&schema=app" npm run db:deploy

# 3. copy the data
LEGACY_DATABASE_URL="..." DATABASE_URL="...&schema=app" npm run migrate:legacy
```

Other sources: `-- --sqlite legacy/data/dev360.db` (the old local file) or `-- --json backup.json` (an Admin panel JSON backup). `--force` empties the new tables first, so the migration can be re-run.

## Deploy to Vercel + Neon

1. In Vercel → Settings → Environment Variables set:
   - `DATABASE_URL`: the Neon connection string with `&schema=app` added
   - `SESSION_SECRET`: the **same** value as the old deployment, so people stay signed in
   - optional: `ALLOWED_EMAIL_DOMAIN`, `ALLOW_SIGNUP`, `OPEN_ACCESS`, `APP_NAME`
2. Set Framework Preset to **Next.js**. The `vercel-build` script runs `prisma migrate deploy` and then builds.
3. Run the data migration above once, before switching users over.

If Neon's pooled connection string gives migration errors, use the direct (non-pooled) string for `prisma migrate deploy`.

## Who uses the tracker

- **Sign-in accounts** (Setup → Sign-in accounts, admins only) are the IT team who use the tracker. New accounts are **Admin**. The only other role offered is **Viewer** (read-only), which self-sign-ups get until an admin changes it. Admins add accounts with a temporary password, reset passwords, and suspend accounts (history is kept). Everyone can change their own password under **My account** (click your name in the sidebar).
- **Developers** are a separate list: the people tasks and issues are assigned to. Link an account to a developer record when the person both signs in and builds things. Contract developers can be developers without an account.
- **Users & access** is a register of people in the companies and the systems and licences allocated to them. They never sign in.

The Manager and Developer roles from the old app still exist in the code for later, but aren't offered in the UI. `OPEN_ACCESS=true` treats every account as Admin (off by default).

## Environment variables

See `.env.example`.
