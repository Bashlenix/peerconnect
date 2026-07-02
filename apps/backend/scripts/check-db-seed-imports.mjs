#!/usr/bin/env node
/**
 * Guard: the seed scripts executed inside the docker/db image must not import
 * from apps/backend/src (except the build-time generated Prisma client).
 *
 * Why: docker/db/Dockerfile only copies `prisma/`, `packages/shared/`, the
 * Prisma config and tsconfig into the builder — it never copies
 * `apps/backend/src/`. It then builds `@peerconnect/shared` and runs
 * `prisma generate` (which creates `src/generated/`). Anything a seed script
 * pulls in from `src/` at runtime therefore only resolves if it lives under
 * `src/generated/`. A stray `import ... from "../src/modules/..."` compiles and
 * runs locally but breaks the image build with ERR_MODULE_NOT_FOUND.
 *
 * This check starts from the seed entrypoints actually invoked by
 * docker/db/seed.sh, follows their relative imports transitively (staying
 * inside `prisma/`), and fails if any reachable file imports from `src/`
 * outside of `src/generated/`.
 *
 * Manual/ops scripts that are NOT run by the image (e.g. prisma/backfill-*.ts)
 * are intentionally out of scope — they run in a full backend environment and
 * may legitimately use src/modules.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(scriptDir, "..");
const repoRoot = resolve(backendDir, "..", "..");
const prismaDir = resolve(backendDir, "prisma");
const srcDir = resolve(backendDir, "src");
const generatedDir = resolve(srcDir, "generated");
const seedShPath = resolve(repoRoot, "docker/db/seed.sh");

function fail(msg) {
  console.error(`\n\u001b[31m✖ db-seed-imports check failed\u001b[0m\n${msg}\n`);
  process.exit(1);
}

if (!existsSync(seedShPath)) {
  fail(`Could not find ${relative(repoRoot, seedShPath)} — cannot determine which seed scripts the DB image runs.`);
}

// Entrypoints = every `prisma/<file>.ts` the image's seed.sh executes via tsx.
const seedSh = readFileSync(seedShPath, "utf8");
const entrypoints = [...seedSh.matchAll(/\bprisma\/([\w./-]+\.ts)\b/g)].map((m) =>
  resolve(backendDir, "prisma", m[1]),
);

if (entrypoints.length === 0) {
  fail(`No 'prisma/*.ts' seed entrypoints found in ${relative(repoRoot, seedShPath)}.`);
}

const importSpecifiers = (code) => {
  const specs = [];
  const patterns = [
    /(?:^|\n)\s*(?:import|export)\b[^\n]*?\bfrom\s*['"]([^'"]+)['"]/g, // import/export ... from "x"
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g, // bare import "x"
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import("x")
  ];
  for (const re of patterns) {
    for (const m of code.matchAll(re)) specs.push(m[1]);
  }
  return specs;
};

const isInside = (parent, child) => {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && !/^[a-zA-Z]:/.test(rel));
};

const violations = [];
const visited = new Set();
const queue = [...entrypoints];

while (queue.length > 0) {
  const file = queue.shift();
  if (visited.has(file)) continue;
  visited.add(file);
  if (!existsSync(file)) continue;

  const code = readFileSync(file, "utf8");
  for (const spec of importSpecifiers(code)) {
    if (!spec.startsWith(".")) continue; // bare packages (@peerconnect/shared, node, npm) are fine
    const resolved = resolve(dirname(file), spec);

    if (isInside(srcDir, resolved) && !isInside(generatedDir, resolved)) {
      violations.push({ file, spec });
      continue;
    }

    // Follow relative imports that stay inside prisma/ so transitive
    // seed helpers (e.g. seed.ts -> ./seed-data.js) are checked too.
    const tsCandidate = resolved.replace(/\.js$/, ".ts");
    if (isInside(prismaDir, tsCandidate) && existsSync(tsCandidate)) {
      queue.push(tsCandidate);
    }
  }
}

if (violations.length > 0) {
  const lines = violations
    .map((v) => `  ${relative(repoRoot, v.file)}\n    imports "${v.spec}"`)
    .join("\n");
  fail(
    `Seed scripts run by docker/db/seed.sh must not import from apps/backend/src\n` +
      `(except the build-time src/generated Prisma client). Offending imports:\n\n${lines}\n\n` +
      `Fix: move the needed values into packages/shared (copied + built into the\n` +
      `DB image) and import them from "@peerconnect/shared", or inline the data\n` +
      `under prisma/. See docker/db/Dockerfile for what the image actually copies.`,
  );
}

console.log(
  `✓ db-seed-imports: ${visited.size} seed file(s) reachable from docker/db/seed.sh — none import from src/ outside src/generated.`,
);
