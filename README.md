# SnackFlow ERP
### Order-to-Audit Manufacturing Management System

SnackFlow is a web-based ERP system designed for South Indian snack manufacturing businesses. It connects sales, production, inventory and order fulfilment through a centralized database with transaction tracking.

## Features

### Authentication & Role-Based Access
- User authentication using Supabase Auth
- Role-based access control
- Database security using Row Level Security (RLS)

### Master Data Management
- Product management
- Customer management
- Supplier management
- Raw material management
- Bill of Materials (BOM)

### Inventory Management
- Raw material and finished goods tracking
- Stock movement ledger
- Opening stock adjustments
- Production consumption and finished goods receipts
- Dispatch-related stock deductions

### Production Management
- Production runs based on BOM
- Planned vs actual material consumption
- Good output and rejection tracking
- Wastage and yield calculations
- Production variance tracking

### Sales & Order Management
- Sales order creation
- Order submission and approval
- Stock availability validation
- GST calculations
- Invoice generation
- Dispatch processing

## Technology Stack

- Frontend: React, TypeScript, Vite
- Styling: Tailwind CSS
- Backend: Supabase
- Database: PostgreSQL
- Authentication: Supabase Auth
- Security: Row Level Security (RLS)
- Version Control: Git and GitHub

## Running Locally

### Prerequisites
- Node.js and npm
- Docker Desktop
- Supabase CLI

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/sivanier/SnackFlow.git
   cd SnackFlow
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start local Supabase:

   ```bash
   npx supabase start
   ```

4. Start the frontend:

   ```bash
   npm run dev
   ```

5. Open the application at:

   ```text
   http://localhost:5173
   ```

## Testing & Validation

- Database tests executed using Supabase CLI
- 105 database tests passed across 3 SQL test files
- TypeScript type checking completed successfully
- Production build completed successfully
- Production, inventory and sales workflows validated locally

## Known Limitations

- Dashboard analytics currently use illustrative preview data.
- Purchases, Payments and Reports modules are preview-only.
- The dedicated Invoices page is preview-only; invoice issuance is available through the Orders workflow.
- Some packaging category labels and BOM decimal precision require further refinement.

## Project Status

SnackFlow is a working local prototype demonstrating manufacturing, inventory, order processing, GST invoice issuance and dispatch workflows.

## Repository

GitHub: https://github.com/sivanier/SnackFlow

---

**Project:** SnackFlow ERP  
**Purpose:** Order-to-Audit Manufacturing Management  
**Developer:** Sivani E R