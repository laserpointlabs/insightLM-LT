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
  console.log('COMPREHENSIVE DASHBOARD MCP SERVER TESTS');
  console.log('='.repeat(70));
  console.log();
  console.log('Expected Data:');
  console.log('  - AC-1000: 2 files (1 txt, 1 docx)');
  console.log('  - NDAs: 10 PDFs');
  console.log('  - ODRAS: 2 PDFs');
  console.log('  - Excel: 1 xlsx');
  console.log('  - AC-5000: 5 MD files');
  console.log('  TOTAL: 20 files (12 PDF, 1 DOCX, 1 TXT, 1 XLSX, 5 MD)');
  console.log();
  console.log('='.repeat(70));
  console.log();

  const tests = [
    { q: "How many documents do we have?", expected: 20, workbookId: null },
    { q: "How many NDAs do we have?", expected: 10, workbookId: "9a050ab2-1ae8-45bb-96d1-34d62d4efd95" },
    { q: "How many documents in AC-1000?", expected: 2, workbookId: "2ef43c7d-8e6d-4523-bc30-6c7023c3f811" },
    { q: "How many PDFs do we have?", expected: 12, workbookId: null },
    { q: "How many markdown files do we have?", expected: 5, workbookId: null },
    { q: "Show me a pie chart of document types", expected: "graph", workbookId: null },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`TEST: "${test.q}"`);
    if (test.workbookId) console.log(`      Workbook: ${test.workbookId.substring(0, 8)}...`);

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
    console.log('✅ ALL TESTS PASSED! System is working correctly.');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED. Fix the issues above.');
    process.exit(1);
  }
}

test().catch(console.error);
