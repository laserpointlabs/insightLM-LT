#!/usr/bin/env node
/**
 * Backup current workbooks before replacing with test data
 */
import fs from 'fs';
import path from 'path';

function getDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA, 'insightLM-LT');
  }
  return path.join(process.env.HOME, '.config', 'insightLM-LT');
}

const dataDir = getDataDir();
const workbooksDir = path.join(dataDir, 'workbooks');
const backupDir = path.join(dataDir, 'workbooks_backup_' + new Date().toISOString().replace(/[:.]/g, '-'));

console.log('Creating backup of current workbooks...');
console.log(`Source: ${workbooksDir}`);
console.log(`Backup: ${backupDir}`);

if (fs.existsSync(workbooksDir)) {
  fs.cpSync(workbooksDir, backupDir, { recursive: true });
  console.log('✅ Backup complete!');
  console.log(`\nYour workbooks have been backed up to:`);
  console.log(backupDir);
} else {
  console.log('⚠️  No workbooks directory found - nothing to backup');
}
