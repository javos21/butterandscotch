# Butter & Scotch

Made-to-order bakes from Butter & Scotch, Trinidad. Customers order without an account. Staff
verify payments and move each order through production from the admin.

Stack: Next.js 16 (App Router), React 19, Supabase (Postgres, Auth, Storage), Tailwind CSS,
React Email for templates, Brevo for transactional email.

## Local setup

Requires Node.js and Docker (for the local Supabase stack).

1. Install dependencies and start the local Supabase stack:

   ```bash
   npm i
   npx supabase start
   ```

2. Copy the local keys into `.env.local`. Run `npx supabase status -o env` and map the output to
   these variables:

   | `.env.local` variable | `supabase status` output |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` |

   Also set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. `.env.example` lists every variable.
   Leave `EMAIL_PROVIDER` unset or `console` locally, so emails are logged instead of sent.

3. Reset the database. This applies the migrations and the seed data:

   ```bash
   npm run db:reset
   ```

   This applies every file in `supabase/migrations/` and then `supabase/seed.sql` (menu, areas,
   settings and the seed staff logins). Run it again after changing a migration or the seed.
   The local stack uses ports in the 553xx range (API 55321, database 55322); see
   `supabase/config.toml`.

4. Start the app:

   ```bash
   npm run dev
   ```

   The local seed logins are `SEED_STAFF_EMAIL` and `SEED_DEV_EMAIL` in `.env.example`
   (seeded by `supabase/seed.sql`). They are for local development only.

Sign-up is disabled in `supabase/config.toml` (`enable_signup = false`). After changing it, run
`npx supabase stop` and then `npx supabase start` to apply it.

## Tests

- Unit tests (Vitest): `npm test`. Integration suites (`*.int.test.ts`) need the local Supabase
  keys in the environment, so they are skipped by default. To run them:
  `node --env-file=.env.local node_modules/vitest/vitest.mjs run`
- End-to-end (Playwright): `npx playwright test`. Two projects run: desktop Chrome, and a 375 px
  wide mobile viewport (Pixel 7 device). The config starts `npm run dev` if it is not already
  running. The e2e tests write orders to the local database, so run `npm run db:reset` first.
- Lint and types: `npm run lint` and `npx tsc --noEmit`.

## Deploy on Render

- [ ] Create the Supabase cloud project and run `npx supabase db push`.
- [ ] Create the Render web service and set the environment variables from `.env.example`
      (Supabase URL and keys, `NEXT_PUBLIC_SITE_URL`).
- [ ] Brevo: authenticate the sending domain (DKIM and DMARC DNS records), verify the sender,
      create a transactional API key, and set `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`,
      `EMAIL_FROM` and `EMAIL_FROM_NAME`.
- [ ] Disable email signups in the cloud project's Auth settings. `supabase/config.toml` does not
      apply to the cloud project, so set it there.
- [ ] Never run the local seed against the cloud project. The seed staff password is public in
      `.env.example`.
- [ ] Create the real staff users in Supabase Auth, then insert a `staff` row for each user
      (`user_id` is the Auth user's id, `name` is the display name):

      ```sql
      insert into staff (user_id, name) values ('<auth-user-uuid>', 'Staff name');
      ```

- [ ] Regenerate `lib/database.types.ts` from the cloud schema, so the types match production.
- [ ] Triage `npm audit` and fix or accept each finding before launch.
