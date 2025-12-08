#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function getDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA, 'insightLM-LT');
  }
  return path.join(process.env.HOME, '.config', 'insightLM-LT');
}

async function callMCP(question, workbookId = null) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(rootDir, 'mcp-servers', 'workbook-dashboard', 'server.py');
    const venvPython = path.join(rootDir, 'mcp-servers', 'workbook-dashboard', '.venv', 'Scripts', 'python.exe');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python';

    const proc = spawn(pythonCmd, [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(rootDir, 'mcp-servers', 'workbook-dashboard'),
      env: { ...process.env, INSIGHTLM_DATA_DIR: getDataDir() }
    });

    let output = '';
    let stderr = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    setTimeout(() => {
      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "execute_dashboard_query",
          arguments: { question, ...(workbookId && { workbookId }) }
        }
      };
      proc.stdin.write(JSON.stringify(request) + '\n');
      proc.stdin.end();
    }, 500);

    proc.on('close', () => {
      try {
        const lines = output.split('\n').filter(l => l.trim() && l.startsWith('{'));
        if (lines.length < 2) {
          reject(new Error('No response'));
          return;
        }
        const response = JSON.parse(lines[1]);
        resolve(response.result);
      } catch (error) {
        console.error('STDERR:', stderr);
        reject(error);
      }
    });
  });
}

async function test() {
  console.log('='.repeat(70));
  console.log('STANDARD TEST DATA VERIFICATION');
  console.log('='.repeat(70));
  console.log();
  console.log('Expected Standard Data:');
  console.log('  - AC-1000 Aircraft: 5 markdown files');
  console.log('  - Test Schedule: 2 markdown files');
  console.log('  - Supplier Agreements: 3 markdown files');
  console.log('  - Budget & Costs: 2 files (1 CSV + 1 MD)');
  console.log('  TOTAL: 12 files (11 MD, 1 CSV)');
  console.log();
  console.log('='.repeat(70));
  console.log();

  const tests = [
    { q: "How many documents do we have?", expected: 12, workbookId: null },
    { q: "How many markdown files do we have?", expected: 11, workbookId: null },
    { q: "How many CSV files do we have?", expected: 1, workbookId: null },
    { q: "Show me a pie chart of document types", expected: "graph", workbookId: null },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`TEST: "${test.q}"`);

    try {
      const result = await callMCP(test.q, test.workbookId);

      if (!result.success) {
        console.log(`  ❌ FAILED: ${result.error}`);
        failed++;
        console.log();
        continue;
      }

      const actualValue = result.result.value;
      const actualType = result.result.type;

      if (typeof test.expected === 'number') {
        if (actualValue === test.expected) {
          console.log(`  ✅ PASS: Got ${actualValue} (expected ${test.expected})`);
          console.log(`     Workbook: ${result.workbookName}`);
          passed++;
        } else {
          console.log(`  ❌ FAIL: Got ${actualValue}, expected ${test.expected}`);
          console.log(`     Workbook: ${result.workbookName}`);
          failed++;
        }
      } else if (typeof test.expected === 'string') {
        if (actualType === test.expected) {
          console.log(`  ✅ PASS: Got type "${actualType}" as expected`);
          if (result.result.html) {
            console.log(`     Has HTML chart: Yes`);
          }
          passed++;
        } else {
          console.log(`  ❌ FAIL: Got type "${actualType}", expected "${test.expected}"`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`  ❌ EXCEPTION: ${error.message}`);
      failed++;
    }
    console.log();
  }

  console.log('='.repeat(70));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED! Standard test data is working correctly.');
    console.log();
    console.log('🚀 READY TO TEST IN THE APP!');
    console.log('   1. Restart the Electron app');
    console.log('   2. Create a new dashboard');
    console.log('   3. Try these questions:');
    console.log('      - "How many documents do we have?"');
    console.log('      - "How many markdown files do we have?"');
    console.log('      - "Show me a pie chart of document types"');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED. Review above.');
    process.exit(1);
  }
}

test().catch(console.error);
