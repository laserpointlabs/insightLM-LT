#!/usr/bin/env node
/**
 * Test the new Dashboard Prompt Manager architecture
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function callDashboardMCP(toolName, args) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(rootDir, 'mcp-servers', 'workbook-dashboard', 'server_v2.py');
    const venvPython = path.join(rootDir, 'mcp-servers', 'workbook-dashboard', '.venv', 'Scripts', 'python.exe');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python';

    const proc = spawn(pythonCmd, [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(rootDir, 'mcp-servers', 'workbook-dashboard')
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
        params: { name: toolName, arguments: args }
      };
      proc.stdin.write(JSON.stringify(request) + '\n');
      proc.stdin.end();
    }, 500);

    proc.on('close', () => {
      try {
        const lines = output.split('\n').filter(l => l.trim() && l.startsWith('{'));
        if (lines.length < 2) {
          console.error('STDERR:', stderr);
          reject(new Error('No response from server'));
          return;
        }
        const response = JSON.parse(lines[1]);
        resolve(response.result);
      } catch (error) {
        console.error('Output:', output);
        console.error('STDERR:', stderr);
        reject(error);
      }
    });
  });
}

async function test() {
  console.log('='.repeat(70));
  console.log('DASHBOARD PROMPT MANAGER TESTS');
  console.log('='.repeat(70));
  console.log();

  // Test 1: Create query for counter
  console.log('TEST 1: Create counter query');
  const counterQuery = await callDashboardMCP('create_dashboard_query', {
    question: "What is the main gear brake assembly MOS?",
    tileType: "counter"
  });

  console.log('✓ Query created');
  console.log('  System Prompt:', counterQuery.llm_request.system_prompt.substring(0, 100) + '...');
  console.log('  Expected Format:', counterQuery.llm_request.expected_format);
  console.log();

  // Test 2: Format a counter response
  console.log('TEST 2: Format counter response');
  const counterResult = await callDashboardMCP('format_llm_response', {
    llmResponse: "0.24",
    expectedFormat: "single_number",
    tileType: "counter"
  });

  if (counterResult.success && counterResult.result.value === 0.24) {
    console.log('✅ Counter formatting works!');
    console.log('  Result:', JSON.stringify(counterResult.result, null, 2));
  } else {
    console.log('❌ Counter formatting failed');
    console.log('  Result:', counterResult);
  }
  console.log();

  // Test 3: Format graph response
  console.log('TEST 3: Format graph response');
  const graphResult = await callDashboardMCP('format_llm_response', {
    llmResponse: '{"labels": ["PDF", "MD", "CSV"], "values": [0, 11, 1]}',
    expectedFormat: "json_chart_data",
    tileType: "graph"
  });

  if (graphResult.success && graphResult.result.type === 'graph') {
    console.log('✅ Graph formatting works!');
    console.log('  Labels:', graphResult.result.data.labels);
    console.log('  Values:', graphResult.result.data.values);
  } else {
    console.log('❌ Graph formatting failed');
    console.log('  Result:', graphResult);
  }
  console.log();

  // Test 4: Format table response
  console.log('TEST 4: Format table response');
  const tableResult = await callDashboardMCP('format_llm_response', {
    llmResponse: '[{"test": "Main Gear", "days": 45}, {"test": "Nose Gear", "days": 85}]',
    expectedFormat: "json_table_data",
    tileType: "table"
  });

  if (tableResult.success && tableResult.result.type === 'table') {
    console.log('✅ Table formatting works!');
    console.log('  Columns:', tableResult.result.columns);
    console.log('  Rows:', tableResult.result.totalRows);
  } else {
    console.log('❌ Table formatting failed');
    console.log('  Result:', tableResult);
  }
  console.log();

  console.log('='.repeat(70));
  console.log('✅ PROMPT MANAGER TESTS COMPLETE');
  console.log('='.repeat(70));
  console.log();
  console.log('Next Steps:');
  console.log('1. Update Electron IPC to use new 2-step flow');
  console.log('2. Frontend calls: create_dashboard_query → LLM → format_llm_response');
  console.log('3. LLM uses RAG tools to answer (already working!)');
}

test().catch(console.error);
