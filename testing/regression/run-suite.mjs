import fs from 'node:fs/promises';
import path from 'node:path';
import { getHelpDetails } from '../../dist/lib/helpScraper.js';

const FIXTURES_PATH = path.join('testing', 'regression', 'fixtures.json');
const ROOT_DIR = path.join('testing', 'regression');
const CURRENT_DIR = path.join(ROOT_DIR, 'current');
const BASELINE_DIR = path.join(ROOT_DIR, 'baseline');

const args = new Set(process.argv.slice(2));
const promote = args.has('--promote');
const strict = args.has('--strict');
const waitMs = 3000;
const timeoutMs = 60000;

function metrics(markdown) {
  return {
    chars: markdown.length,
    codeBlocks: Math.floor((markdown.match(/```/g) || []).length / 2),
    tables: (markdown.match(/^\|(?:\s*---\s*\|)+\s*$/gm) || []).length,
    images: (markdown.match(/!\[[^\]]*\]\(/g) || []).length,
    orderedSteps: (markdown.match(/^\d+\.\s+/gm) || []).length,
    bullets: (markdown.match(/^-\s+/gm) || []).length,
    headings: (markdown.match(/^#{1,6}\s+/gm) || []).length,
  };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function safeDelta(current, baseline) {
  if (!baseline || baseline === 0) return null;
  return Number((((current - baseline) / baseline) * 100).toFixed(2));
}

const fixturesRaw = await fs.readFile(FIXTURES_PATH, 'utf8');
const fixtures = JSON.parse(fixturesRaw);
if (!Array.isArray(fixtures) || fixtures.length === 0) {
  throw new Error(`No fixtures found in ${FIXTURES_PATH}`);
}

await fs.mkdir(CURRENT_DIR, { recursive: true });
await fs.mkdir(BASELINE_DIR, { recursive: true });

const startedAt = new Date().toISOString();
const results = [];

for (const [index, fixture] of fixtures.entries()) {
  const ordinal = String(index + 1).padStart(2, '0');
  const id = fixture.id || `fixture-${ordinal}`;
  const baselineMdPath = path.join(BASELINE_DIR, `${id}.md`);
  const baselineJsonPath = path.join(BASELINE_DIR, `${id}.json`);
  const currentMdPath = path.join(CURRENT_DIR, `${id}.md`);
  const currentJsonPath = path.join(CURRENT_DIR, `${id}.json`);

  try {
    const detail = await getHelpDetails({
      url: fixture.url,
      useCache: false,
      waitMs,
      timeoutMs,
    });

    const currentMetrics = metrics(detail.markdown);
    await fs.writeFile(currentMdPath, `${detail.markdown}\n`, 'utf8');

    const baselineExists = await fileExists(baselineMdPath);
    let baselineMarkdown = null;
    let baselineMetrics = null;
    let exactMatch = null;
    let charDelta = null;
    let charDeltaPct = null;

    if (baselineExists) {
      baselineMarkdown = await fs.readFile(baselineMdPath, 'utf8');
      baselineMarkdown = baselineMarkdown.replace(/\n$/, '');
      baselineMetrics = metrics(baselineMarkdown);
      exactMatch = baselineMarkdown === detail.markdown;
      charDelta = currentMetrics.chars - baselineMetrics.chars;
      charDeltaPct = safeDelta(currentMetrics.chars, baselineMetrics.chars);
    }

    const row = {
      id,
      kind: fixture.kind || null,
      url: fixture.url,
      title: detail.title,
      focus: Array.isArray(fixture.focus) ? fixture.focus : [],
      fetchedAt: new Date().toISOString(),
      current: currentMetrics,
      baseline: baselineMetrics,
      exactMatch,
      charDelta,
      charDeltaPct,
      baselineExists,
      error: null,
    };

    await fs.writeFile(
      currentJsonPath,
      `${JSON.stringify({ fixture, detail, analysis: row }, null, 2)}\n`,
      'utf8'
    );

    if (promote) {
      await fs.copyFile(currentMdPath, baselineMdPath);
      await fs.copyFile(currentJsonPath, baselineJsonPath);
    }

    const state = !baselineExists ? 'new' : exactMatch ? 'same' : 'changed';
    const deltaLabel = baselineExists
      ? ` Δchars=${charDelta >= 0 ? `+${charDelta}` : `${charDelta}`}${charDeltaPct === null ? '' : ` (${charDeltaPct >= 0 ? '+' : ''}${charDeltaPct}%)`}`
      : '';

    console.log(`[${ordinal}] ${state.padEnd(7)} ${detail.title || id} :: ${currentMetrics.chars} chars${deltaLabel}`);
    results.push(row);
  } catch (error) {
    console.log(`[${ordinal}] error   ${id} :: ${String(error)}`);
    results.push({
      id,
      kind: fixture.kind || null,
      url: fixture.url,
      title: null,
      focus: Array.isArray(fixture.focus) ? fixture.focus : [],
      fetchedAt: new Date().toISOString(),
      current: null,
      baseline: null,
      exactMatch: null,
      charDelta: null,
      charDeltaPct: null,
      baselineExists: await fileExists(path.join(BASELINE_DIR, `${id}.md`)),
      error: String(error),
    });
  }
}

const summary = {
  startedAt,
  finishedAt: new Date().toISOString(),
  fixtureCount: fixtures.length,
  ok: results.filter((r) => !r.error).length,
  failed: results.filter((r) => Boolean(r.error)).length,
  compared: results.filter((r) => r.baselineExists && !r.error).length,
  changed: results.filter((r) => r.baselineExists && r.exactMatch === false && !r.error).length,
  unchanged: results.filter((r) => r.baselineExists && r.exactMatch === true && !r.error).length,
  newBaselineCandidates: results.filter((r) => !r.baselineExists && !r.error).length,
  promoted: promote,
};

const report = { summary, results };
await fs.writeFile(path.join(CURRENT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (promote) {
  await fs.writeFile(path.join(BASELINE_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log('\nSummary:', summary);
console.log(`Report: ${path.join(CURRENT_DIR, 'report.json')}`);
if (promote) {
  console.log(`Baseline updated in ${BASELINE_DIR}`);
}

if (strict) {
  const driftCount = summary.changed + summary.newBaselineCandidates;
  if (summary.failed > 0 || driftCount > 0) {
    console.error(
      `Strict check failed: failed=${summary.failed}, changed=${summary.changed}, new=${summary.newBaselineCandidates}`
    );
    process.exitCode = 1;
  }
} else if (summary.failed > 0) {
  process.exitCode = 1;
}
