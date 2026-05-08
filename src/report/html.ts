import { writeFile } from 'node:fs/promises';
import type { DuplicationFinding, Finding, Report } from '../types.js';

export interface CategoryRating {
  tier: string;
  density: number;
  count: number;
  weight: number;
  score: number;
}

export interface RatingResult {
  overall: { tier: string; compositeDensity: number };
  categories: Record<string, CategoryRating>;
}

const WEIGHTS: Record<string, number> = {
  complexity: 0.25,
  duplicates: 0.2,
  longFunctions: 0.15,
  deepNesting: 0.1,
  longParamLists: 0.1,
  magicNumbers: 0.1,
  unusedExports: 0.05,
  todos: 0.05,
};

const BUCKETS: { max: number; tiers: string[] }[] = [
  { max: 0.25, tiers: ['Aaa'] },
  { max: 1.0, tiers: ['Aa1', 'Aa2', 'Aa3'] },
  { max: 2.5, tiers: ['A1', 'A2', 'A3'] },
  { max: 4.0, tiers: ['Baa1', 'Baa2', 'Baa3'] },
  { max: 6.25, tiers: ['Ba1', 'Ba2', 'Ba3'] },
  { max: 8.5, tiers: ['B1', 'B2', 'B3'] },
  { max: 11.5, tiers: ['Caa1', 'Caa2', 'Caa3'] },
  { max: 13, tiers: ['Ca'] },
  { max: Infinity, tiers: ['C'] },
];

const ALL_TIERS = [
  'Aaa', 'Aa1', 'Aa2', 'Aa3', 'A1', 'A2', 'A3',
  'Baa1', 'Baa2', 'Baa3', 'Ba1', 'Ba2', 'Ba3',
  'B1', 'B2', 'B3', 'Caa1', 'Caa2', 'Caa3', 'Ca', 'C',
];

const TIER_DESCRIPTIONS: Record<string, string> = {
  Aaa: 'Exemplary. Minimal maintenance risk; near-zero findings across all categories.',
  Aa1: 'High quality. Very low risk; isolated trivial issues.',
  Aa2: 'High quality. Very low risk; minor isolated findings.',
  Aa3: 'High quality. Low risk; small clusters of low-severity findings.',
  A1: 'Upper-medium grade. Low risk; sound code with limited friction.',
  A2: 'Upper-medium grade. Sound code with friction in one or two areas.',
  A3: 'Upper-medium grade. Sound but with noticeable friction emerging.',
  Baa1: 'Medium grade. Acceptable risk; some maintenance cost is being deferred.',
  Baa2: 'Medium grade. Acceptable risk; deferred maintenance is visible but bounded.',
  Baa3: 'Lowest investment grade. Acceptable but close to speculative; rework warranted.',
  Ba1: 'Speculative. Substantial maintenance risk; refactor priorities should be set.',
  Ba2: 'Speculative. Substantial risk; quality erosion compounds without intervention.',
  Ba3: 'Speculative. Substantial risk; meaningful rework needed before scaling further.',
  B1: 'High risk. Costly to evolve safely; defects likely under change pressure.',
  B2: 'High risk. Refactor effort competes with feature work.',
  B3: 'High risk. Each change carries high regression probability.',
  Caa1: 'Poor standing. Significant rework required before further investment.',
  Caa2: 'Poor standing. Structural redesign of weak areas likely needed.',
  Caa3: 'Poor standing. Compounding defects; rewrite candidates emerging.',
  Ca: 'Severe. Near-failure; effective refactor or replacement is overdue.',
  C: 'Critical. Code is effectively unmaintainable in its current form.',
};

