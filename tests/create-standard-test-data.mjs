#!/usr/bin/env node
/**
 * Create standard test dataset for airplane development dashboard
 * This creates a realistic, queryable dataset with known values for testing
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA, 'insightLM-LT');
  }
  return path.join(process.env.HOME, '.config', 'insightLM-LT');
}

const dataDir = getDataDir();
const workbooksDir = path.join(dataDir, 'workbooks');

// Ensure clean slate
console.log('🗑️  Removing old workbooks...');
if (fs.existsSync(workbooksDir)) {
  fs.rmSync(workbooksDir, { recursive: true, force: true });
}
fs.mkdirSync(workbooksDir, { recursive: true });

// Helper to create workbook structure
function createWorkbook(id, name, documents) {
  const workbookPath = path.join(workbooksDir, id);
  const docsPath = path.join(workbookPath, 'documents');

  fs.mkdirSync(workbookPath, { recursive: true });
  fs.mkdirSync(docsPath, { recursive: true });

  const workbook = {
    id,
    name,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    documents: []
  };

  documents.forEach(doc => {
    const filePath = path.join(docsPath, doc.filename);
    fs.writeFileSync(filePath, doc.content, 'utf-8');

    workbook.documents.push({
      filename: doc.filename,
      path: `documents/${doc.filename}`,
      addedAt: doc.addedAt || new Date().toISOString()
    });
  });

  fs.writeFileSync(
    path.join(workbookPath, 'workbook.json'),
    JSON.stringify(workbook, null, 2),
    'utf-8'
  );

  return workbook;
}

console.log('📋 Creating standard test workbooks...\n');

// ========================================
// WORKBOOK 1: AC-1000 Aircraft Project
// ========================================
const ac1000Docs = [
  {
    filename: 'project_overview.md',
    addedAt: '2025-01-01T10:00:00Z',
    content: `# AC-1000 Aircraft Project Overview

## Project Details
- **Aircraft Type**: Light Business Jet
- **Max Takeoff Weight**: 12,500 lbs
- **Cruise Speed**: 450 knots
- **Range**: 2,500 nautical miles
- **Passenger Capacity**: 6-8

## Project Status
- **Phase**: Detailed Design
- **Completion**: 65%
- **Next Milestone**: PDR (Preliminary Design Review)
- **PDR Date**: 2025-03-15

## Key Systems
- Wing structure
- Main landing gear
- Nose landing gear
- Fuel system
- Avionics suite
`
  },
  {
    filename: 'design_requirements.md',
    addedAt: '2025-01-02T10:00:00Z',
    content: `# AC-1000 Design Requirements

## Structural Requirements
- **Ultimate Load Factor**: 3.75g
- **Limit Load Factor**: 2.5g
- **Wing Load**: 50 psf maximum

## Performance Requirements
- **Takeoff Distance**: < 3,500 ft
- **Landing Distance**: < 2,800 ft
- **Service Ceiling**: 45,000 ft

## Safety Requirements
- **Minimum MOS (Margin of Safety)**: 0.15
- **Critical Components MOS**: > 0.25
- **Fatigue Life**: 30,000 flight hours
`
  },
  {
    filename: 'main_gear_analysis.md',
    addedAt: '2025-01-03T10:00:00Z',
    content: `# Main Landing Gear Structural Analysis

## Load Cases
1. **Landing Impact**: 6.0g vertical
2. **Braking**: 4.5g longitudinal
3. **Side Load**: 3.0g lateral

## Component Analysis

### Trunnion
- **Applied Load**: 45,000 lbs
- **Allowable Load**: 60,000 lbs
- **Margin of Safety (MOS)**: **0.33**

### Shock Strut
- **Applied Load**: 38,000 lbs
- **Allowable Load**: 50,000 lbs
- **Margin of Safety (MOS)**: **0.32**

### Axle
- **Applied Load**: 52,000 lbs
- **Allowable Load**: 68,000 lbs
- **Margin of Safety (MOS)**: **0.31**

### Brake Assembly
- **Applied Load**: 42,000 lbs
- **Allowable Load**: 52,000 lbs
- **Margin of Safety (MOS)**: **0.24**

## Design Requirements
- **Minimum MOS Required**: 0.15
- **Preferred MOS**: 0.25
- **Critical Components MOS**: > 0.25
`
  },
  {
    filename: 'nose_gear_analysis.md',
    addedAt: '2025-01-04T10:00:00Z',
    content: `# Nose Landing Gear Structural Analysis

## Load Cases
1. **Landing Impact**: 5.0g vertical
2. **Steering**: 2.5g lateral

## Component Analysis

### Trunnion
- **Applied Load**: 18,000 lbs
- **Allowable Load**: 28,000 lbs
- **Margin of Safety (MOS)**: **0.56**

### Shock Strut
- **Applied Load**: 16,500 lbs
- **Allowable Load**: 24,000 lbs
- **Margin of Safety (MOS)**: **0.45**

### Steering Actuator
- **Applied Load**: 12,000 lbs
- **Allowable Load**: 15,000 lbs
- **Margin of Safety (MOS)**: **0.25**

## Design Requirements
- **Minimum MOS Required**: 0.15
- **Preferred MOS**: 0.25
`
  },
  {
    filename: 'wing_spar_analysis.md',
    addedAt: '2025-01-05T10:00:00Z',
    content: `# Wing Main Spar Analysis

## Critical Sections

### Root Section (Station 0)
- **Bending Moment**: 450,000 in-lbs
- **Allowable**: 600,000 in-lbs
- **Margin of Safety (MOS)**: **0.33**

### Mid-Span (Station 100)
- **Bending Moment**: 280,000 in-lbs
- **Allowable**: 350,000 in-lbs
- **Margin of Safety (MOS)**: **0.25**

### Outboard (Station 180)
- **Bending Moment**: 95,000 in-lbs
- **Allowable**: 115,000 in-lbs
- **Margin of Safety (MOS)**: **0.21**

## Design Requirements
- **Minimum MOS Required**: 0.15
- **Preferred MOS**: 0.25
- **Critical Sections MOS**: > 0.25
`
  }
];

const ac1000 = createWorkbook('ac1000-main-project', 'AC-1000 Aircraft', ac1000Docs);
console.log(`✅ Created: ${ac1000.name} (${ac1000.documents.length} docs)`);

// ========================================
// WORKBOOK 2: Test Schedule
// ========================================
const today = new Date();
const testDocs = [
  {
    filename: 'test_schedule.md',
    addedAt: '2025-01-10T10:00:00Z',
    content: `# AC-1000 Test Schedule

## Static Testing

### Main Gear Static Test
- **Test Date**: ${new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- **Prerequisites**: Complete
- **Test Article**: Ready

### Nose Gear Static Test
- **Test Date**: ${new Date(today.getTime() + 85 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- **Prerequisites**: 90% complete
- **Test Article**: In fabrication

### Wing Spar Static Test
- **Test Date**: ${new Date(today.getTime() + 125 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- **Prerequisites**: 60% complete
- **Test Article**: Not started

## Fatigue Testing

### Landing Gear Fatigue
- **Test Date**: ${new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- **Cycles Required**: 30,000
- **Duration**: 8 weeks

## Milestones
- **Critical Design Review (CDR)**: ${new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- **First Flight**: ${new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
`
  },
  {
    filename: 'test_readiness.md',
    addedAt: '2025-01-11T10:00:00Z',
    content: `# Test Readiness Status

## Upcoming Tests

### Main Gear Static Test
- **Action Required**: Final instrumentation checkout
- **Owner**: Structures Team
- **Priority**: Critical

### Nose Gear Static Test
- **Action Required**: Complete test article fabrication
- **Owner**: Test Lab
- **Priority**: High

## Risk Items
- Main gear test fixture requires calibration (15 day lead time)
- Nose gear test article 2 weeks behind schedule
`
  }
];

const testSchedule = createWorkbook('test-schedule-ac1000', 'Test Schedule', testDocs);
console.log(`✅ Created: ${testSchedule.name} (${testSchedule.documents.length} docs)`);

// ========================================
// WORKBOOK 3: Supplier Agreements
// ========================================
const supplierDocs = [
  {
    filename: 'Acme_Aerospace_NDA_Expires_2025-08-15.md',
    addedAt: '2024-08-15T10:00:00Z',
    content: `# Non-Disclosure Agreement - Acme Aerospace

**Company**: Acme Aerospace Inc.
**Agreement Type**: Mutual NDA
**Signed Date**: 2024-08-15
**Expiration Date**: 2025-08-15

## Scope
- Landing gear components
- Hydraulic systems
- Manufacturing processes

## Contact
- **Name**: John Smith
- **Email**: jsmith@acmeaero.com
- **Phone**: 555-0100
`
  },
  {
    filename: 'TitaniumWorks_NDA_Expires_2026-03-20.md',
    addedAt: '2025-01-10T10:00:00Z',
    content: `# Non-Disclosure Agreement - TitaniumWorks LLC

**Company**: TitaniumWorks LLC
**Agreement Type**: Mutual NDA
**Signed Date**: 2025-01-10
**Expiration Date**: 2026-03-20

## Scope
- Wing spar materials
- Heat treatment processes
- Quality specifications

## Contact
- **Name**: Sarah Johnson
- **Email**: sjohnson@titaniumworks.com
- **Phone**: 555-0200
`
  },
  {
    filename: 'GlobalAvionics_NDA_Expires_2025-06-30.md',
    addedAt: '2024-06-30T10:00:00Z',
    content: `# Non-Disclosure Agreement - Global Avionics

**Company**: Global Avionics Corp
**Agreement Type**: One-way NDA
**Signed Date**: 2024-06-30
**Expiration Date**: 2025-06-30

## Scope
- Flight control systems
- Autopilot integration
- Display specifications

## Contact
- **Name**: Mike Chen
- **Email**: mchen@globalavionics.com
- **Phone**: 555-0300
`
  }
];

const suppliers = createWorkbook('supplier-agreements', 'Supplier Agreements', supplierDocs);
console.log(`✅ Created: ${suppliers.name} (${suppliers.documents.length} docs)`);

// ========================================
// WORKBOOK 4: Budget & Costs (Excel + CSV)
// ========================================
const budgetDocs = [
  {
    filename: 'project_budget_2025.csv',
    addedAt: '2025-01-15T10:00:00Z',
    content: `Category,Budgeted,Actual,Variance,Percent
Engineering,500000,485000,15000,97.0
Manufacturing,1200000,1350000,-150000,112.5
Testing,300000,275000,25000,91.7
Materials,800000,825000,-25000,103.1
Labor,600000,580000,20000,96.7
Total,3400000,3515000,-115000,103.4
`
  },
  {
    filename: 'cost_tracking.md',
    addedAt: '2025-01-16T10:00:00Z',
    content: `# AC-1000 Cost Tracking Summary

## Budget Overview
- **Total Budget**: $3,400,000
- **Actual Spend**: $3,515,000
- **Variance**: -$115,000

## Cost Breakdown

### Engineering
- **Budgeted**: $500,000
- **Actual**: $485,000
- **Variance**: $15,000
- Design: $280,000
- Analysis: $125,000
- CAD/CAM: $80,000

### Manufacturing
- **Budgeted**: $1,200,000
- **Actual**: $1,350,000
- **Variance**: -$150,000
- Tooling: $450,000
- Fabrication: $600,000
- Assembly: $300,000

### Testing
- **Budgeted**: $300,000
- **Actual**: $275,000
- **Variance**: $25,000
- Test fixtures: $125,000
- Instrumentation: $85,000
- Lab time: $65,000

### Materials
- **Budgeted**: $800,000
- **Actual**: $825,000
- **Variance**: -$25,000
- Aluminum: $300,000
- Titanium: $225,000
- Composites: $180,000
- Hardware: $120,000

## Risk Items
- Manufacturing costs require review
- Material costs increased due to titanium price increase
- Cost reduction measures needed in fabrication
`
  }
];

const budget = createWorkbook('project-budget', 'Budget & Costs', budgetDocs);
console.log(`✅ Created: ${budget.name} (${budget.documents.length} docs)`);

// ========================================
// Summary
// ========================================
console.log('\n' + '='.repeat(70));
console.log('📊 STANDARD TEST DATA CREATED SUCCESSFULLY');
console.log('='.repeat(70));
console.log('\nWorkbooks Created:');
console.log(`  1. ${ac1000.name} - ${ac1000.documents.length} markdown files`);
console.log(`  2. ${testSchedule.name} - ${testSchedule.documents.length} markdown files`);
console.log(`  3. ${suppliers.name} - ${suppliers.documents.length} markdown files`);
console.log(`  4. ${budget.name} - ${budget.documents.length} files (CSV + MD)`);
console.log(`\nTotal: ${ac1000.documents.length + testSchedule.documents.length + suppliers.documents.length + budget.documents.length} documents`);

console.log('\n📋 DASHBOARD QUESTIONS TO TEST:');
console.log('\nBasic Counts:');
console.log('  - "How many documents do we have?"');
console.log('  - "How many markdown files do we have?"');
console.log('  - "How many CSV files do we have?"');

console.log('\nMargin of Safety (MOS):');
console.log('  - "What is the main gear MOS?"');
console.log('  - "What is the brake assembly MOS?"');
console.log('  - "Which components have MOS below 0.25?"');
console.log('  - "What is the wing spar outboard MOS?"');

console.log('\nTest Schedule:');
console.log('  - "How many tests are due within 90 days?"');
console.log('  - "When is the main gear static test?"');
console.log('  - "How many days until the nose gear test?"');
console.log('  - "Which tests are overdue or due soon?"');

console.log('\nSupplier Agreements:');
console.log('  - "How many NDAs are expiring within 90 days?"');
console.log('  - "When does the Acme Aerospace NDA expire?"');
console.log('  - "Which NDAs expire in 2025?"');

console.log('\nBudget:');
console.log('  - "What is the manufacturing budget variance?"');
console.log('  - "Which categories are over budget?"');
console.log('  - "What is the total project budget?"');

console.log('\n✅ Test data is ready! Restart the app and start querying!');
