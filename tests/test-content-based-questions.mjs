#!/usr/bin/env node
/**
 * Test content-based questions that require reading document content
 * These are the REAL tests - not just file counts!
 */
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
  console.log('CONTENT-BASED DASHBOARD QUESTIONS');
  console.log('These questions require READING document content!');
  console.log('='.repeat(70));
  console.log();

  const tests = [
    {
      category: "Margin of Safety (MOS) Queries",
      questions: [
        { q: "What is the main gear brake assembly MOS?", expectedValue: "0.24", expectedIn: "text" },
        { q: "What is the main gear trunnion MOS?", expectedValue: "0.33", expectedIn: "text" },
        { q: "What is the wing spar outboard MOS?", expectedValue: "0.21", expectedIn: "text" },
        { q: "What is the nose gear trunnion MOS?", expectedValue: "0.56", expectedIn: "text" },
        { q: "Which components have MOS below 0.25?", expectedValue: "brake assembly, wing spar outboard", expectedIn: "text" },
      ]
    },
    {
      category: "Test Schedule Queries",
      questions: [
        { q: "How many tests are due within 90 days?", expectedValue: "2", expectedIn: "value" },
        { q: "When is the main gear static test?", expectedValue: "45 days", expectedIn: "text" },
        { q: "How many days until the nose gear test?", expectedValue: "85", expectedIn: "text" },
        { q: "Which tests are due soon?", expectedValue: "main gear, nose gear", expectedIn: "text" },
      ]
    },
    {
      category: "NDA/Supplier Queries",
      questions: [
        { q: "How many NDAs are expiring within 90 days?", expectedValue: "2", expectedIn: "value" },
        { q: "When does the Acme Aerospace NDA expire?", expectedValue: "2025-08-15", expectedIn: "text" },
        { q: "Which NDAs expire in 2025?", expectedValue: "Acme, GlobalAvionics", expectedIn: "text" },
        { q: "When does the TitaniumWorks NDA expire?", expectedValue: "2026-03-20", expectedIn: "text" },
      ]
    },
    {
      category: "Budget Queries",
      questions: [
        { q: "What is the manufacturing budget variance?", expectedValue: "-150000 or -$150,000", expectedIn: "text" },
        { q: "Which categories are over budget?", expectedValue: "Manufacturing", expectedIn: "text" },
        { q: "What is the total project budget?", expectedValue: "3400000 or $3,400,000", expectedIn: "text" },
        { q: "What percent is manufacturing over budget?", expectedValue: "12.5", expectedIn: "text" },
      ]
    },
    {
      category: "Project Details",
      questions: [
        { q: "What is the AC-1000 cruise speed?", expectedValue: "450 knots", expectedIn: "text" },
        { q: "What is the max takeoff weight?", expectedValue: "12,500 lbs", expectedIn: "text" },
        { q: "What is the PDR date?", expectedValue: "2025-03-15", expectedIn: "text" },
        { q: "What is the project completion percentage?", expectedValue: "65%", expectedIn: "text" },
      ]
    }
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  let totalTested = 0;

  for (const category of tests) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📂 ${category.category}`);
    console.log('='.repeat(70));

    for (const test of category.questions) {
      totalTested++;
      console.log(`\n❓ "${test.q}"`);
      console.log(`   Expected: ${test.expectedValue}`);

      try {
        const result = await callMCP(test.q);

        if (!result.success) {
          console.log(`   ❌ FAILED: ${result.error}`);
          totalFailed++;
          continue;
        }

        // Check what was returned
        const resultType = result.result.type;
        const resultValue = result.result.value;
        const resultContent = result.result.content;

        console.log(`   📊 Type: ${resultType}`);

        if (test.expectedIn === "value" && resultValue !== undefined) {
          console.log(`   📈 Value: ${resultValue}`);
          if (String(resultValue) === String(test.expectedValue.split(' or ')[0])) {
            console.log(`   ✅ PASS - Got expected value!`);
            totalPassed++;
          } else {
            console.log(`   ⚠️  Got ${resultValue}, expected ${test.expectedValue}`);
            console.log(`   ℹ️  This might still be correct - needs manual review`);
            totalFailed++;
          }
        } else if (test.expectedIn === "text" && resultContent) {
          console.log(`   📝 Content: ${resultContent.substring(0, 100)}...`);
          // For text results, we can't easily verify - need manual review
          console.log(`   ℹ️  TEXT RESULT - Manual verification needed`);
          console.log(`   ⚠️  Expected to find: ${test.expectedValue}`);
          totalFailed++; // Count as failed until we verify manually
        } else {
          console.log(`   ⚠️  Unexpected result format`);
          console.log(`   Result:`, JSON.stringify(result.result, null, 2).substring(0, 200));
          totalFailed++;
        }

      } catch (error) {
        console.log(`   ❌ EXCEPTION: ${error.message}`);
        totalFailed++;
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Questions Tested: ${totalTested}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed/Need Review: ${totalFailed}`);
  console.log();

  if (totalFailed > 0) {
    console.log('⚠️  IMPORTANT: Content-based questions require document reading!');
    console.log('   The current MCP server may not read document content.');
    console.log('   These questions likely need:');
    console.log('   1. Integration with the RAG server to read content');
    console.log('   2. OR: Enhanced code generation to parse markdown');
    console.log('   3. OR: LLM-based content extraction');
  }
}

test().catch(console.error);
