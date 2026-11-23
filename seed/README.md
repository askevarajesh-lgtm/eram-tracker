# Seed data

Any `.json` file in this folder is loaded automatically the **first time** the app starts with an **empty** database
(on Vercel, the first request; on Docker or Node, at the first page load). Once the database has records, seeding never runs again,
so later edits are never overwritten.

**Format:** the old tracker's *Admin panel → Data → JSON backup* file, as it is:
`{ "modules": [ {"id": "...", ...} ], "items": [...], "developers": [...], "users": [...], "companies": [...], "licenses": [...], "rollout": [...], "daily": [...], "manuals": [...], "settings": [...] }`

- `members` is skipped, because people get new sign-in accounts. `audit` is skipped too.
- Several files load in alphabetical order. A later file wins when two records share an ID.
- Load manually: `npm run seed` (empty database only), `npm run seed -- --force`, or `npm run seed -- path/to/backup.json --force`.
- With Docker: `docker compose exec app npm run seed -- --force`
- To turn off automatic seeding, set `SEED_ON_START=false`.
