#!/usr/bin/env node

/**
 * Integration tests for the Salesforce Developer Site Scraper.
 *
 * Scenarios covered:
 *   1. Valid doc page (atlas)             → exit 0, output file with real content
 *   2. Non-existent doc page              → exit 1, recorded in failure index
 *   3. Failure index skip                 → exit 2 on second run of same bad URL
 *   4. --ignore-cache bypass              → exit 1 (re-runs despite failure index)
 *   5. --retries 0                        → exit 1 after exactly one attempt
 *   6. Commerce API guide (new-style URL) → exit 0, real content
 *   7. SCAPI reference (shadow DOM)       → exit 0, content via shadow DOM pierce
 *   8. CDN Zones Logpush guide            → exit 0, substantial content
 *   9. B2C Mappings guide                 → exit 0, substantial content
 *
 * Usage:
 *   node skills/salesforce-developer-site-scraper/scripts/test-scraper.js
 *
 * Prerequisites:
 *   npm install playwright @mozilla/readability jsdom turndown
 */

'use strict';

const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const SCRAPER = path.resolve(
  __dirname,
  'scrape-to-markdown.js'
);
const TMP_DIR = path.resolve(__dirname, '..', '..', '..', '.test-output', 'dev-scraper');
const FAILURE_INDEX = path.join(TMP_DIR, '.scrape-failures.json');

// URLs -------------------------------------------------------------------
const VALID_URL =
  'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_intro.htm';
const INVALID_URL =
  'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/THIS_DOES_NOT_EXIST_TEST_12345.htm';
const COMMERCE_GUIDE_URL =
  'https://developer.salesforce.com/docs/commerce/commerce-api/guide/quick-start.html';
const SCAPI_REFERENCE_URL =
  'https://developer.salesforce.com/docs/commerce/commerce-api/references/shopper-customers?meta=getCustomer';
const CDN_LOGPUSH_URL =
  'https://developer.salesforce.com/docs/commerce/commerce-api/guide/cdn-zones-logpush.html';
const B2C_MAPPINGS_URL =
  'https://developer.salesforce.com/docs/commerce/commerce-api/guide/b2c-mappings.html';

// Helpers ----------------------------------------------------------------

