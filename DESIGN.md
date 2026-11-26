# SnackFlow design and architecture notes

## Frontend and authentication

Vite serves and bundles a React single-page application. TypeScript checks the UI, Supabase client, and future business modules. React Router owns URL-to-page mapping. `AuthProvider` restores the Supabase session, loads the matching profile, and exposes sign-in, sign-out, and display-name update actions. `ProtectedRoute` keeps unauthenticated sessions out of application routes. The shared layout is in `src/components/layout`; route screens are in `src/pages`.

The UI filters navigation for clarity, but frontend role checks are not security controls. PostgreSQL RLS policies enforce data access even if a client bypasses navigation. The browser uses the public anon/publishable key with RLS; no service-role key is bundled. Business rules will live in pure TypeScript modules under `src/domain` and workflow UI in `src/features`.

## Database relationships and authorization

Profiles attach application roles to authenticated Supabase users. Customers may be assigned to a salesman profile. Products reference pack and stock units; effective-dated product prices reference products. Raw and packaging materials each have a stock unit. BOM headers reference products and BOM items reference exactly one raw or packaging material. Business locations store factory state metadata. Sales orders snapshot effective prices, product names, GST rates and tax amounts; invoices copy that immutable snapshot and dispatches post source-linked movements. Audit logs store the changed record, actor and timestamp.

UUID primary keys, foreign keys, numeric checks, unique idempotency keys, source-line uniqueness and indexes enforce consistency. The `has_any_role` security-definer helper reads `profiles` without recursive RLS checks. Auth user metadata is never trusted to grant a role: a database trigger assigns new accounts the least-privileged default `salesman` role. Only an owner can change roles in an authenticated request. The first owner is bootstrapped in Supabase SQL Editor, which is a privileged administrative context. Production tables are readable by owner/admin/production/accountant under RLS; only owner/admin/production can create or complete runs, through database functions that validate the role explicitly. Authenticated users receive no direct write grants on production records or outputs.

### Role permissions in Phase 2

| Role | Database access in this phase |
| --- | --- |
| Owner | Business-wide masters, customers, inventory, BOM, production and audit logs; may manage roles and operational masters |
| Admin | Manage operational masters and customers; create/complete production runs; read/append permitted inventory movements; read audit logs |
| Salesman | Read products/prices and only customers assigned to their own profile; profile access is self-only |
| Production | Read production inputs, suppliers, BOM, inventory and production history; manage material/BOM masters; create/complete production runs |
| Accountant | Read-only product, supplier, material, BOM, inventory, production and audit data |

Salesmen can create orders only for assigned customers and see only orders they created. Owner/admin users approve orders, issue invoices and dispatch. Accountants can read invoice and dispatch records. Writes use narrowly scoped security-definer functions with explicit role checks; there are no direct authenticated write grants on posted sales or invoice tables.

## Inventory ledger

Inventory balances are derived from append-only movements: opening stock + purchase/production receipts + inward adjustments − production issues − dispatches − outward adjustments. Each movement stores exactly one raw material, packaging material, or finished product; quantity; stock unit; movement type; optional unit cost; source document; timestamp; actor; and required idempotency key. Unique source-line constraints prevent duplicate posting of the same document line. There is no editable stock balance column. The `inventory_balances` view sums signed movements.

An insert trigger takes a transaction-scoped advisory lock for the item, verifies the movement uses its stock unit, and rejects issues or dispatches that would make the balance negative. Update and delete attempts fail; corrections must be new movements. Future multi-row workflows must post all their movements inside one database transaction/function.

## BOM and production engine

BOM scaling multiplies each standard input quantity by requested output divided by the active BOM baseline output. The database snapshots those planned quantities in each draft run, along with its BOM version and stock units, so later BOM edits do not alter a run already in progress. Mass, volume and count quantities stay in the exact item unit; the system does not infer conversions between packets, pouches or cartons.

Completion accepts an explicit actual quantity for every planned material and stores good output, rejected output and wastage separately. Consumption variance is `(actual − planned) / planned × 100`; yield is `good output / planned output × 100`, and yield variance is `(good output − planned output) / planned output × 100`. Rejection and wastage rates use total recorded output (`good + rejected + wastage`) as their denominator. A tolerance initially set to 3% highlights material consumption variance and yield variance in the UI.

Run creation and completion are narrowly scoped PostgreSQL functions. Completion locks the draft, validates that every planned input is supplied once, and posts each positive actual raw-material/packaging issue plus a finished-goods receipt for good output. The inventory trigger locks each item and checks stock. PostgreSQL runs the whole function call in one transaction, so a shortage, duplicate source line or other insert failure rolls back the output row, run status, consumption values and all movements together. Rejected output and wastage are recorded as production metrics and are not added to finished-goods stock. Posted movements remain append-only and reference the production run and source line for traceability.

## Order, invoice and dispatch workflow

Order creation obtains the current effective product price and GST rate from PostgreSQL, snapshots the sales line, and calculates taxable amount and GST using `NUMERIC(14,2)`. Same-state sales split GST equally into CGST and SGST; inter-state sales use IGST. Each invoice receives a sequence-backed number and Indian financial-year label, and invoice lines retain the order's saved prices/tax values. Invoices have no authenticated update/delete grants. The invoice print page uses stored values and browser print-to-PDF. The current business-location schema has no supplier GSTIN or registered address, so this prototype invoice must not be treated as a statutory GST document until issuer details are configured.

Approval validates available finished stock. Dispatch locks all affected product ledger keys in stable order, checks stock again, and inserts the dispatch record and each immutable `dispatch` movement in one transaction. The ledger's own movement guard repeats unit and non-negative stock checks. Any failed movement rolls back the entire dispatch function call. Dispatch is the final stock validation because approval does not reserve inventory.

## GST amount rules

Taxable line amounts will use paise-safe prices. For same-state sales, 5% GST is split into 2.5% CGST and 2.5% SGST. For inter-state sales, the full 5% is IGST. Invoice totals use integer paise or PostgreSQL `NUMERIC`, with explicit rounding rules. Posted invoices are immutable; corrections use credit notes.

## Costing method (future phase)

Raw materials use moving weighted-average valuation: `(prior inventory value + receipt value) / (prior quantity + receipt quantity)`. Production cost includes actual recorded raw and packaging consumption plus directly allocated labour and utility overhead. Cost per packet divides total run cost by good packets. The benchmark assigns ₹1,800 labour and gas/power overhead to its single run. Damaged pouches and cartons used count as packaging consumption.

## Units and benchmark assumptions

Each inventory item has a stock unit and movements must use that exact unit. Mass and volume units have base factors; piece/packet/carton conversions are item-specific and are not inferred from a generic count conversion. The seed has flour 100 kg at ₹42/kg, oil 30 litres at ₹140/litre, spice mix 5 kg at ₹200/kg, pouches 500 pieces at ₹2.50/piece, cartons 30 pieces at ₹15/carton, and 50 finished Murukku packets. It also seeds the Murukku 200 g product (₹50, 5% GST), a 200-packet BOM and a Tamil Nadu location (state code 33). It creates no customers, suppliers, user accounts or passwords.
