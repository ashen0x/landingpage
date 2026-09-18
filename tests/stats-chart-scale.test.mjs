import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { formatCompactNumber } from "../lib/number-format.ts";

const require = createRequire(import.meta.url);
const { Chart, registerables } = require("chart.js");
Chart.register(...registerables);
const source = readFileSync(new URL("../components/stats/top-models-usage-chart.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("chart.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
(function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node);
  ts.forEachChild(node, visit);
})(file);
const helpers = file.statements.filter((node) => ts.isFunctionDeclaration(node) && ["convertRevenueMsats", "bucketCoverage"].includes(node.name?.text));
const code = ts.transpileModule(helpers.map((node) => node.getText(file)).join("\n") + "\n" +
  ["formatValue", "stackTotals", "chartData", "hasPositiveValues", "chartOptions"].map((name) => `const ${declarations.get(name).getText(file)};`).join("\n") +
  "\nexports.result = { chartData, chartOptions };", { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

// Renders the component's own data and options with real Chart.js geometry.
function renderChart(scale, series, coverage = [], options = {}) {
  const context = {
    exports: {}, scale, mode: "requests", revenueDisplayUnit: "sat", revenueUnitLabel: "sats", usdPerSat: null,
    mix: { interval_minutes: 1440 }, mixMetrics: series[0].map((_, i) => ({ timestamp: `2026-09-${String(i + 1).padStart(2, "0")}`, coverage: coverage[i] ?? "complete" })),
    plotSeries: series.map((values, i) => ({ key: `model:${i}`, color: "#123456", values })),
    useMemo: (callback) => callback(), useCallback: (callback) => callback, formatCompactNumber,
    isMobile: false, hasMultipleDays: true, formatAxisTimestamp: (stamp) => stamp,
    chartTheme: { grid: "#ccc", mutedForeground: "#666", foreground: "#000", fontFamily: "monospace" },
    ...options,
  };
  vm.runInNewContext(code, context);
  const { chartData, chartOptions } = context.exports.result;
  const canvas = { width: context.isMobile ? 300 : 640, height: context.isMobile ? 250 : 320, getContext: () => drawing };
  const drawing = new Proxy({ canvas, measureText: (text) => ({ width: String(text).length * 6 }), getLineDash: () => [] },
    { get: (target, key) => (key in target ? target[key] : () => {}) });
  const chart = new Chart(canvas, { type: "bar", data: chartData, options: { ...chartOptions, responsive: false, plugins: { legend: false, tooltip: false } } });
  const heights = chart.data.datasets.map((_, i) => chart.getDatasetMeta(i).data.map((bar) => bar.height || 0));
  const ticks = chart.scales.y.ticks.map((tick) => ({ label: tick.label, pixel: chart.scales.y.getPixelForValue(tick.value) }));
  chart.destroy();
  return { heights, ticks };
}

function bars(...args) {
  return renderChart(...args).heights;
}

test("Linear stacks models in proportion to their values", () => {
  const [a, b, c] = bars("linear", [[1000], [1000], [1000]]);
  assert.ok(Math.abs(a[0] - b[0]) < 1 && Math.abs(b[0] - c[0]) < 1);
});

test("Log draws one total per day from a shared baseline, whatever the model order", () => {
  const ordered = bars("logarithmic", [[900, 10], [90, 90], [10, 900]]);
  assert.equal(ordered.length, 1);
  assert.ok(Math.abs(ordered[0][0] - ordered[0][1]) < 1);
  const [growth] = bars("logarithmic", [[10, 1000], [0, 2000]]);
  assert.ok(growth[0] > 0 && growth[1] > growth[0]);
});

test("Log keeps a reported zero and a missing day without height", () => {
  const [heights] = bars("logarithmic", [[0, 5, 7], [0, 5, 3]], ["complete", "missing", "complete"]);
  assert.deepEqual(heights.slice(0, 2), [0, 0]);
  assert.ok(heights[2] > 0);
});

// These bounds come from the captured legacy daily and weekly revenue reports.
for (const [interval, values, upperLabel] of [
  ["daily", [15, 384595571], "100K sats"],
  ["weekly", [23894, 1325335802], "1M sats"],
]) {
  for (const isMobile of [false, true]) {
    test(`Log labels the upper revenue decade for ${interval} reports on ${isMobile ? "mobile" : "desktop"}`, () => {
      const { ticks } = renderChart("logarithmic", [values], [], { mode: "revenue", isMobile });
      const labels = ticks.filter((tick) => tick.label);
      assert.ok(labels.some((tick) => tick.label === "100K sats"));
      assert.ok(labels.some((tick) => tick.label === upperLabel));
      for (let i = 1; i < labels.length; i++) {
        assert.ok(Math.abs(labels[i].pixel - labels[i - 1].pixel) >= 16, "axis labels must remain readable");
      }
    });
  }
}

test("Weekly tooltip dates respect the exclusive end and clipped edge weeks", () => {
  const dateHelpers = file.statements.filter((node) => ts.isFunctionDeclaration(node) && ["parseBucketDate", "formatBucketTimestamp"].includes(node.name?.text));
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(dateHelpers.map((node) => node.getText(file)).join("\n") + "\nexports.format = formatBucketTimestamp;", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  const label = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  assert.equal(context.exports.format("2026-09-10", 10080, "2026-09-17"), `${label("2026-09-10")} to ${label("2026-09-16")} UTC`);
  assert.equal(context.exports.format("2026-09-17", 10080, "2026-09-18"), `${label("2026-09-17")} UTC`);
  assert.equal(context.exports.format("2026-09-14", 10080, "2026-09-17"), `${label("2026-09-14")} to ${label("2026-09-16")} UTC`);
});
