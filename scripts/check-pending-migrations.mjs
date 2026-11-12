import { readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const highRiskPatterns = [
  /\bDROP\s+(?:TABLE|SCHEMA|COLUMN|TYPE|DOMAIN|DATABASE|POLICY|FUNCTION|TRIGGER)\b/i,
  /\bTRUNCATE(?:\s+TABLE)?\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+TABLE\b[^;]*\bDROP\s+(?:CONSTRAINT|COLUMN)\b/is,
  /\bALTER\s+TABLE\b[^;]*\b(?:DISABLE\s+ROW\s+LEVEL\s+SECURITY|NO\s+FORCE\s+ROW\s+LEVEL\s+SECURITY)\b/is,
];

function readMigrationRows(payload) {
  const rows = payload?.migrations ?? payload?.data?.migrations;
  if (!Array.isArray(rows)) {
    throw new Error("Supabase migration-list output did not contain a migrations array.");
  }
  return rows.map((row) => {
    if (typeof row?.local !== "string" || typeof row?.remote !== "string") {
      throw new Error("Supabase migration-list output contained an invalid migration row.");
    }
    return { local: row.local.trim(), remote: row.remote.trim() };
  });
}

function migrationFile(version, migrationsDirectory) {
  const matches = readdirSync(migrationsDirectory)
    .filter((name) => name.startsWith(`${version}_`) && name.endsWith(".sql"));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one local SQL file for remote migration version ${version}; found ${matches.length}.`);
  }
  return join(migrationsDirectory, matches[0]);
}

export function inspectPendingMigrations(payload, migrationsDirectory) {
  const rows = readMigrationRows(payload);
  const remoteOnly = rows.filter(({ local, remote }) => !local && remote);
  if (remoteOnly.length) {
    throw new Error(`Remote migrations are missing locally: ${remoteOnly.map(({ remote }) => remote).join(", ")}. Reconcile migration history before deployment.`);
  }

  const pending = rows.filter(({ local, remote }) => local && !remote);
  const highRisk = [];
  for (const migration of pending) {
    const file = migrationFile(migration.local, migrationsDirectory);
    const sql = readFileSync(file, "utf8");
    if (highRiskPatterns.some((pattern) => pattern.test(sql))) {
      highRisk.push({ version: migration.local, file: basename(file) });
    }
  }
  return { pending, highRisk };
}

function main() {
  const [reportPath, ...flags] = process.argv.slice(2);
  if (!reportPath) {
    throw new Error("Usage: node scripts/check-pending-migrations.mjs <migration-list.json> [--require-clean] [--approve-high-risk-migrations]");
  }
  const payload = JSON.parse(readFileSync(reportPath, "utf8"));
  const { pending, highRisk } = inspectPendingMigrations(payload, join(process.cwd(), "supabase/migrations"));
  const requireClean = flags.includes("--require-clean");
  const approved = flags.includes("--approve-high-risk-migrations");

  console.log(`Pending migrations: ${pending.length}`);
  for (const migration of pending) console.log(`  ${migration.local}`);
  for (const migration of highRisk) console.log(`High-risk migration: ${migration.file}`);

  if (requireClean && pending.length) {
    throw new Error("Remote migration verification failed: local migrations remain unapplied.");
  }
  if (highRisk.length && !approved) {
    throw new Error("Automatic deployment is blocked for high-risk migrations. Obtain an independent review, configure required reviewers for the supabase-high-risk-migrations environment, then run this workflow manually with the approval input.");
  }
  if (highRisk.length && approved) {
    console.log("High-risk migrations were explicitly approved by the protected manual deployment path.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
