# Standard Test Data Setup Instructions

## Quick Setup

### Step 1: Close the Electron App
Make sure the insightLM-LT app is completely closed.

### Step 2: Backup Your Data (Optional but Recommended)
```bash
node tests/backup-workbooks.mjs
```

Your workbooks will be backed up to a timestamped folder.

### Step 3: Create Standard Test Data
```bash
node tests/create-standard-test-data.mjs
```

This creates a standard airplane development dataset with:
- **AC-1000 Aircraft**: 5 markdown files with MOS data, requirements
- **Test Schedule**: 2 markdown files with test dates and milestones
- **Supplier Agreements**: 3 markdown files with NDA expiration dates
- **Budget & Costs**: 2 files (1 CSV + 1 markdown) with budget data

### Step 4: Restart the App
Start the Electron app and test the dashboard questions!

## What Gets Created

### Workbook 1: AC-1000 Aircraft (5 docs)
- project_overview.md
- design_requirements.md
- main_gear_analysis.md (MOS: 0.24-0.33)
- nose_gear_analysis.md (MOS: 0.25-0.56)
- wing_spar_analysis.md (MOS: 0.21-0.33)

### Workbook 2: Test Schedule (2 docs)
- test_schedule.md (tests at 45, 85, 125, 180 days)
- test_readiness.md (2 tests due within 90 days)

### Workbook 3: Supplier Agreements (3 docs)
- Acme_Aerospace_NDA_Expires_2025-08-15.md
- TitaniumWorks_NDA_Expires_2026-03-20.md
- GlobalAvionics_NDA_Expires_2025-06-30.md

### Workbook 4: Budget & Costs (2 docs)
- project_budget_2025.csv
- cost_tracking.md

**Total**: 12 documents with queryable data!

## Queryable Data Points

### Margins of Safety (MOS)
- Main Gear Trunnion: 0.33
- Main Gear Shock Strut: 0.32
- Main Gear Axle: 0.31
- Main Gear Brake Assembly: 0.24 ⚠️
- Nose Gear Trunnion: 0.56
- Wing Spar Root: 0.33
- Wing Spar Outboard: 0.21 ⚠️

### Test Dates
- Main Gear Static Test: 45 days from today 🔴
- Nose Gear Static Test: 85 days from today ⚠️
- Wing Spar Static Test: 125 days from today
- Landing Gear Fatigue: 180 days from today

### NDA Expirations
- Acme Aerospace: 2025-08-15
- Global Avionics: 2025-06-30
- TitaniumWorks: 2026-03-20

### Budget Data
- Total Budget: $3,400,000
- Actual Spend: $3,515,000
- Manufacturing Over Budget: $150,000 (12.5%)

## Test Questions

See `VERIFIED_DASHBOARD_QUESTIONS.md` for full list of tested questions!

## Restoring Your Original Data

If you backed up your data, you can restore it by:
1. Close the app
2. Delete the `workbooks` folder
3. Rename your backup folder to `workbooks`
4. Restart the app
