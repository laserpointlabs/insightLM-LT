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
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { process.stderr.write(data); });

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
          reject(new Error('No response from server'));
          return;
        }
        const response = JSON.parse(lines[1]);
        resolve(response.result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function test() {
  console.log('Testing MCP Dashboard Server with REAL data...\n');

  const tests = [
    { q: "How many documents do we have?", workbookId: null },
    { q: "How many NDAs do we have?", workbookId: "9a050ab2-1ae8-45bb-96d1-34d62d4efd95" },
    { q: "How many documents in AC-1000?", workbookId: "2ef43c7d-8e6d-4523-bc30-6c7023c3f811" },
  ];

  for (const test of tests) {
    console.log(`Q: "${test.q}"`);
    if (test.workbookId) console.log(`   Workbook: ${test.workbookId}`);

    try {
      const result = await callMCP(test.q, test.workbookId);
      if (result.success) {
        console.log(`✓ Type: ${result.result.type}`);
        console.log(`✓ Value: ${result.result.value}`);
        console.log(`✓ Label: ${result.result.label || 'N/A'}`);
        console.log(`✓ Workbook: ${result.workbookName || 'N/A'}`);
      } else {
        console.log(`✗ ERROR: ${result.error}`);
      }
    } catch (error) {
      console.log(`✗ EXCEPTION: ${error.message}`);
    }
    console.log();
  }
}

test().catch(console.error);
