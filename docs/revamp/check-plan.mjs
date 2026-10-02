// Read-only consistency check: node docs/revamp/check-plan.mjs
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(root, name), "utf8");
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const guide = read("13-implementation-guide.md");
const ledger = read("14-acceptance-and-integration.md");
const spec = read("12-feature-specification.md");
const tasks = new Map();
for (const line of guide.split("\n")) {
  if (!/^\| T\d+\.\d+ \|/.test(line)) continue;
  const cells = line.split("|").map((cell) => cell.trim());
  const id = cells[1];
  const dependencies = cells[4];
  check(!tasks.has(id), `Duplicate task ${id}`);
  check(
    /^(—|T\d+\.\d+(, T\d+\.\d+)*)$/.test(dependencies),
    `${id}: non-explicit dependency cell: ${dependencies}`,
  );
  tasks.set(id, dependencies.match(/T\d+\.\d+/g) ?? []);
}

const visited = new Set();
const visiting = new Set();
const visit = (id, path = []) => {
  if (visited.has(id)) return;
  if (visiting.has(id)) {
    failures.push(`Task cycle: ${[...path, id].join(" -> ")}`);
    return;
  }
  if (!tasks.has(id)) {
    failures.push(`Unknown dependency: ${id}`);
    return;
  }
  visiting.add(id);
  for (const dependency of tasks.get(id)) visit(dependency, [...path, id]);
  visiting.delete(id);
  visited.add(id);
};
for (const id of tasks.keys()) visit(id);
const releaseAncestors = new Set();
const collect = (id) => {
  if (releaseAncestors.has(id) || !tasks.has(id)) return;
  releaseAncestors.add(id);
  for (const dependency of tasks.get(id)) collect(dependency);
};
collect("T7.7");
for (const id of tasks.keys()) check(releaseAncestors.has(id), `${id} is orphaned from final acceptance`);

const features = new Map();
for (const match of spec.matchAll(/^## (F\d{2}) —[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)) {
  const ac = match[2].split("**AC.**")[1];
  check(Boolean(ac), `${match[1]} has no AC block`);
  if (!ac) continue;
  const numbered = [...ac.matchAll(/^(\d+)\. /gm)].map((item) => Number(item[1]));
  const count = numbered.length || 1;
  check(numbered.every((value, i) => value === i + 1), `${match[1]} AC numbering gap`);
  features.set(match[1], count);
}
check(features.size === 40, `Expected 40 features, found ${features.size}`);
let total = 0;
for (const [id, count] of features) {
  total += count;
  const rows = ledger.split("\n").filter((line) => line.startsWith(`| ${id} |`));
  check(rows.length === 1, `${id}: expected one acceptance ledger row`);
  const row = rows[0] ?? "";
  const covered = new Set();
  for (const match of row.matchAll(/AC-(F\d{2})\.(\d+)(?:–(\d+))?/g)) {
    check(match[1] === id, `${id}: mismatched AC label ${match[1]}`);
    const end = Number(match[3] ?? match[2]);
    for (let i = Number(match[2]); i <= end; i++) covered.add(i);
  }
  check(covered.size === count, `${id}: ledger count ${covered.size}, spec count ${count}`);
  for (let i = 1; i <= count; i++) check(covered.has(i), `Missing AC-${id}.${i}`);
  check(/T\d+\.\d+/.test(row), `${id}: no task owner`);
}

const markdownFiles = readdirSync(root).filter((name) => name.endsWith(".md"));
for (const file of markdownFiles) {
  const content = read(file);
  // Full task IDs only; historical prose shorthand/ranges still resolve their named endpoints.
  for (const match of content.matchAll(/\bT\d+\.\d+\b/g)) {
    check(tasks.has(match[0]), `${file}: unknown task ${match[0]}`);
  }
  for (const match of content.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
    check(existsSync(resolve(root, decodeURIComponent(target))), `${file}: missing link ${target}`);
  }
}
const requirements = new Set(
  [...read("11-review-and-traceability.md").matchAll(/^\| R(\d+) \|/gm)].map((m) => Number(m[1])),
);
for (let i = 1; i <= 38; i++) check(requirements.has(i), `Missing wishlist requirement R${i}`);

if (failures.length) {
  for (const failure of new Set(failures)) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`${tasks.size} tasks: explicit dependencies, no cycles or unknown references.`);
  console.log(`40 features / ${total} ACs mapped; R1–R38 retained; local Markdown file links resolve.`);
  console.log("Structural validation only: this does not certify design correctness or product acceptance.");
}
