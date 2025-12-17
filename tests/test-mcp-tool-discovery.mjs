/**
 * Integration test for MCP tool discovery
 * Tests that MCP servers can register tools dynamically
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Test configuration
const testServers = [
  {
    name: 'jupyter-server',
    command: 'python',
    args: ['server.py'],
    cwd: path.join(rootDir, 'mcp-servers', 'jupyter-server'),
    expectedTools: ['execute_cell', 'create_notebook', 'list_kernels']
  },
  {
    name: 'workbook-dashboard',
    command: 'python',
    args: ['server.py'],
    cwd: path.join(rootDir, 'mcp-servers', 'workbook-dashboard'),
    expectedTools: ['format_llm_response']
  },
  {
    name: 'workbook-rag',
    command: 'python',
    args: ['server.py'],
    cwd: path.join(rootDir, 'mcp-servers', 'workbook-rag'),
    expectedTools: ['rag_search_content', 'rag_list_files', 'rag_read_file']
  }
];

/**
 * Send a request to an MCP server and wait for response
 */
function sendRequest(proc, method, params = {}, requestId = 1000) {
  return new Promise((resolve, reject) => {
    let responseBuffer = '';
    let timeoutId;

    const cleanup = () => {
      proc.stdout.removeListener('data', onData);
      clearTimeout(timeoutId);
    };

    const onData = (data) => {
      responseBuffer += data.toString();
      const lines = responseBuffer.split('\n');
      responseBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const response = JSON.parse(trimmed);

          // Only resolve if this response matches our request ID
          if (response.id === requestId) {
            cleanup();

            if (response.error) {
              reject(new Error(response.error.message || JSON.stringify(response.error)));
            } else {
              resolve(response.result || response);
            }
            return;
          }
        } catch (e) {
          // Not JSON yet, continue
        }
      }
    };

    proc.stdout.on('data', onData);

    const timeoutMs = process.env.CI ? 20000 : 5000;
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Request timeout for ${method}`));
    }, timeoutMs);

    // Send MCP-compliant request
    const request = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params
    };
    proc.stdin.write(JSON.stringify(request) + '\n');
  });
}

/**
 * Test a single MCP server
 */
async function testServer(serverConfig) {
  console.log(`\n🧪 Testing ${serverConfig.name}...`);
  
  const proc = spawn(serverConfig.command, serverConfig.args, {
    cwd: serverConfig.cwd,
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });

  let initMessage = null;
  let initBuffer = '';

  // Capture initialization message
  proc.stdout.on('data', (data) => {
    initBuffer += data.toString();
    const lines = initBuffer.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      try {
        const msg = JSON.parse(trimmed);
        if (msg.result?.capabilities?.tools || msg.result?.serverInfo) {
          initMessage = msg;
          break;
        }
      } catch (e) {
        // Not JSON yet
      }
    }
  });

  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, process.env.CI ? 1500 : 500));

  let tools = [];
  
  // For servers that declare tools in init message (like workbook-dashboard)
  if (initMessage?.result?.capabilities?.tools && Array.isArray(initMessage.result.capabilities.tools)) {
    tools = initMessage.result.capabilities.tools;
    console.log(`  ✓ Found ${tools.length} tools in initialization message`);
  } else {
    // For servers that use tools/list (like jupyter-server and workbook-rag)
    try {
      let response;
      try {
        response = await sendRequest(proc, 'tools/list', {}, 1001);
      } catch (e) {
        // In CI, some Python servers can take longer to become responsive. Retry once.
        if (process.env.CI && String(e?.message || '').includes('timeout')) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          response = await sendRequest(proc, 'tools/list', {}, 1001);
        } else {
          throw e;
        }
      }
      if (response?.tools && Array.isArray(response.tools)) {
        tools = response.tools;
        console.log(`  ✓ Found ${tools.length} tools via tools/list`);
      } else {
        console.log(`  ⚠ tools/list returned invalid response:`, response);
      }
    } catch (error) {
      console.log(`  ❌ tools/list failed: ${error.message}`);
    }
  }

  // Verify expected tools
  const toolNames = tools.map(t => t.name);
  const missingTools = serverConfig.expectedTools.filter(
    name => !toolNames.includes(name)
  );
  const unexpectedTools = toolNames.filter(
    name => !serverConfig.expectedTools.includes(name)
  );

  if (missingTools.length > 0) {
    console.log(`  ❌ Missing expected tools: ${missingTools.join(', ')}`);
  }
  if (unexpectedTools.length > 0) {
    console.log(`  ⚠ Unexpected tools found: ${unexpectedTools.join(', ')}`);
  }

  const allFound = missingTools.length === 0;
  
  if (allFound) {
    console.log(`  ✅ All expected tools found: ${toolNames.join(', ')}`);
  }

  proc.kill();
  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    server: serverConfig.name,
    success: allFound,
    toolsFound: toolNames,
    expectedTools: serverConfig.expectedTools,
    missingTools
  };
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting MCP Tool Discovery Tests\n');
  console.log('=' .repeat(60));

  const results = [];

  for (const serverConfig of testServers) {
    try {
      const result = await testServer(serverConfig);
      results.push(result);
    } catch (error) {
      console.error(`\n❌ Error testing ${serverConfig.name}:`, error.message);
      results.push({
        server: serverConfig.name,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:\n');

  let allPassed = true;
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.server}`);
    if (result.toolsFound) {
      console.log(`   Found: ${result.toolsFound.join(', ')}`);
    }
    if (result.missingTools && result.missingTools.length > 0) {
      console.log(`   Missing: ${result.missingTools.join(', ')}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (!result.success) {
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(60));
  
  if (allPassed) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