function run(args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [SCRAPER, ...args],
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

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

async function cleanup() {
  await fs.rm(TMP_DIR, { recursive: true, force: true });
}

// Test runner ------------------------------------------------------------

const results = [];

function assert(name, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL';
  results.push({ name, status, detail });
  const icon = condition ? '✅' : '❌';
  console.log(`  ${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

// Tests ------------------------------------------------------------------

async function testValidPage() {
  console.log('\n── Test 1: Valid developer doc page ──');
  const outFile = path.join(TMP_DIR, 'valid_page.md');
  const { exitCode, stdout, stderr } = await run([
    '--url', VALID_URL,
    '--out', outFile,
    '--retries', '0',
    '--wait', '2000',
  ]);

  assert('exit code is 0', exitCode === 0, `got ${exitCode}`);
  assert('output file created', await fileExists(outFile));

  if (await fileExists(outFile)) {
    const content = await fs.readFile(outFile, 'utf8');
    assert('content has Source line', content.includes('Source:'));
    assert('content has Fetched line', content.includes('Fetched:'));
    assert('content is substantial (>200 chars)', content.length > 200, `${content.length} chars`);
    assert('content is not garbage footer', !content.includes('Salesforce Tower, 415 Mission Street'));
  }
}

async function testInvalidPage() {
  console.log('\n── Test 2: Non-existent developer doc page ──');
  const outFile = path.join(TMP_DIR, 'invalid_page.md');
  const { exitCode, stdout, stderr } = await run([
    '--url', INVALID_URL,
    '--out', outFile,
    '--retries', '0',
  ]);

  assert('exit code is 1', exitCode === 1, `got ${exitCode}`);
  assert('output file NOT created', !(await fileExists(outFile)));
  assert('stderr mentions failure', stderr.includes('FAILED'));

  // Check failure index was written
  const index = await readJson(FAILURE_INDEX);
  assert('failure index exists', index !== null);
  assert('failure index contains URL', index !== null && Boolean(index[INVALID_URL]),
    index ? `reason: ${index[INVALID_URL]?.reason}` : 'no index');
}

async function testFailureIndexSkip() {
  console.log('\n── Test 3: Failure index skip (exit 2) ──');
  // The invalid URL from test 2 should already be in the failure index.
  const outFile = path.join(TMP_DIR, 'skip_page.md');
  const { exitCode, stderr } = await run([
    '--url', INVALID_URL,
    '--out', outFile,
    '--retries', '0',
  ]);

  assert('exit code is 2', exitCode === 2, `got ${exitCode}`);
  assert('stderr mentions SKIPPED', stderr.includes('SKIPPED'));
  assert('output file NOT created', !(await fileExists(outFile)));
}

async function testIgnoreCacheBypass() {
  console.log('\n── Test 4: --ignore-cache bypasses failure index ──');
  const outFile = path.join(TMP_DIR, 'ignore_cache_page.md');
  const { exitCode, stderr } = await run([
    '--url', INVALID_URL,
    '--out', outFile,
    '--retries', '0',
    '--ignore-cache',
  ]);

  // Should NOT exit 2 — it re-runs despite the failure index entry
  assert('exit code is NOT 2', exitCode !== 2, `got ${exitCode}`);
  assert('exit code is 1 (still fails)', exitCode === 1, `got ${exitCode}`);
  assert('output file NOT created', !(await fileExists(outFile)));

  // Attempt count should have incremented
  const index = await readJson(FAILURE_INDEX);
  const entry = index && index[INVALID_URL];
  assert('failure index attempts incremented', entry && entry.attempts >= 2,
    `attempts: ${entry?.attempts}`);
}

async function testRetriesZero() {
  console.log('\n── Test 5: --retries 0 runs exactly once ──');
  // Use a fresh invalid URL so there's no failure index entry
  const freshInvalid =
    'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/UNIQUE_NONEXISTENT_98765.htm';
  const outFile = path.join(TMP_DIR, 'retries_zero.md');
  const { exitCode, stderr } = await run([
    '--url', freshInvalid,
    '--out', outFile,
    '--retries', '0',
  ]);

  assert('exit code is 1', exitCode === 1, `got ${exitCode}`);
  // With --retries 0 there should be no "Retry" messages in stderr
  assert('no retry messages in output', !stderr.includes('Retry '), 'should have run only once');
}

async function testCommerceGuide() {
  console.log('\n── Test 6: Commerce API guide (new-style URL) ──');
  const outFile = path.join(TMP_DIR, 'commerce_guide.md');
  const { exitCode } = await run([
    '--url', COMMERCE_GUIDE_URL,
    '--out', outFile,
    '--retries', '0',
    '--wait', '3000',
  ]);

  assert('exit code is 0', exitCode === 0, `got ${exitCode}`);
  assert('output file created', await fileExists(outFile));

  if (await fileExists(outFile)) {
    const content = await fs.readFile(outFile, 'utf8');
    assert('content is substantial (>500 chars)', content.length > 500, `${content.length} chars`);
    assert('content has Source line', content.includes('Source:'));
  }
}

async function testScapiReference() {
  console.log('\n── Test 7: SCAPI reference (shadow DOM) ──');
  const outFile = path.join(TMP_DIR, 'scapi_reference.md');
  const { exitCode } = await run([
    '--url', SCAPI_REFERENCE_URL,
    '--out', outFile,
    '--retries', '0',
    '--wait', '5000',
  ], { timeoutMs: 180_000 });

  assert('exit code is 0', exitCode === 0, `got ${exitCode}`);
  assert('output file created', await fileExists(outFile));

  if (await fileExists(outFile)) {
    const content = await fs.readFile(outFile, 'utf8');
    assert('content is substantial (>5000 chars)', content.length > 5000, `${content.length} chars`);
    assert('content has Source line', content.includes('Source:'));
    // SCAPI reference should contain API-specific terms
    const hasApiContent = content.includes('customer') || content.includes('endpoint') || content.includes('GET');
    assert('content has API reference terms', hasApiContent);
  }
}

async function testCdnLogpush() {
  console.log('\n── Test 8: CDN Zones Logpush guide ──');
  const outFile = path.join(TMP_DIR, 'cdn_logpush.md');
  const { exitCode } = await run([
    '--url', CDN_LOGPUSH_URL,
    '--out', outFile,
    '--retries', '0',
    '--wait', '3000',
  ]);

  assert('exit code is 0', exitCode === 0, `got ${exitCode}`);
  assert('output file created', await fileExists(outFile));

  if (await fileExists(outFile)) {
    const content = await fs.readFile(outFile, 'utf8');
    assert('content is substantial (>5000 chars)', content.length > 5000, `${content.length} chars`);
    assert('content has Source line', content.includes('Source:'));
    const hasRelevantContent = /logpush|cdn|eCDN/i.test(content);
    assert('content has CDN/logpush terms', hasRelevantContent);
  }
}

async function testB2cMappings() {
  console.log('\n── Test 9: B2C Mappings guide ──');
  const outFile = path.join(TMP_DIR, 'b2c_mappings.md');
  const { exitCode } = await run([
    '--url', B2C_MAPPINGS_URL,
    '--out', outFile,
    '--retries', '0',
    '--wait', '3000',
  ]);

  assert('exit code is 0', exitCode === 0, `got ${exitCode}`);
  assert('output file created', await fileExists(outFile));

  if (await fileExists(outFile)) {
    const content = await fs.readFile(outFile, 'utf8');
    assert('content is substantial (>3000 chars)', content.length > 3000, `${content.length} chars`);
    assert('content has Source line', content.includes('Source:'));
    const hasRelevantContent = /mapping|B2C|commerce/i.test(content);
    assert('content has B2C/mapping terms', hasRelevantContent);
  }
}

// Main -------------------------------------------------------------------

(async () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Salesforce Developer Site Scraper — Tests   ║');
  console.log('╚══════════════════════════════════════════════╝');

  await cleanup();
  await fs.mkdir(TMP_DIR, { recursive: true });

  try {
    await testValidPage();
    await testInvalidPage();
    await testFailureIndexSkip();
    await testIgnoreCacheBypass();
    await testRetriesZero();
    await testCommerceGuide();
    await testScapiReference();
    await testCdnLogpush();
    await testB2cMappings();
  } finally {
    await cleanup();
  }

  // Summary
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log('\n══════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('══════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    });
    process.exit(1);
  }
})();
