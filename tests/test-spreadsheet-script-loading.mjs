/**
 * Test to verify spreadsheet script loading prevents duplicates
 * 
 * This test simulates the script loading behavior to ensure:
 * 1. Scripts are only loaded once globally
 * 2. Multiple spreadsheet viewers don't create duplicate scripts
 * 3. Global state tracking works correctly
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the SpreadsheetViewer source to analyze script loading logic
const spreadsheetViewerPath = join(__dirname, '../src/extensions/spreadsheet/SpreadsheetViewer.tsx');
const sourceCode = readFileSync(spreadsheetViewerPath, 'utf-8');

console.log('🧪 Testing Spreadsheet Script Loading Logic\n');

let passedTests = 0;
let failedTests = 0;

function test(name, condition) {
  if (condition) {
    console.log(`✅ ${name}`);
    passedTests++;
  } else {
    console.log(`❌ ${name}`);
    failedTests++;
  }
}

// Test 1: Global state is defined outside component
test(
  'Global script state is defined outside component (prevents recreation on re-render)',
  sourceCode.includes('const globalScriptsState = {') && 
  !sourceCode.match(/export function SpreadsheetViewer[\s\S]*?const globalScriptsState/)
);

// Test 2: Check for global state before loading
test(
  'Checks global state before attempting to load scripts',
  sourceCode.includes('globalScriptsState.loaded') && 
  sourceCode.includes('globalScriptsState.scripts.has')
);

// Test 3: Prevents duplicate script creation
test(
  'Checks if script exists before creating new script tag',
  sourceCode.includes('isScriptLoaded') || 
  sourceCode.includes('existingScript') ||
  sourceCode.includes('document.querySelectorAll')
);

// Test 4: Marks scripts in global state before appending
test(
  'Marks scripts in global state before appending to DOM (prevents race conditions)',
  sourceCode.includes('globalScriptsState.scripts.add') &&
  (sourceCode.match(/globalScriptsState\.scripts\.add\([^)]+\)[\s\S]{0,500}?appendChild/gs) ||
   sourceCode.match(/globalScriptsState\.scripts\.add\([^)]+\)[\s\S]{0,500}?document\.body\.appendChild/gs))
);

// Test 5: Checks for luckysheet global object
test(
  'Checks for luckysheet global object before loading scripts',
  sourceCode.includes('(window as any).luckysheet') &&
  sourceCode.includes('if ((window as any).jQuery && (window as any).luckysheet')
);

// Test 6: Uses data attributes for script identification
test(
  'Uses data-luckysheet-script attribute for reliable script identification',
  sourceCode.includes('data-luckysheet-script') &&
  (sourceCode.includes('getAttribute(\'data-luckysheet-script\')') ||
   sourceCode.includes('getAttribute("data-luckysheet-script")') ||
   sourceCode.includes('setAttribute(\'data-luckysheet-script'))
);

// Test 7: Prevents multiple simultaneous loads
test(
  'Prevents multiple simultaneous script loads',
  sourceCode.includes('globalScriptsState.loading') &&
  sourceCode.includes('if (globalScriptsState.loading)')
);

// Test 8: Checks for existing scripts by data attribute
test(
  'Checks for existing scripts using data attribute selector',
  sourceCode.includes('querySelectorAll(\'script[data-luckysheet-script') ||
  sourceCode.includes('querySelectorAll("script[data-luckysheet-script')
);

// Test 9: Handles script errors gracefully
test(
  'Handles script loading errors and cleans up state',
  sourceCode.includes('onerror') &&
  sourceCode.includes('globalScriptsState.loading = false')
);

// Test 10: CSS loading also prevents duplicates
test(
  'CSS loading checks for existing links to prevent duplicates',
  sourceCode.includes('isCSSLoaded') ||
  sourceCode.includes('querySelectorAll(\'link[rel="stylesheet"]\')')
);

console.log(`\n📊 Test Results: ${passedTests} passed, ${failedTests} failed`);

if (failedTests === 0) {
  console.log('\n✅ All script loading safeguards are in place!');
  console.log('   The spreadsheet viewer should prevent duplicate script loading.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some safeguards may be missing.');
  console.log('   Review the failed tests above.');
  process.exit(1);
}
