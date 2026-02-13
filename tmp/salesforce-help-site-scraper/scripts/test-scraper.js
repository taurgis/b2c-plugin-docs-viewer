#!/usr/bin/env node

/**
 * Integration tests for the Salesforce Help Site Scraper.
 *
 * Scenarios covered:
 *   1. Valid help article (type=5)        → exit 0, output file with real content
 *   2. Non-existent help article          → exit 1, recorded in failure index
 *   3. Failure index skip                 → exit 2 on second run of same bad URL
 *   4. --ignore-cache bypass              → exit 1 (re-runs despite failure index)
 *   5. --retries 0                        → exit 1 after exactly one attempt
 *   6. Knowledge article (type=1, 000394720) → exit 0, real content
 *   7. Knowledge article (type=1, 000391855) → exit 0, Lightning-rendered content
 *   8. B2C Commerce help article          → exit 0, substantial content
 *
 * Usage:
 *   node skills/salesforce-help-site-scraper/scripts/test-scraper.js
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
  'scrape-help-to-markdown.js'
);
const TMP_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'artifacts',
  '.test-output',
  'help-scraper'
);
const FAILURE_INDEX = path.join(TMP_DIR, '.scrape-failures.json');

// URLs -------------------------------------------------------------------
const VALID_URL =
  'https://help.salesforce.com/s/articleView?id=sf.flow.htm&type=5';
const INVALID_URL =
  'https://help.salesforce.com/s/articleView?id=sf.DOES_NOT_EXIST_TEST_12345&type=5';
const KNOWLEDGE_ARTICLE_1_URL =
  'https://help.salesforce.com/s/articleView?id=000394720&type=1';
const KNOWLEDGE_ARTICLE_2_URL =
  'https://help.salesforce.com/s/articleView?id=000391855&type=1';
const B2C_COMMERCE_URL =
  'https://help.salesforce.com/s/articleView?id=cc.b2c_roles_and_permissions.htm&type=5';

// Helpers ----------------------------------------------------------------

function run(args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    execFile(
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

async function testValidArticle() {
  console.log('\n── Test 1: Valid help article ──');
  const outFile = path.join(TMP_DIR, 'valid_article.md');
  const { exitCode } = await run([
    '--url', VALID_URL,
    '--out', outFile,
    '--retries', '0',
    '--wait', '3000',
  ]);

  assert('exit code is 0', exitCode === 0, `got ${exitCode}`);
  assert('output file created', await fileExists(outFile));

  if (await fileExists(outFile)) {
    const content = await fs.readFile(outFile, 'utf8');
    assert('content has Source line', content.includes('Source:'));
    assert('content has Fetched line', content.includes('Fetched:'));
    assert('content is substantial (>200 chars)', content.length > 200, `${content.length} chars`);

    // Should NOT be garbage footer content
    const langPickerLines = (content.match(/^\*\s+(English|Français|Deutsch)/gm) || []).length;
    assert('not a language picker dump', langPickerLines < 5, `lang lines: ${langPickerLines}`);
  }
}

async function testInvalidArticle() {
  console.log('\n── Test 2: Non-existent help article ──');
  const outFile = path.join(TMP_DIR, 'invalid_article.md');
  const { exitCode, stderr } = await run([
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

  // The failure reason should mention Aura error or garbage content
  if (index && index[INVALID_URL]) {
    const reason = index[INVALID_URL].reason;
    const isExpectedReason =
      reason.includes('Aura') ||
      reason.includes('Garbage') ||
      reason.includes('Content too short') ||
      reason.includes('Error/not-found') ||
      reason.includes('Error page detected');
    assert('failure reason is descriptive', isExpectedReason, `reason: ${reason}`);
  }
}

async function testFailureIndexSkip() {
  console.log('\n── Test 3: Failure index skip (exit 2) ──');
  // The invalid URL from test 2 should already be in the failure index.
  const outFile = path.join(TMP_DIR, 'skip_article.md');
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
  const outFile = path.join(TMP_DIR, 'ignore_cache_article.md');
  const { exitCode } = await run([
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
    'https://help.salesforce.com/s/articleView?id=sf.UNIQUE_NONEXISTENT_HELP_98765&type=5';
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

async function testKnowledgeArticle1() {
  console.log('\n── Test 6: Knowledge article (type=1, 000394720) ──');
  const outFile = path.join(TMP_DIR, 'knowledge_1.md');
  const { exitCode } = await run([
    '--url', KNOWLEDGE_ARTICLE_1_URL,
    '--out', outFile,
    '--retries', '0',
    '--wait', '3000',
  ]);

  assert('exit code is 0', exitCode === 0, `got ${exitCode}`);
  assert('output file created', await fileExists(outFile));

  if (await fileExists(outFile)) {
    const content = await fs.readFile(outFile, 'utf8');
    assert('content is substantial (>300 chars)', content.length > 300, `${content.length} chars`);
    assert('content has Source line', content.includes('Source:'));
  }
}

async function testKnowledgeArticle2() {
  console.log('\n── Test 7: Knowledge article (type=1, 000391855 — Lightning rendered) ──');
  const outFile = path.join(TMP_DIR, 'knowledge_2.md');
  const { exitCode } = await run([
    '--url', KNOWLEDGE_ARTICLE_2_URL,
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
    // This article is about B2C Commerce load testing
    const hasRelevantContent = /load test|commerce|checklist/i.test(content);
    assert('content has topic-relevant terms', hasRelevantContent);
  }
}

async function testB2cCommerceArticle() {
  console.log('\n── Test 8: B2C Commerce help article ──');
  const outFile = path.join(TMP_DIR, 'b2c_commerce.md');
  const { exitCode } = await run([
    '--url', B2C_COMMERCE_URL,
    '--out', outFile,
    '--retries', '0',
    '--wait', '3000',
  ]);

  assert('exit code is 0', exitCode === 0, `got ${exitCode}`);
  assert('output file created', await fileExists(outFile));

  if (await fileExists(outFile)) {
    const content = await fs.readFile(outFile, 'utf8');
    assert('content is substantial (>2000 chars)', content.length > 2000, `${content.length} chars`);
    assert('content has Source line', content.includes('Source:'));
    // B2C roles article should mention roles/permissions
    const hasRelevantContent = /role|permission/i.test(content);
    assert('content has roles/permissions terms', hasRelevantContent);
  }
}

// Main -------------------------------------------------------------------

(async () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Salesforce Help Site Scraper — Tests        ║');
  console.log('╚══════════════════════════════════════════════╝');

  await cleanup();
  await fs.mkdir(TMP_DIR, { recursive: true });

  try {
    await testValidArticle();
    await testInvalidArticle();
    await testFailureIndexSkip();
    await testIgnoreCacheBypass();
    await testRetriesZero();
    await testKnowledgeArticle1();
    await testKnowledgeArticle2();
    await testB2cCommerceArticle();
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
