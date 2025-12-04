#!/usr/bin/env node
/**
 * Test script for MCP Dashboard Server
 * Tests multiple question types and visualization generation
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

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

// Call MCP Dashboard Server
async function callDashboardMCP(question, workbookId = null) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(rootDir, 'mcp-servers', 'workbook-dashboard', 'server.py');
    const venvPython = path.join(rootDir, 'mcp-servers', 'workbook-dashboard', '.venv', 'Scripts', 'python.exe');
    
    // Check if venv python exists, otherwise use system python
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python';
    
    const proc = spawn(pythonCmd, [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(rootDir, 'mcp-servers', 'workbook-dashboard'),
      env: {
        ...process.env,
        INSIGHTLM_DATA_DIR: getDataDir()
      }
    });

    let output = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to start MCP server: ${error.message}`));
    });

    // Send request after a short delay to let server initialize
    setTimeout(() => {
      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "execute_dashboard_query",
          arguments: {
            question,
            ...(workbookId && { workbookId })
          }
        }
      };

      proc.stdin.write(JSON.stringify(request) + '\n');
      proc.stdin.end();
    }, 500);

    proc.on('close', () => {
      try {
        // Parse responses (skip initialization response)
        const lines = output.split('\n').filter(l => l.trim() && l.startsWith('{'));
        
        if (lines.length < 2) {
          console.error('STDERR:', stderr);
          reject(new Error('No JSON response from server'));
          return;
        }

        // Second response is our result
        const response = JSON.parse(lines[1]);
        
        if (response.error) {
          reject(new Error(`MCP error: ${JSON.stringify(response.error)}`));
          return;
        }
        
        resolve(response.result);
      } catch (error) {
        console.error('Output:', output);
        console.error('STDERR:', stderr);
        reject(error);
      }
    });
  });
}

// Load workbooks to see what we have
function loadWorkbooks() {
  const dataDir = getDataDir();
  const workbooksFile = path.join(dataDir, 'workbooks.json');
  
  if (!fs.existsSync(workbooksFile)) {
    console.log('No workbooks found. Creating test data...');
    return [];
  }
  
  const data = fs.readFileSync(workbooksFile, 'utf-8');
  return JSON.parse(data);
}

// Test cases
const testCases = [
  {
    name: "Counter - How many documents",
    question: "How many documents do we have?",
    expectedType: "counter"
  },
  {
    name: "Graph - Pie chart of document types",
    question: "Show me a pie chart of document types",
    expectedType: "graph"
  },
  {
    name: "Table - List all documents",
    question: "List all documents",
    expectedType: "table"
  },
  {
    name: "Text - Summarize workbook",
    question: "Summarize all documents",
    expectedType: "text"
  },
  {
    name: "Counter Warning - Documents expiring",
    question: "How many documents are expiring in 90 days?",
    expectedType: "counter_warning"
  }
];

async function runTests() {
  console.log('='.repeat(70));
  console.log('MCP Dashboard Server - End-to-End Tests');
  console.log('='.repeat(70));
  console.log();

  // Check workbooks
  const workbooks = loadWorkbooks();
  console.log(`📁 Found ${workbooks.length} workbook(s)`);
  
  if (workbooks.length === 0) {
    console.log('⚠️  No workbooks found. Please create a workbook with some documents first.');
    console.log('   You can do this through the Electron app UI.');
    return;
  }

  const activeWorkbooks = workbooks.filter(wb => !wb.archived);
  console.log(`📂 Active workbooks: ${activeWorkbooks.map(wb => wb.name).join(', ')}`);
  
  const firstWorkbook = activeWorkbooks[0];
  const docCount = firstWorkbook.documents?.filter(d => !d.archived).length || 0;
  console.log(`📄 First workbook "${firstWorkbook.name}" has ${docCount} document(s)`);
  console.log();

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`TEST: ${test.name}`);
    console.log(`Question: "${test.question}"`);
    console.log('─'.repeat(70));

    try {
      const response = await callDashboardMCP(test.question, firstWorkbook.id);

      console.log(`✓ MCP Call successful`);
      
      if (!response.success) {
        console.log(`❌ FAILED: ${response.error || 'Unknown error'}`);
        if (response.code) {
          console.log(`Generated code:\n${response.code.substring(0, 200)}...`);
        }
        failed++;
        continue;
      }

      const result = response.result;
      const generatedCode = response.generatedCode;

      console.log(`✓ Success: true`);
      console.log(`✓ Visualization type: ${result.type}`);
      console.log(`✓ Generated code: ${generatedCode ? 'Yes (' + generatedCode.split('\n').length + ' lines)' : 'No'}`);

      // Verify expected type
      if (result.type !== test.expectedType) {
        console.log(`⚠️  Expected type "${test.expectedType}" but got "${result.type}"`);
      }

      // Display result based on type
      switch (result.type) {
        case 'counter':
          console.log(`📊 Counter Value: ${result.value}`);
          console.log(`   Label: ${result.label || 'N/A'}`);
          console.log(`   Subtitle: ${result.subtitle || 'N/A'}`);
          break;

        case 'counter_warning':
          console.log(`⚠️  Counter Warning Value: ${result.value}`);
          console.log(`   Level: ${result.level || 'N/A'}`);
          console.log(`   Threshold: ${result.threshold || 'N/A'}`);
          break;

        case 'graph':
          console.log(`📈 Graph Type: ${result.chartType}`);
          console.log(`   Has HTML: ${result.html ? 'Yes (' + result.html.length + ' chars)' : 'No'}`);
          if (result.data) {
            console.log(`   Data points: ${result.data.labels?.length || 0}`);
          }
          break;

        case 'table':
          console.log(`📝 Table Columns: ${result.columns?.join(', ') || 'N/A'}`);
          console.log(`   Rows: ${result.totalRows || result.rows?.length || 0}`);
          if (result.rows && result.rows.length > 0) {
            console.log(`   First row: ${JSON.stringify(result.rows[0])}`);
          }
          break;

        case 'text':
          console.log(`💬 Text Content: ${result.content?.substring(0, 100)}...`);
          console.log(`   Format: ${result.format || 'plain'}`);
          break;

        case 'error':
          console.log(`❌ Error: ${result.error}`);
          failed++;
          continue;

        default:
          console.log(`❓ Unknown type: ${result.type}`);
      }

      console.log(`\n✅ PASSED`);
      passed++;

    } catch (error) {
      console.log(`\n❌ FAILED: ${error.message}`);
      failed++;
    }
  }

  console.log();
  console.log('='.repeat(70));
  console.log('Test Summary');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${passed}/${testCases.length}`);
  console.log(`❌ Failed: ${failed}/${testCases.length}`);
  console.log();

  if (failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

