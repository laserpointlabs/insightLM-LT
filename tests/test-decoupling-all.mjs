/**
 * Comprehensive test runner for all decoupling phases
 * Runs Phase 1, Phase 2, and Phase 3 tests in sequence
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run a test file and capture results
 */
function runTest(testFile, description) {
  return new Promise((resolve) => {
    console.log(`\n🚀 Running ${description}...`);
    console.log('─'.repeat(50));

    const testPath = path.join(__dirname, testFile);
    const proc = spawn('node', [testPath], {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    proc.on('close', (code) => {
      const success = code === 0;
      console.log(`\n${success ? '✅' : '❌'} ${description} ${success ? 'PASSED' : 'FAILED'}`);
      console.log('─'.repeat(50));
      resolve({ test: description, success, exitCode: code });
    });

    proc.on('error', (error) => {
      console.error(`Error running ${description}:`, error);
      resolve({ test: description, success: false, error: error.message });
    });
  });
}

/**
 * Run all decoupling tests
 */
async function runAllDecouplingTests() {
  console.log('🧪 COMPREHENSIVE DECOUPLING TEST SUITE');
  console.log('=' .repeat(80));
  console.log('Testing MCP server decoupling across all phases...');
  console.log('=' .repeat(80));

  const testResults = [];

  try {
    // Phase 1: MCP Tool Discovery
    const phase1Result = await runTest('test-mcp-tool-discovery.mjs', 'Phase 1 - MCP Tool Discovery');
    testResults.push(phase1Result);

    // Phase 2: Server Lifecycle & Hardcoded Reference Removal
    const phase2Result = await runTest('test-phase2-decoupling.mjs', 'Phase 2 - Server Lifecycle & Abstraction');
    testResults.push(phase2Result);

    // Phase 3: Provider Abstraction
    const phase3Result = await runTest('test-phase3-provider-abstraction.mjs', 'Phase 3 - Provider Abstraction');
    testResults.push(phase3Result);

    // Phase 4: Dashboard Decoupling
    const phase4Result = await runTest('test-phase4-dashboard-decoupling.mjs', 'Phase 4 - Dashboard Decoupling');
    testResults.push(phase4Result);

  } catch (error) {
    console.error('Fatal error running decoupling tests:', error);
    testResults.push({ test: 'Decoupling Test Suite', success: false, error: error.message });
  }

  // Final Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL DECOUPLING TEST SUMMARY');
  console.log('='.repeat(80));

  let allPassed = true;
  let passedCount = 0;
  let failedCount = 0;

  for (const result of testResults) {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status} ${result.test}`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    if (result.success) {
      passedCount++;
    } else {
      failedCount++;
      allPassed = false;
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log('─'.repeat(80));

  if (allPassed) {
    console.log('\n🎉 ALL DECOUPLING TESTS PASSED!');
    console.log('✅ MCP servers are properly decoupled from the LLM service');
    console.log('✅ Tool execution is protocol-agnostic');
    console.log('✅ Server lifecycle is fully managed');
    console.log('✅ No hardcoded server references remain');
    process.exit(0);
  } else {
    console.log('\n❌ SOME DECOUPLING TESTS FAILED');
    console.log('🔧 Please fix the failing tests before proceeding');
    console.log('🔍 Check test output above for specific errors');
    process.exit(1);
  }
}

// CI Integration
if (process.env.CI) {
  console.log('Running in CI environment...');
  // Add any CI-specific setup here
}

// Run the tests
runAllDecouplingTests().catch(error => {
  console.error('Critical error in decoupling test runner:', error);
  process.exit(1);
});