interface CategoryDef {
  key: keyof typeof WEIGHTS;
  name: string;
  sub: string;
  unit: string;
  why: string;
  glossaryKey: string;
  glossaryDef: string;
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: 'complexity',
    name: 'Cyclomatic Complexity',
    sub: 'Decision branches per function',
    unit: 'function over threshold',
    why: 'More decision branches means more execution paths to test and more places a bug can hide.',
    glossaryKey: 'Complexity',
    glossaryDef: 'Cyclomatic complexity — the number of decision branches inside a single function.',
  },
  {
    key: 'longFunctions',
    name: 'Long Functions',
    sub: 'Body length over threshold',
    unit: 'function over threshold',
    why: 'Long functions tend to mix concerns and resist isolated review.',
    glossaryKey: 'Long Funcs',
    glossaryDef: 'Functions whose body length exceeds the configured maximum.',
  },
  {
    key: 'deepNesting',
    name: 'Deep Nesting',
    sub: 'Nested logic over threshold',
    unit: 'function over threshold',
    why: 'Each extra level multiplies the mental effort required to follow the logic.',
    glossaryKey: 'Nesting',
    glossaryDef: 'Conditionals or loops nested beyond the configured threshold depth.',
  },
  {
    key: 'longParamLists',
    name: 'Long Param Lists',
    sub: 'More than threshold arguments',
    unit: 'function over threshold',
    why: 'Many parameters often signal that a function is doing too many jobs.',
    glossaryKey: 'Long Params',
    glossaryDef: 'Functions taking more than the configured number of arguments.',
  },
  {
    key: 'magicNumbers',
    name: 'Magic Numbers',
    sub: 'Unnamed numeric literals',
    unit: 'finding',
    why: 'Anonymous constants make the intent of code unclear and changes risky.',
    glossaryKey: 'Magic Nums',
    glossaryDef: 'Unnamed numeric literals embedded in business logic.',
  },
  {
    key: 'duplicates',
    name: 'Code Duplication',
    sub: 'Repeated logic across files',
    unit: 'duplicated block',
    why: 'Duplicated logic must be fixed in many places when it changes — a steady tax.',
    glossaryKey: 'Duplication',
    glossaryDef: 'Stretches of code repeated across files.',
  },
  {
    key: 'unusedExports',
    name: 'Unused Exports',
    sub: 'Public API never consumed',
    unit: 'finding',
    why: 'Unused exports widen the surface area maintainers must reason about.',
    glossaryKey: 'Unused Exp',
    glossaryDef: 'Public symbols declared but never imported elsewhere.',
  },
  {
    key: 'todos',
    name: 'TODO Backlog',
    sub: 'TODO / FIXME / HACK markers',
    unit: 'unresolved marker',
    why: 'Acknowledged but unresolved work hidden inside the source — a leading indicator of deferred quality work.',
    glossaryKey: 'TODOs',
    glossaryDef: 'Comments tagged TODO, FIXME, HACK or XXX.',
  },
];

const SEVERITY: Record<string, 's-good' | 's-watch' | 's-action'> = {
  Aaa: 's-good', Aa1: 's-good', Aa2: 's-good', Aa3: 's-good',
  A1: 's-good', A2: 's-good', A3: 's-good',
  Baa1: 's-watch', Baa2: 's-watch', Baa3: 's-watch',
};

const PILL: Record<string, string> = {
  Aaa: 't-aaa', Aa1: 't-aaa', Aa2: 't-aaa', Aa3: 't-aaa',
  A1: 't-a', A2: 't-a', A3: 't-a',
  Baa1: 't-baa', Baa2: 't-baa', Baa3: 't-baa',
  Ba1: 't-ba', Ba2: 't-ba', Ba3: 't-ba',
};

export function computeRating(report: Report): RatingResult {
  const kloc = Math.max(report.summary.totalLines / 1000, 0.001);
  const counts: Record<string, number> = {
    complexity: report.analysis.findings.complexity.length,
    longFunctions: report.analysis.findings.longFunctions.length,
    deepNesting: report.analysis.findings.deepNesting.length,
    longParamLists: report.analysis.findings.longParamLists.length,
    magicNumbers: report.analysis.findings.magicNumbers.length,
    unusedExports: report.analysis.findings.unusedExports.length,
    todos: report.analysis.findings.todos.length,
    duplicates: report.analysis.findings.duplicates.length,
  };

  const categories: Record<string, CategoryRating> = {};
  let composite = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const count = counts[key] ?? 0;
    const density = count / kloc;
    const tier = densityToTier(density);
    const score = Math.max(0, Math.min(100, 100 - density * 10));
    categories[key] = { tier, density, count, weight, score };
    composite += density * weight;
  }

  return {
    overall: { tier: densityToTier(composite), compositeDensity: composite },
    categories,
  };
}

