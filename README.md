# SnackFlow

**From Order to Audit. One Connected System.**

SnackFlow is a phased ERP prototype for a small South Indian packaged-snacks manufacturer. The current implementation includes Supabase Authentication, profile roles, PostgreSQL migrations and RLS, live master-data and inventory-ledger pages, and an atomic production workflow. Dashboard preview figures remain illustrative and are not queried from the database.

## Project structure

```text
src/
  components/layout/  Shared application shell
  pages/              Route-level screens
  lib/                Supabase client, generated types, permissions and data utilities
  hooks/              Shared data loading hooks
  components/         Shared application shell and reusable UI
  pages/              Route-level master, inventory and production screens
  styles.css          Tailwind entry point and global styles
supabase/
  migrations/         Versioned PostgreSQL schema, triggers and RLS
  seed.sql             Reproducible benchmark master data and opening ledger entries
  tests/               pgTAP schema, RLS-policy and ledger checks
```

## Requirements and setup

- Node.js 20.19+ (or 22.12+) and npm, as required by the current Vite toolchain.
- A Supabase project for hosted auth, or the Supabase CLI plus Docker for a local stack.

```bash
npm install
npm run dev
```

Vite prints a local URL in the terminal. Create a production bundle with `npm run build`; run `npm run typecheck` for TypeScript checks.

## Environment variables

Copy `.env.example` to `.env.local` and provide the Supabase project URL and public anon key:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

The anon/publishable key is intended for browser use and is safe only because database tables enforce RLS. Never put a Supabase service-role/secret key in a `VITE_` variable or browser code. If the variables are missing, the login screen explains how to configure them and does not attempt a fake sign-in.

## Supabase database setup

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and Docker Desktop for a local database. From the project folder:

```bash
supabase start
supabase db reset
supabase test db
```

`db reset` recreates the local database, applies all migrations, then runs `supabase/seed.sql`. Studio, Auth and API URLs/keys are printed by `supabase start`; copy the API URL and anon key to `.env.local`. `supabase test db` runs Phase 2 security/ledger checks and production calculation, stock-posting, insufficient-stock, rollback, and role tests.

For a hosted project, create the project in Supabase, then run `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, and `supabase db push`. Apply the benchmark seed using the Supabase SQL Editor or a trusted `psql` connection. Hosted migrations and seed changes should be reviewed before applying them to a database containing real data.

## First user and role setup

There is no public sign-up screen. In a hosted Supabase project, disable public user signups in Auth settings while leaving the email provider enabled for sign-in. Create or invite the first user from Supabase **Authentication → Users**, then sign in through SnackFlow. A database trigger creates that user's profile with the safe default role `salesman`; profile metadata cannot set a privileged role. To bootstrap the first owner, find the user's UUID in the Auth Users table and run once in Supabase SQL Editor:

```sql
update public.profiles
set role = 'owner'
where id = 'AUTH_USER_UUID_HERE';
```

Only an owner can change roles through an authenticated database session. The SQL Editor is a privileged administrative context and can bypass RLS, so use it only for trusted setup. For additional users, create/invite them in Auth and assign their role as the owner. No sample passwords or test users are seeded.

## Current scope and next steps

The UI filters navigation by authenticated role, but PostgreSQL RLS and narrowly scoped workflow RPCs remain the security boundary. Production drafts snapshot the active BOM; completing a run atomically stores actual consumption and output and posts material issues plus good finished output to the inventory ledger. Orders support salesman submission, admin stock approval, GST invoice issuance and atomic ledger-based dispatch. Purchases, payment allocations and financial reports are reserved for later phases. The dashboard uses labeled illustrative demo data rather than claiming to show live data. The printable invoice currently has no supplier GSTIN because the business profile schema does not yet store it; configure this before using invoices as statutory documents. Deployment to Vercel is deferred until operational configuration is reviewed.

## Dependencies by milestone

The frontend uses Recharts and Framer Motion. Supabase JS powers Auth and typed PostgREST access. React Hook Form, Zod, jsPDF, SheetJS (`xlsx`) and Vitest remain planned for the later workflows that need them.
