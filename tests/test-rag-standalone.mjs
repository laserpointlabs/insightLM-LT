#!/usr/bin/env node
/**
 * Standalone RAG integration test
 * Creates its own test data, tests the full flow, cleans up
 * Can run in CI without any real user data
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname); // Go up one level to project root

// Create test workbook structure
function createTestWorkbooks(testDir) {
  const workbooksDir = path.join(testDir, 'workbooks');

  // Workbook 1: NDAs
  const ndasId = 'test-ndas-wb';
  const ndasDir = path.join(workbooksDir, ndasId);
  fs.mkdirSync(path.join(ndasDir, 'documents'), { recursive: true });

  // Create workbook.json
  fs.writeFileSync(path.join(ndasDir, 'workbook.json'), JSON.stringify({
    name: 'NDAs',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    documents: [
      { filename: 'Vallen_NDA.md', path: 'documents/Vallen_NDA.md', addedAt: new Date().toISOString() },
      { filename: 'Acme_NDA.md', path: 'documents/Acme_NDA.md', addedAt: new Date().toISOString() }
    ]
  }, null, 2));

  // Create test NDA documents (markdown since we don't need real PDFs)
  fs.writeFileSync(path.join(ndasDir, 'documents', 'Vallen_NDA.md'), `# Vallen Distribution NDA

## Parties
- Vallen Distribution, Inc. (Delaware corporation)
- Kidde-Fenwal, LLC

## Effective Date
July 25, 2025

## Terms
This mutual non-disclosure agreement covers proprietary data exchange between the parties.
The agreement expires July 2028.
`);

  fs.writeFileSync(path.join(ndasDir, 'documents', 'Acme_NDA.md'), `# Acme Corporation NDA

## Parties
- Acme Corporation
- Test Company LLC

## Effective Date
June 1, 2025

## Terms
Standard non-disclosure agreement for business discussions.
`);

  // Workbook 2: Technical Docs
  const techId = 'test-tech-wb';
  const techDir = path.join(workbooksDir, techId);
  fs.mkdirSync(path.join(techDir, 'documents'), { recursive: true });

  fs.writeFileSync(path.join(techDir, 'workbook.json'), JSON.stringify({
    name: 'Technical Docs',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    documents: [
      { filename: 'glossary.md', path: 'documents/glossary.md', addedAt: new Date().toISOString() },
      { filename: 'specifications.md', path: 'documents/specifications.md', addedAt: new Date().toISOString() }
    ]
  }, null, 2));

  fs.writeFileSync(path.join(techDir, 'documents', 'glossary.md'), `# Technical Glossary

## BSEO
Base Systems Engineering Ontology - A foundational ontology that provides core classes and relationships for systems engineering analysis.

## ODRAS
Ontology-Driven Requirements Analysis System - Uses BSEO for consistent terminology.

## Key Concepts
- System, Component, Function, Interface, Requirement, Constraint
`);

  fs.writeFileSync(path.join(techDir, 'documents', 'specifications.md'), `# System Specifications

## Cabin Dimensions
- ALT-X1: 3.5 meters wide
- AC-1000: 4.25 meters wide

## Other Specs
- Pressurization: 8,000 ft cabin altitude
- Temperature: 18-24°C cabin temperature range
`);

  return { workbooksDir, ndasId, techId };
}

// Call MCP server
async function callMCPServer(query, testDataDir) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(rootDir, 'mcp-servers', 'workbook-rag', 'server.py');
    const proc = spawn('python', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(rootDir, 'mcp-servers', 'workbook-rag'),
      env: {
        ...process.env,
        INSIGHTLM_DATA_DIR: testDataDir,
        DEBUG: 'true'  // Enable debug mode
      }
    });

    let output = '';
    let stderr = '';
    let initReceived = false;

    proc.stdout.on('data', (data) => {
      output += data.toString();

      // Check if we have a complete message and it's the init message
      const lines = output.split('\n').filter(l => l.trim() && l.startsWith('{'));
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.result && msg.result.protocolVersion && !initReceived) {
            // This is the init message, mark it as received
            initReceived = true;
            console.log('Init message received, sending tool call...');

            // Now send the tool call request
            const request = {
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/call',
              params: {
                name: 'rag_search_content',
                arguments: { query, limit: 5 }
              }
            };
            proc.stdin.write(JSON.stringify(request) + '\n');
            break;
          } else if (msg.id === 2 && initReceived) {
            // This is our tool call response
            resolve(msg);
            return;
          }
        } catch (e) {
          // Not a complete JSON message yet
        }
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', reject);

    // Set a timeout
    setTimeout(() => {
      reject(new Error('Timeout waiting for MCP response'));
    }, 10000);

    proc.on('close', () => {
      if (!initReceived) {
        reject(new Error('Server did not send initialization message. stderr: ' + stderr));
      }
    });
  });
}

// Track files from RAG response
function trackFilesFromRAGResponse(content) {
  const filePattern = /\*\*([^*]+)\*\*\s*\(([^)]+)\)\s*\n\s*Workbook ID:\s*([^\n]+)\s*\n\s*Path:\s*([^\n]+)/g;

  const filesTracked = [];
  let match;

  while ((match = filePattern.exec(content)) !== null) {
    filesTracked.push({
      filename: match[1].trim(),
      workbookName: match[2].trim(),
      workbookId: match[3].trim(),
      filePath: match[4].trim()
    });
  }

  return filesTracked;
}

// Run a single test
async function testQuery(query, expectedSources, testDataDir) {
  console.log('\n' + '='.repeat(80));
  console.log(`Query: "${query}"`);
  console.log('='.repeat(80));

  try {
    const response = await callMCPServer(query, testDataDir);

    if (response.error) {
      console.log(`❌ MCP Error: ${response.error}`);
      return false;
    }

    const content = response.result?.content || response.result || '';
    const sources = trackFilesFromRAGResponse(content);

    console.log(`Sources tracked: ${sources.length}`);
    sources.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.filename}`);
    });

    if (sources.length === expectedSources) {
      console.log(`✅ PASS (${sources.length} source(s))`);
      return true;
    } else {
      console.log(`❌ FAIL (expected ${expectedSources}, got ${sources.length})`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

// Main
async function main() {
  console.log('STANDALONE RAG INTEGRATION TEST');
  console.log('Self-contained test with generated test data');
  console.log('');

  // Create temp directory for test data
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insightlm-test-'));
  console.log(`Test data directory: ${testDir}`);

  try {
    // Setup test data
    console.log('Setting up test workbooks...');
    createTestWorkbooks(testDir);
    console.log('✓ Test data created');

    // Run tests
    const tests = [
      { query: 'who are the parties in the vallen nda?', expected: 1 },
      { query: 'what is BSEO?', expected: 1 },
      { query: 'how wide are the cabins?', expected: 1 },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      const result = await testQuery(test.query, test.expected, testDir);
      if (result) {
        passed++;
      } else {
        failed++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(80));

    // Cleanup
    console.log(`\nCleaning up: ${testDir}`);
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('✓ Cleanup complete');

    if (failed > 0) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed');
      process.exit(0);
    }
  } catch (error) {
    console.error('Test error:', error);
    // Cleanup on error
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    process.exit(1);
  }
}

main();