function densityToTier(density: number): string {
  let prevMax = 0;
  for (const bucket of BUCKETS) {
    if (density < bucket.max) {
      if (bucket.tiers.length === 1) return bucket.tiers[0]!;
      const span = bucket.max - prevMax;
      const ratio = span > 0 ? (density - prevMax) / span : 0;
      const idx = Math.min(bucket.tiers.length - 1, Math.max(0, Math.floor(ratio * bucket.tiers.length)));
      return bucket.tiers[idx]!;
    }
    prevMax = bucket.max;
  }
  return 'C';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function num(n: number): string {
  return n.toLocaleString('en-US');
}

function severity(tier: string): 's-good' | 's-watch' | 's-action' {
  return SEVERITY[tier] ?? 's-action';
}

function pillClass(tier: string): string {
  return PILL[tier] ?? 't-c';
}

function progressWidth(density: number): number {
  return Math.max(6, Math.min(95, density * 9));
}

function topFindings(findings: Finding[], n: number): Finding[] {
  return [...findings].sort((a, b) => b.value - a.value).slice(0, n);
}

function topDuplicates(dups: DuplicationFinding[], n: number): DuplicationFinding[] {
  return dups.slice(0, n);
}

function findingRow(label: string, value: string): string {
  return `<div class="offender"><span>${label}</span><span class="v">${value}</span></div>`;
}

function offendersFor(key: string, report: Report): string {
  const f = report.analysis.findings;
  const rows: string[] = [];
  if (key === 'duplicates') {
    for (const d of topDuplicates(f.duplicates, 3)) {
      const locs = d.occurrences
        .slice(0, 2)
        .map((o) => `<code>${escapeHtml(o.file)}:${o.startLine}</code>`)
        .join(' &harr; ');
      const span = d.occurrences[0] ? d.occurrences[0].endLine - d.occurrences[0].startLine + 1 : 0;
      rows.push(findingRow(locs, `${span} lines`));
    }
  } else {
    const list = (f as unknown as Record<string, Finding[]>)[key] ?? [];
    for (const offender of topFindings(list, 3)) {
      const sym = offender.symbol ? ` ${escapeHtml(offender.symbol)}` : '';
      rows.push(
        findingRow(
          `<code>${escapeHtml(offender.file)}:${offender.line}</code>${sym}`,
          offender.threshold > 0 ? `${offender.value} / ${offender.threshold}` : `${offender.value}`,
        ),
      );
    }
  }
  if (rows.length === 0) {
    rows.push(findingRow('No findings', '—'));
  }
  return rows.join('\n            ');
}

function categoryHeadline(def: CategoryDef, count: number): { big: string; sub: string } {
  if (count === 0) return { big: '0', sub: `unresolved ${def.unit}s` };
  return { big: num(count), sub: count === 1 ? `${def.unit}` : `${def.unit}s` };
}

function renderCategoryCard(def: CategoryDef, rating: CategoryRating, report: Report): string {
  const { tier, density, count } = rating;
  const sev = severity(tier);
  const pill = pillClass(tier);
  const width = progressWidth(density);
  const headline = categoryHeadline(def, count);
  return `
        <article class="cat-card" data-cat="${def.key}">
          <div class="header">
            <div>
              <p class="name">${escapeHtml(def.name)}</p>
              <div class="sub-label">${escapeHtml(def.sub)}</div>
            </div>
            <span class="pill ${pill}">${tier}</span>
          </div>
          <div class="headline">${headline.big}</div>
          <div class="headline-sub">${headline.sub}</div>
          <div class="progress ${sev}"><span style="width: ${width.toFixed(1)}%;"></span></div>
          <div class="toggle">Top offenders</div>
          <div class="detail">
            <div class="why">${escapeHtml(def.why)}</div>
            ${offendersFor(def.key, report)}
          </div>
        </article>`;
}

function renderTierGlossary(): string {
  return ALL_TIERS.map(
    (t) => `          <dt>${t}</dt><dd>${escapeHtml(TIER_DESCRIPTIONS[t]!)}</dd>`,
  ).join('\n');
}

function renderCategoryGlossary(): string {
  const extras = [
    { key: 'Threshold', def: 'Maximum acceptable value for a metric before a finding is raised.' },
    { key: 'KLOC', def: 'Thousand lines of code — used to normalise findings by codebase size.' },
  ];
  const rows = [
    ...CATEGORY_DEFS.map((d) => ({ key: d.glossaryKey, def: d.glossaryDef })),
    ...extras,
  ];
  return rows
    .map((r) => `          <dt>${r.key}</dt><dd>${escapeHtml(r.def)}</dd>`)
    .join('\n');
}

function renderMethodologyTable(rating: RatingResult): string {
  return CATEGORY_DEFS.map((def) => {
    const c = rating.categories[def.key]!;
    return `            <tr><td>${escapeHtml(def.name)}</td><td>${(c.weight * 100).toFixed(0)}%</td><td>${c.score.toFixed(0)}</td><td>${c.tier}</td></tr>`;
  }).join('\n');
}

function chartData(rating: RatingResult): { donutLabels: string[]; donutValues: number[]; donutColors: string[]; radarLabels: string[]; radarScores: number[] } {
  const colorByTier: Record<string, string> = {
    'Aaa': '#4ec9a8', 'Aa1': '#5dc6a8', 'Aa2': '#6cc1a4', 'Aa3': '#7fbf9d',
    'A1': '#6cb6d6', 'A2': '#7eb6d2', 'A3': '#8db8c9',
    'Baa1': '#d6b04a', 'Baa2': '#dba84a', 'Baa3': '#e0a93b',
    'Ba1': '#e36a55', 'Ba2': '#dd5e4d', 'Ba3': '#d65548',
  };
  const ordered = CATEGORY_DEFS.map((def) => ({
    label: def.glossaryKey,
    value: rating.categories[def.key]!.count,
    color: colorByTier[rating.categories[def.key]!.tier] ?? '#a3915b',
    score: rating.categories[def.key]!.score,
    name: def.name,
  }));
  const donut = [...ordered].sort((a, b) => b.value - a.value);
  return {
    donutLabels: donut.map((o) => o.label),
    donutValues: donut.map((o) => o.value),
    donutColors: donut.map((o) => o.color),
    radarLabels: ordered.map((o) => o.label),
    radarScores: ordered.map((o) => o.score),
  };
}

function renderHero(report: Report, tier: string): string {
  const verdict = TIER_DESCRIPTIONS[tier] ?? '';
  return `        <section class="hero">
          <div class="badge ${pillClass(tier)}" aria-label="Overall rating ${tier}">
            <div class="tier-text">${tier}</div>
            <div class="tier-sub">${tierBandLabel(tier)}</div>
          </div>
          <div>
            <h1>cscan — Code Quality Rating</h1>
            <p class="verdict">${escapeHtml(verdict)}</p>
            <p class="target">Scope: <code>${escapeHtml(report.meta.target)}</code></p>
          </div>
          <div class="top-numbers">
            <div><div class="k">Files</div><div class="v">${num(report.summary.totalFiles)}</div></div>
            <div><div class="k">Lines</div><div class="v">${num(report.summary.totalLines)}</div></div>
            <div><div class="k">Functions</div><div class="v">${num(report.analysis.aggregates.totalFunctions)}</div></div>
            <div><div class="k">Findings</div><div class="v">${num(report.analysis.violations.total)}</div></div>
          </div>
        </section>`;
}

function renderChartSection(report: Report): string {
  return `        <section class="chart-card donut">
          <h3>Findings by Category</h3>
          <p class="sub">Where the ${num(report.analysis.violations.total)} raised findings are concentrated</p>
          <div class="chart-wrap"><canvas id="donut"></canvas></div>
        </section>

        <section class="chart-card radar">
          <h3>Category Health Profile</h3>
          <p class="sub">Higher = healthier · 0–100 sub-score per dimension</p>
          <div class="chart-wrap"><canvas id="radar"></canvas></div>
        </section>`;
}

function renderPanels(rating: RatingResult): string {
  return `    <aside class="panel" id="panel-glossary" aria-hidden="true">
      <header>
        <h2>Glossary</h2>
        <button data-close aria-label="Close glossary">×</button>
      </header>
      <div class="body">
        <h3>Rating tiers</h3>
        <dl>
${renderTierGlossary()}
        </dl>
        <h3>Analysis categories</h3>
        <dl>
${renderCategoryGlossary()}
        </dl>
      </div>
    </aside>

    <aside class="panel" id="panel-methodology" aria-hidden="true">
      <header>
        <h2>Methodology</h2>
        <button data-close aria-label="Close methodology">×</button>
      </header>
      <div class="body">
        <p>The overall rating is a weighted composite of eight code-health categories. Each category's findings are normalised to thousand lines of code (KLOC) so larger codebases are not penalised relative to smaller ones, then bucketed into Moody's tiers.</p>
        <h3>Weights &amp; sub-ratings</h3>
        <table>
          <thead><tr><th>Category</th><th>Weight</th><th>Score</th><th>Tier</th></tr></thead>
          <tbody>
${renderMethodologyTable(rating)}
          </tbody>
        </table>
        <h3>Composite</h3>
        <p>Composite density: <b>${rating.overall.compositeDensity.toFixed(2)}</b> · overall tier: <b>${rating.overall.tier}</b>.</p>
        <p>Density-to-tier mapping: &lt;0.25 Aaa · 0.25–1.0 Aa · 1.0–2.5 A · 2.5–4.0 Baa · 4.0–6.25 Ba · 6.25–8.5 B · 8.5–11.5 Caa · 11.5–13 Ca · &ge;13 C. Investment grade covers Aaa through Baa3; speculative grade is Ba1 and below.</p>
      </div>
    </aside>`;
}

function renderInlineScript(chart: ReturnType<typeof chartData>): string {
  return `    <script>
      const donutLabels = ${JSON.stringify(chart.donutLabels)};
      const donutValues = ${JSON.stringify(chart.donutValues)};
      const donutColors = ${JSON.stringify(chart.donutColors)};
      const radarLabels = ${JSON.stringify(chart.radarLabels)};
      const radarScores = ${JSON.stringify(chart.radarScores)};

      const accent = "#d6b04a";
      const text = "#e8ecf6";
      const muted = "#8893b3";
      Chart.defaults.color = muted;
      Chart.defaults.font.family = "Inter, system-ui, sans-serif";

      new Chart(document.getElementById("donut"), {
        type: "doughnut",
        data: { labels: donutLabels, datasets: [{ data: donutValues, backgroundColor: donutColors, borderColor: "#1c2645", borderWidth: 2, hoverOffset: 8 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "62%",
          plugins: {
            legend: { position: "right", labels: { color: text, boxWidth: 10, padding: 10, font: { size: 12 } } },
            tooltip: { backgroundColor: "#0e1424", borderColor: "#2a365e", borderWidth: 1, callbacks: { label: (ctx) => ctx.label + ": " + ctx.parsed + " finding" + (ctx.parsed === 1 ? "" : "s") } },
          },
        },
      });

      new Chart(document.getElementById("radar"), {
        type: "radar",
        data: { labels: radarLabels, datasets: [{ label: "Health score", data: radarScores, fill: true, backgroundColor: "rgba(214, 176, 74, 0.18)", borderColor: accent, borderWidth: 2, pointBackgroundColor: accent, pointBorderColor: "#0e1424", pointRadius: 4, pointHoverRadius: 6 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0e1424", borderColor: "#2a365e", borderWidth: 1, callbacks: { label: (ctx) => ctx.label + ": " + ctx.parsed.r + " / 100" } } },
          scales: { r: { suggestedMin: 0, suggestedMax: 100, ticks: { color: muted, backdropColor: "transparent", stepSize: 25 }, grid: { color: "rgba(255,255,255,0.08)" }, angleLines: { color: "rgba(255,255,255,0.08)" }, pointLabels: { color: text, font: { size: 12 } } } },
        },
      });

      document.querySelectorAll(".cat-card").forEach((card) => {
        card.addEventListener("click", () => card.classList.toggle("expanded"));
      });

      const backdrop = document.getElementById("backdrop");
      const panels = { glossary: document.getElementById("panel-glossary"), methodology: document.getElementById("panel-methodology") };
      function openPanel(name) {
        Object.values(panels).forEach((p) => { p.classList.remove("open"); p.setAttribute("aria-hidden", "true"); });
        const t = panels[name]; if (!t) return;
        t.classList.add("open"); t.setAttribute("aria-hidden", "false"); backdrop.classList.add("open");
      }
      function closePanels() {
        Object.values(panels).forEach((p) => { p.classList.remove("open"); p.setAttribute("aria-hidden", "true"); });
        backdrop.classList.remove("open");
      }
      document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openPanel(b.dataset.open)));
      document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closePanels));
      backdrop.addEventListener("click", closePanels);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanels(); });
    </script>`;
}

export function renderHtml(report: Report): string {
  const rating = computeRating(report);
  const cards = CATEGORY_DEFS.map((def) =>
    renderCategoryCard(def, rating.categories[def.key]!, report),
  ).join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>cscan — Code Quality Scorecard · ${rating.overall.tier}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <style>
${STYLES}
    </style>
  </head>
  <body>
    <div class="top">
      <div class="brand">cscan · code-quality scorecard</div>
      <div class="actions">
        <button class="icon-btn" data-open="methodology">Methodology</button>
        <button class="icon-btn" data-open="glossary">Glossary</button>
      </div>
    </div>
    <div class="container">
      <div class="grid">
${renderHero(report, rating.overall.tier)}
${renderChartSection(report)}
        <h2 class="cards-title">Sub-ratings · click any card to drill in</h2>
${cards}
      </div>
    </div>
    <footer class="bottom">
      <div>cscan v${escapeHtml(report.meta.scannerVersion)} · scanned ${escapeHtml(report.meta.scannedAt.slice(0, 10))} · ${report.meta.durationMs} ms</div>
      <div>Internal evaluation only · not investment advice</div>
    </footer>
    <div class="panel-backdrop" id="backdrop"></div>
${renderPanels(rating)}
${renderInlineScript(chartData(rating))}
  </body>
</html>`;
}

function tierBandLabel(tier: string): string {
  if (tier === 'Aaa') return 'Exemplary';
  if (tier.startsWith('Aa')) return 'High quality';
  if (/^A[123]$/.test(tier)) return 'Upper-medium grade';
  if (tier.startsWith('Baa')) return 'Medium grade';
  if (tier.startsWith('Ba')) return 'Speculative grade';
  if (/^B[123]$/.test(tier)) return 'High risk';
  if (tier.startsWith('Caa')) return 'Poor standing';
  if (tier === 'Ca') return 'Severe';
  return 'Critical';
}

export async function writeHtmlReport(report: Report, outPath: string): Promise<void> {
  await writeFile(outPath, renderHtml(report), 'utf8');
}

const STYLES = `      :root {
        --bg: #0e1424;
        --bg-2: #161e36;
        --card: #1c2645;
        --card-2: #1f2a4d;
        --line: #2a365e;
        --text: #e8ecf6;
        --muted: #8893b3;
        --accent: #d6b04a;
        --accent-2: #f0cc6e;
        --good: #4ec9a8;
        --watch: #e0a93b;
        --action: #e36a55;
        --aaa: #4ec9a8;
        --a: #6cb6d6;
        --baa: #d6b04a;
        --ba: #e36a55;
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0; padding: 0;
        background: radial-gradient(circle at 20% 10%, #1a2444 0%, var(--bg) 60%);
        background-attachment: fixed; color: var(--text);
        font-family: "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        font-size: 15px; line-height: 1.55; min-height: 100vh;
      }
      body { -webkit-font-smoothing: antialiased; }
      .top { max-width: 1320px; margin: 0 auto; padding: 28px 32px 0; display: flex; align-items: center; justify-content: space-between; }
      .top .brand { font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
      .top .actions { display: flex; gap: 10px; }
      .icon-btn { background: var(--card); border: 1px solid var(--line); color: var(--text); padding: 8px 14px; border-radius: 8px; font-size: 12px; font-family: inherit; cursor: pointer; letter-spacing: 0.04em; transition: background 0.15s, border-color 0.15s; }
      .icon-btn:hover { background: var(--card-2); border-color: var(--accent); }
      .container { max-width: 1320px; margin: 0 auto; padding: 24px 32px 64px; }
      .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 18px; }
      .hero { grid-column: span 12; background: linear-gradient(135deg, rgba(214, 176, 74, 0.08), rgba(255,255,255,0.0) 70%), var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 32px 36px; display: grid; grid-template-columns: 200px 1fr auto; gap: 32px; align-items: center; }
      .hero .badge { width: 168px; height: 168px; border-radius: 50%; background: conic-gradient(from 220deg, var(--baa) 0%, var(--accent-2) 70%, var(--baa) 100%), var(--card-2); display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; box-shadow: 0 16px 50px rgba(0,0,0,0.45); }
      .hero .badge.t-aaa { background: conic-gradient(from 220deg, var(--aaa) 0%, #6cd6b8 70%, var(--aaa) 100%); }
      .hero .badge.t-a { background: conic-gradient(from 220deg, var(--a) 0%, #8acce8 70%, var(--a) 100%); }
      .hero .badge.t-ba { background: conic-gradient(from 220deg, var(--ba) 0%, #f08070 70%, var(--ba) 100%); }
      .hero .badge.t-c { background: conic-gradient(from 220deg, #c14a3a 0%, #e07060 70%, #c14a3a 100%); }
      .hero .badge::before { content: ""; position: absolute; inset: 8px; border-radius: 50%; background: var(--bg-2); }
      .hero .badge .tier-text { position: relative; font-size: 56px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; color: var(--accent-2); }
      .hero .badge.t-aaa .tier-text { color: #6cd6b8; }
      .hero .badge.t-a .tier-text { color: #8acce8; }
      .hero .badge.t-ba .tier-text, .hero .badge.t-c .tier-text { color: #f08070; }
      .hero .badge .tier-sub { position: relative; font-size: 10px; text-transform: uppercase; letter-spacing: 0.22em; color: var(--muted); margin-top: 8px; }
      .hero h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -0.01em; }
      .hero .verdict { color: var(--muted); margin: 0 0 8px; font-size: 16px; max-width: 540px; }
      .hero .target { color: var(--muted); margin: 0; font-size: 12px; }
      .hero .target code { color: var(--accent-2); font-family: "JetBrains Mono", "Fira Code", Menlo, monospace; font-size: 11px; }
      .hero .top-numbers { display: grid; grid-template-columns: repeat(2, auto); gap: 10px 28px; font-size: 13px; align-self: center; }
      .hero .top-numbers .v { font-size: 22px; font-weight: 600; color: var(--text); letter-spacing: -0.01em; }
      .hero .top-numbers .k { color: var(--muted); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 2px; }
      .chart-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 22px 24px; display: flex; flex-direction: column; }
      .chart-card.donut { grid-column: span 5; }
      .chart-card.radar { grid-column: span 7; }
      .chart-card h3 { margin: 0 0 4px; font-size: 16px; }
      .chart-card .sub { margin: 0 0 16px; font-size: 12px; color: var(--muted); letter-spacing: 0.04em; }
      .chart-wrap { flex: 1; position: relative; min-height: 260px; }
      .cards-title { grid-column: span 12; margin: 14px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--muted); }
      .cat-card { grid-column: span 3; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; cursor: pointer; transition: transform 0.15s, border-color 0.15s, background 0.15s; position: relative; }
      .cat-card:hover { transform: translateY(-2px); border-color: var(--accent); background: var(--card-2); }
      .cat-card .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
      .cat-card .name { font-size: 14px; font-weight: 600; margin: 0; }
      .cat-card .sub-label { font-size: 11px; color: var(--muted); letter-spacing: 0.04em; margin-top: 2px; }
      .pill { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; letter-spacing: 0.06em; line-height: 1.3; }
      .pill.t-aaa { background: rgba(78, 201, 168, 0.15); color: var(--aaa); }
      .pill.t-a { background: rgba(108, 182, 214, 0.15); color: var(--a); }
      .pill.t-baa { background: rgba(214, 176, 74, 0.18); color: var(--baa); }
      .pill.t-ba { background: rgba(227, 106, 85, 0.18); color: var(--ba); }
      .pill.t-c { background: rgba(193, 74, 58, 0.22); color: #f08070; }
      .cat-card .headline { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin: 4px 0 4px; }
      .cat-card .headline-sub { font-size: 12px; color: var(--muted); margin-bottom: 14px; }
      .cat-card .progress { height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; margin-bottom: 10px; }
      .cat-card .progress > span { display: block; height: 100%; border-radius: 999px; }
      .cat-card .progress.s-good > span { background: var(--good); }
      .cat-card .progress.s-watch > span { background: var(--watch); }
      .cat-card .progress.s-action > span { background: var(--action); }
      .cat-card .toggle { font-size: 11px; color: var(--accent); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }
      .cat-card .detail { margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--line); font-size: 13px; color: var(--text); display: none; }
      .cat-card.expanded .detail { display: block; }
      .cat-card.expanded .toggle::after { content: " — close"; }
      .cat-card .detail .why { color: var(--muted); margin-bottom: 10px; font-size: 12px; }
      .cat-card .detail .offender { font-family: "JetBrains Mono", "Fira Code", Menlo, monospace; font-size: 11px; color: var(--accent-2); padding: 4px 0; border-bottom: 1px dotted var(--line); display: flex; justify-content: space-between; gap: 10px; }
      .cat-card .detail .offender:last-child { border-bottom: 0; }
      .cat-card .detail .offender .v { color: var(--muted); }
      footer.bottom { max-width: 1320px; margin: 32px auto 0; padding: 0 32px 32px; font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; letter-spacing: 0.06em; }
      .panel-backdrop { position: fixed; inset: 0; background: rgba(8, 12, 24, 0.65); backdrop-filter: blur(2px); opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 40; }
      .panel-backdrop.open { opacity: 1; pointer-events: auto; }
      .panel { position: fixed; top: 0; right: 0; height: 100vh; width: min(560px, 92vw); background: var(--bg-2); border-left: 1px solid var(--line); box-shadow: -16px 0 40px rgba(0,0,0,0.4); transform: translateX(100%); transition: transform 0.25s ease-out; z-index: 50; display: flex; flex-direction: column; }
      .panel.open { transform: translateX(0); }
      .panel header { padding: 22px 28px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; }
      .panel header h2 { margin: 0; font-size: 18px; }
      .panel header button { background: transparent; border: 1px solid var(--line); color: var(--text); font-family: inherit; font-size: 18px; cursor: pointer; padding: 4px 12px; border-radius: 6px; line-height: 1; }
      .panel header button:hover { border-color: var(--accent); }
      .panel .body { padding: 22px 28px; overflow-y: auto; flex: 1; font-size: 14px; }
      .panel .body h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); margin: 22px 0 10px; }
      .panel .body h3:first-child { margin-top: 0; }
      .panel .body dl { display: grid; grid-template-columns: 100px 1fr; gap: 6px 14px; margin: 0; }
      .panel .body dt { font-weight: 600; color: var(--accent-2); }
      .panel .body dd { margin: 0; color: var(--text); font-size: 13px; }
      .panel .body p { margin: 0 0 12px; color: var(--text); }
      .panel .body table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
      .panel .body th, .panel .body td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--line); }
      .panel .body th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
      @media (max-width: 980px) {
        .hero { grid-template-columns: 1fr; gap: 16px; text-align: center; }
        .hero .badge { margin: 0 auto; }
        .hero .top-numbers { grid-template-columns: repeat(4, auto); justify-content: center; }
        .chart-card.donut, .chart-card.radar { grid-column: span 12; }
        .cat-card { grid-column: span 6; }
      }
      @media (max-width: 640px) {
        .grid { gap: 14px; }
        .container { padding: 16px 18px 48px; }
        .hero .top-numbers { grid-template-columns: repeat(2, auto); }
        .cat-card { grid-column: span 12; }
      }`;
