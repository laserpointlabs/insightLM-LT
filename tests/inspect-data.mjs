#!/usr/bin/env node
/**
 * Inspect and show current workbooks and dashboards
 */
import fs from 'fs';
import path from 'path';

// Get data directory
function getDataDir() {
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA;
    if (appdata) {
      return path.join(appdata, 'insightLM-LT');
    }
  }
  return path.join(process.env.HOME, '.config', 'insightLM-LT');
}

const dataDir = getDataDir();
console.log('='.repeat(70));
console.log('InsightLM Data Inspection');
console.log('='.repeat(70));
console.log(`Data Directory: ${dataDir}\n`);

// Check workbooks
const workbooksFile = path.join(dataDir, 'workbooks.json');
if (fs.existsSync(workbooksFile)) {
  const workbooks = JSON.parse(fs.readFileSync(workbooksFile, 'utf-8'));
  console.log(`📚 WORKBOOKS (${workbooks.length} total):`);
  workbooks.forEach(wb => {
    const docCount = wb.documents?.filter(d => !d.archived).length || 0;
    console.log(`  - ${wb.name} (ID: ${wb.id})`);
    console.log(`    Documents: ${docCount}${wb.archived ? ' [ARCHIVED]' : ''}`);
  });
} else {
  console.log('📚 WORKBOOKS: None found');
}

console.log();

// Check dashboards
const dashboardsFile = path.join(dataDir, 'dashboards.json');
if (fs.existsSync(dashboardsFile)) {
  const dashboards = JSON.parse(fs.readFileSync(dashboardsFile, 'utf-8'));
  console.log(`📊 DASHBOARDS (${dashboards.length} total):`);
  dashboards.forEach(db => {
    console.log(`  - ${db.name} (ID: ${db.id})`);
    console.log(`    Queries: ${db.queries?.length || 0}`);
    db.queries?.forEach(q => {
      console.log(`      • "${q.question}" (workbookId: ${q.workbookId || 'none'})`);
    });
  });
} else {
  console.log('📊 DASHBOARDS: None found');
}

console.log('\n' + '='.repeat(70));
