#!/usr/bin/env node

/**
 * Integration tests for the Help Search script.
 *
 * Usage:
 *   node skills/salesforce-help-searching/scripts/test-search.js
 */


'use strict';

const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const SEARCH = path.resolve(__dirname, 'search-help.js');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const ENV_AI_PATH = path.join(PROJECT_ROOT, '.env-ai');

const QUERY = 'b2c commerce roles and permissions';

function run(args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SEARCH, ...args],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          exitCode: error ? error.code ?? 1 : 0,
          stdout,
          stderr,
        });
      }
    );
  });
}

const results = [];

function assert(name, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL';
  results.push({ name, status, detail });
  const icon = condition ? '✅' : '❌';
  console.log(`  ${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

async function removeEnvAi() {
  try {
    await fs.unlink(ENV_AI_PATH);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

(async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Salesforce Help Search — Tests              ║');
  console.log('╚══════════════════════════════════════════════╝');

  await removeEnvAi();

  console.log('\n── Test 1: Basic JSON output ──');
  try {
    const { exitCode, stdout, stderr } = await run([
      '--query', QUERY,
      '--limit', '5',
      '--json',
    ]);

    assert('exit code is 0', exitCode === 0, `got ${exitCode}`);
    assert('no stderr output', stderr.trim().length === 0, stderr.trim());

    let payload = null;
    try {
      payload = JSON.parse(stdout);
    } catch (err) {
      assert('stdout is valid JSON', false, err.message);
    }

    if (payload) {
      assert('payload has results array', Array.isArray(payload.results));
      assert('returns at least one result', payload.results.length > 0, `${payload.results.length} results`);

      const urls = payload.results.map((r) => r.url).filter(Boolean);
      const allowedHosts = ['https://help.salesforce.com/', 'https://developer.salesforce.com/'];
      const allAllowed = urls.every((u) => allowedHosts.some((prefix) => u.startsWith(prefix)));
      assert('results are Help or Developer URLs', allAllowed);

      const hasSearchResultPath = urls.some((u) => u.includes('/s/search-result'));
      assert('no /s/search-result links', !hasSearchResultPath);
    }

    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;

    console.log('\n══════════════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed, ${results.length} total`);
    console.log('══════════════════════════════════════════════\n');

    if (failed > 0) {
      console.log('Failed tests:');
      results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => {
          console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
        });
      process.exit(1);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
