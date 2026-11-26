\# SnackFlow ERP — Testing \& Validation Log



\*\*Project:\*\* SnackFlow ERP — Order-to-Audit Manufacturing Management System

\*\*Testing date:\*\* 26 November 2026

\*\*Environment:\*\* Local development environment (React/Vite + Supabase/PostgreSQL)

\*\*Tester:\*\* Project Developer



\## 1. Automated Validation



| Test | Result |

|---|---|

| Supabase database tests | PASS — 105 tests across 3 SQL test files |

| TypeScript type check | PASS |

| Production build | PASS |

| Security pattern scan | No flagged patterns found in the checked files |



\## 2. Functional Workflow Testing



| Test Case | Expected Result | Actual Result | Status |

|---|---|---|---|

| Admin login | Admin workspace access | Admin access verified | PASS |

| Customer creation | Customer saved | Krishna Stores created | PASS |

| Product creation | Product saved | Banana Chips 200g created | PASS |

| Supplier creation | Supplier saved | Demo supplier created | PASS |

| Material creation | Materials saved | Banana and packaging materials created | PASS |

| BOM creation | Recipe inputs linked | Banana Chips BOM created | PASS |

| Inventory adjustment | Stock ledger movement recorded | Demo opening stock posted | PASS |

| Production completion | Material consumption and FG receipt posted | 250 packets produced | PASS |

| Production yield | Good output calculated | 250 good, 0 rejected, 0 wastage | PASS |

| Order creation | Customer order saved | 10 packets ordered | PASS |

| Order approval | Stock availability validated | Order approved | PASS |

| GST invoice issuance | Tax invoice generated | SF/2026-27/000006 issued | PASS |

| Dispatch | Stock deducted through ledger | 10 packets dispatched | PASS |

| Closing stock verification | Stock balance correct | 250 − 10 = 240 packets | PASS |

| Ledger verification | Source-linked movements visible | Production receipt and dispatch visible | PASS |



\## 3. Inventory Verification



| Item | Verified Balance |

|---|---:|

| Raw Banana | 50 kg |

| Food Packaging Pouch | 250 pc |

| Cooking Oil | 25 L |

| Salt \& Spice Mix | 4.5 kg |

| Banana Chips 200g | 240 packets |



The production receipt of 250 packets and dispatch of 10 packets were visible in the inventory movement ledger.



\## 4. Sales \& GST Verification



\- Customer: Krishna Stores (demo customer)

\- Order quantity: 10 packets

\- Unit price before tax: ₹100

\- Taxable amount: ₹1,000

\- IGST: ₹50

\- Invoice total: ₹1,050

\- Invoice number: SF/2026-27/000006

\- Order status after dispatch: Dispatched



\## 5. Known Limitations / Not Implemented



| Module | Observed Status |

|---|---|

| Dashboard analytics | Illustrative demo figures, not connected to live transactions |

| Purchases | Preview-only |

| Dedicated Invoices page | Preview-only; invoice issuance works through Orders |

| Payments | Preview-only |

| Reports | Preview-only |

| Packaging classification | Newly created pouch displayed under Raw material category in inventory/BOM UI |

| BOM numeric precision | Small floating-point precision artifact observed in planned quantity display |



\## 6. Conclusion



The core production-to-sales workflow was successfully validated in the local environment. Production completion, inventory ledger posting, order approval, GST invoice generation and dispatch were verified through the application UI.



Dashboard analytics, purchase workflow, dedicated invoice listing, payment recording and reporting remain incomplete or preview-only and should be disclosed during demonstration and submission.

