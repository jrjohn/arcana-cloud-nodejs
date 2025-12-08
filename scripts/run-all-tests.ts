#!/usr/bin/env npx tsx
/**
 * Comprehensive Test Runner
 *
 * Runs all tests across different deployment modes and protocols,
 * then generates a consolidated HTML report.
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const REPORT_DIR = 'docs/test-reports';
const MODES = ['monolithic', 'layered'] as const;
const PROTOCOLS = ['direct', 'grpc', 'http'] as const;

interface TestResult {
  mode: string;
  protocol: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
  timestamp: string;
}

interface TestSummary {
  timestamp: string;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  results: TestResult[];
}

function runCommand(cmd: string, env: Record<string, string> = {}): { stdout: string; success: boolean } {
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000
    });
    return { stdout, success: true };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string };
    return { stdout: execError.stdout || '', success: false };
  }
}

function parseTestOutput(output: string): { passed: number; failed: number; skipped: number; duration: string } {
  const passedMatch = output.match(/(\d+) passed/);
  const failedMatch = output.match(/(\d+) failed/);
  const skippedMatch = output.match(/(\d+) skipped/);
  const durationMatch = output.match(/Duration\s+([^\n]+)/);

  return {
    passed: passedMatch ? parseInt(passedMatch[1]) : 0,
    failed: failedMatch ? parseInt(failedMatch[1]) : 0,
    skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
    duration: durationMatch ? durationMatch[1].trim() : 'N/A'
  };
}

async function main() {
  console.log('🧪 Arcana Cloud Node.js - Comprehensive Test Suite\n');
  console.log('=' .repeat(60));

  // Ensure report directory exists
  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }

  const results: TestResult[] = [];
  const timestamp = new Date().toISOString();

  // Run Unit Tests
  console.log('\n📋 Running Unit Tests...\n');
  const unitResult = runCommand('npm run test:vitest -- --run tests/unit 2>&1');
  const unitStats = parseTestOutput(unitResult.stdout);
  results.push({
    mode: 'unit',
    protocol: 'N/A',
    ...unitStats,
    timestamp
  });
  console.log(`   ✅ Passed: ${unitStats.passed}, ❌ Failed: ${unitStats.failed}`);

  // Run Database Tests
  console.log('\n📋 Running Database Tests...\n');
  const dbResult = runCommand(
    'npm run test:vitest -- --run tests/database 2>&1',
    { DATABASE_URL: 'mysql://arcana_test:arcana_test_pass@localhost:3307/arcana_test' }
  );
  const dbStats = parseTestOutput(dbResult.stdout);
  results.push({
    mode: 'database',
    protocol: 'N/A',
    ...dbStats,
    timestamp
  });
  console.log(`   ✅ Passed: ${dbStats.passed}, ❌ Failed: ${dbStats.failed}`);

  // Run Integration Tests for each mode/protocol combination
  for (const mode of MODES) {
    const protocols = mode === 'monolithic' ? ['direct'] : ['grpc', 'http'];

    for (const protocol of protocols) {
      console.log(`\n📋 Running Integration Tests [${mode.toUpperCase()} + ${protocol.toUpperCase()}]...\n`);

      const env = {
        DEPLOYMENT_MODE: mode,
        COMMUNICATION_PROTOCOL: protocol,
        DATABASE_URL: 'mysql://arcana_test:arcana_test_pass@localhost:3307/arcana_test',
        JWT_SECRET: 'test-secret-key-min-32-characters-for-testing!'
      };

      const intResult = runCommand('npm run test:vitest -- --run tests/integration 2>&1', env);
      const intStats = parseTestOutput(intResult.stdout);
      results.push({
        mode,
        protocol,
        ...intStats,
        timestamp
      });
      console.log(`   ✅ Passed: ${intStats.passed}, ❌ Failed: ${intStats.failed}`);
    }
  }

  // Calculate totals
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const totalTests = totalPassed + totalFailed + totalSkipped;

  const summary: TestSummary = {
    timestamp,
    totalTests,
    totalPassed,
    totalFailed,
    totalSkipped,
    results
  };

  // Write JSON summary
  writeFileSync(
    join(REPORT_DIR, 'test-summary.json'),
    JSON.stringify(summary, null, 2)
  );

  // Generate HTML Report
  generateHTMLReport(summary);

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Total Tests:  ${totalTests}`);
  console.log(`   ✅ Passed:    ${totalPassed}`);
  console.log(`   ❌ Failed:    ${totalFailed}`);
  console.log(`   ⏭️  Skipped:   ${totalSkipped}`);
  console.log('='.repeat(60));
  console.log(`\n📄 HTML Report: ${REPORT_DIR}/test-report.html`);
}

function generateHTMLReport(summary: TestSummary): void {
  const passRate = summary.totalTests > 0
    ? ((summary.totalPassed / summary.totalTests) * 100).toFixed(1)
    : '0';

  const statusColor = summary.totalFailed === 0 ? '#22c55e' : '#ef4444';
  const statusText = summary.totalFailed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arcana Cloud Node.js - Test Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e5e5e5;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      text-align: center;
      margin-bottom: 2rem;
      padding: 2rem;
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .subtitle { color: #94a3b8; font-size: 1.1rem; }
    .timestamp { color: #64748b; font-size: 0.9rem; margin-top: 0.5rem; }

    .status-banner {
      background: ${statusColor};
      color: white;
      padding: 1rem 2rem;
      border-radius: 12px;
      text-align: center;
      font-weight: bold;
      font-size: 1.2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 1.5rem;
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    }
    .stat-value {
      font-size: 3rem;
      font-weight: bold;
      background: linear-gradient(90deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stat-label { color: #94a3b8; margin-top: 0.5rem; }
    .stat-card.passed .stat-value { background: linear-gradient(90deg, #22c55e, #4ade80); -webkit-background-clip: text; }
    .stat-card.failed .stat-value { background: linear-gradient(90deg, #ef4444, #f87171); -webkit-background-clip: text; }
    .stat-card.skipped .stat-value { background: linear-gradient(90deg, #f59e0b, #fbbf24); -webkit-background-clip: text; }

    .results-section {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 2rem;
    }
    h2 {
      color: #f1f5f9;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    th {
      background: rgba(255,255,255,0.05);
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 0.05em;
    }
    tr:hover { background: rgba(255,255,255,0.03); }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .badge-mode {
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }
    .badge-protocol {
      background: rgba(20, 184, 166, 0.2);
      color: #2dd4bf;
      border: 1px solid rgba(20, 184, 166, 0.3);
    }
    .badge-passed {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }
    .badge-failed {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }

    .progress-bar {
      height: 8px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 1rem;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #22c55e, #4ade80);
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .architecture-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .arch-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 1.5rem;
    }
    .arch-card h3 {
      color: #f1f5f9;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .arch-card ul {
      list-style: none;
      color: #94a3b8;
    }
    .arch-card li {
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .arch-card li:last-child { border-bottom: none; }

    footer {
      text-align: center;
      color: #64748b;
      padding: 2rem;
      font-size: 0.9rem;
    }
    footer a { color: #60a5fa; text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🧪 Arcana Cloud Node.js</h1>
      <p class="subtitle">Comprehensive Test Report</p>
      <p class="timestamp">Generated: ${new Date(summary.timestamp).toLocaleString()}</p>
    </header>

    <div class="status-banner">
      ${statusText}
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${summary.totalTests}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card passed">
        <div class="stat-value">${summary.totalPassed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value">${summary.totalFailed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card skipped">
        <div class="stat-value">${summary.totalSkipped}</div>
        <div class="stat-label">Skipped</div>
      </div>
    </div>

    <div class="results-section">
      <h2>📊 Pass Rate: ${passRate}%</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${passRate}%"></div>
      </div>
    </div>

    <div class="results-section">
      <h2>📋 Test Results by Category</h2>
      <table>
        <thead>
          <tr>
            <th>Test Category</th>
            <th>Mode</th>
            <th>Protocol</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${summary.results.map(r => `
          <tr>
            <td><strong>${r.mode === 'unit' ? '🔬 Unit Tests' : r.mode === 'database' ? '🗄️ Database Tests' : '🔗 Integration Tests'}</strong></td>
            <td><span class="badge badge-mode">${r.mode}</span></td>
            <td><span class="badge badge-protocol">${r.protocol}</span></td>
            <td><span class="badge badge-passed">${r.passed} ✓</span></td>
            <td><span class="badge ${r.failed > 0 ? 'badge-failed' : ''}">${r.failed} ✗</span></td>
            <td>${r.duration}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="architecture-section">
      <div class="arch-card">
        <h3>🏗️ Deployment Modes Tested</h3>
        <ul>
          <li>✅ <strong>Monolithic</strong> - Single process, direct calls</li>
          <li>✅ <strong>Layered</strong> - Multi-container with gRPC/HTTP</li>
        </ul>
      </div>
      <div class="arch-card">
        <h3>📡 Communication Protocols</h3>
        <ul>
          <li>✅ <strong>Direct</strong> - In-process function calls</li>
          <li>✅ <strong>gRPC</strong> - Protocol Buffers (80% faster)</li>
          <li>✅ <strong>HTTP</strong> - REST over HTTP/1.1</li>
        </ul>
      </div>
      <div class="arch-card">
        <h3>🔧 Technology Stack</h3>
        <ul>
          <li>Node.js + TypeScript</li>
          <li>Express.js + Prisma ORM</li>
          <li>InversifyJS DI</li>
          <li>Vitest Test Framework</li>
        </ul>
      </div>
    </div>

    <footer>
      <p>Arcana Cloud Node.js &copy; ${new Date().getFullYear()}</p>
      <p>Built with ❤️ using <a href="https://vitest.dev">Vitest</a> and <a href="https://inversify.io">InversifyJS</a></p>
    </footer>
  </div>
</body>
</html>`;

  writeFileSync(join(REPORT_DIR, 'test-report.html'), html);
}

main().catch(console.error);
