import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PROJECT_ID = "jzchlrvxdaffnrgbvabv";
const REQUIRED_MIGRATIONS = ["20261104000200", "20261106233237"];
const ALLOWED_PENDING_MIGRATIONS = new Set([
  "20261112180000",
  "20261112180100",
  "20261112190000",
  "20261112200000",
]);
const REQUIRED_FUNCTIONS = ["marketplace", "youtube-connection"];
const REQUIRED_SECRETS = [
  "MV_CREDENTIAL_ENCRYPTION_KEY",
  "MV_SYNC_JOB_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
];

function migrationRows(payload) {
  const rows = payload?.migrations ?? payload?.data?.migrations;
  if (!Array.isArray(rows)) {
    throw new Error("Remote migration history did not contain a migrations array.");
  }
  return rows.map((row) => {
    if (typeof row?.local !== "string" || typeof row?.remote !== "string") {
      throw new Error("Remote migration history contained an invalid row.");
    }
    return { local: row.local.trim(), remote: row.remote.trim() };
  });
}

function rowsFrom(payload, label, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new Error(`Supabase ${label} response had an unsupported format.`);
}

function schemaContractIsCompatible(payload) {
  const results = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Object.hasOwn(value, "compatible")) results.push(value.compatible);
    for (const [key, child] of Object.entries(value)) {
      if (key !== "compatible") visit(child);
    }
  };
  visit(payload);
  return results.length === 1 && results[0] === true;
}

async function managementGet(path, accessToken, fetchImpl) {
  const response = await fetchImpl(`https://api.supabase.com/v1/projects/${PROJECT_ID}/${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase ${path} inspection failed with HTTP ${response.status}.`);
  }
  return response.json();
}

export async function inspectRecoveryCompatibility({
  migrations,
  schemaContract,
  accessToken,
  publicUrl,
  publishableKey,
  fetchImpl = fetch,
}) {
  if (!accessToken || !publicUrl || !publishableKey) {
    throw new Error("Remote compatibility checks require Supabase access and public build configuration.");
  }
  if (!schemaContractIsCompatible(schemaContract)) {
    throw new Error("Remote database tables or SQL functions required by Shopee/YouTube are missing or unverified.");
  }
  const rows = migrationRows(migrations);
  const remoteVersions = new Set(rows.filter((row) => row.remote).map((row) => row.remote));
  const remoteOnly = rows.filter((row) => !row.local && row.remote).map((row) => row.remote);
  if (remoteOnly.length) {
    throw new Error(`Remote migrations are missing locally: ${remoteOnly.join(", ")}.`);
  }
  const missingMigrations = REQUIRED_MIGRATIONS.filter((version) => !remoteVersions.has(version));
  if (missingMigrations.length) {
    throw new Error(`Required backend schema migrations are not applied: ${missingMigrations.join(", ")}.`);
  }
  const pending = rows.filter((row) => row.local && !row.remote).map((row) => row.local);
  const unexpectedPending = pending.filter((version) => !ALLOWED_PENDING_MIGRATIONS.has(version));
  if (unexpectedPending.length) {
    throw new Error(`Unexpected pending migrations block recovery: ${unexpectedPending.join(", ")}.`);
  }

  const [functionsPayload, secretsPayload] = await Promise.all([
    managementGet("functions", accessToken, fetchImpl),
    managementGet("secrets", accessToken, fetchImpl),
  ]);
  const functions = rowsFrom(functionsPayload, "functions", ["functions", "data"]);
  const functionStates = {};
  for (const name of REQUIRED_FUNCTIONS) {
    const row = functions.find((candidate) => (candidate.slug ?? candidate.name) === name);
    if (!row || String(row.status ?? "").toLowerCase() !== "active") {
      throw new Error(`Required remote Edge Function is missing or not active: ${name}.`);
    }
    const version = Number(row.version);
    if (!Number.isSafeInteger(version) || version < 1) {
      throw new Error(`Required remote Edge Function version is unknown: ${name}.`);
    }
    functionStates[name] = {
      active: true,
      version,
    };
  }

  const secretRows = rowsFrom(secretsPayload, "secrets", ["secrets", "data"]);
  const secretNames = new Set(secretRows.map((row) => row?.name).filter((name) => typeof name === "string"));
  const secretPresence = Object.fromEntries(REQUIRED_SECRETS.map((name) => [name, secretNames.has(name)]));
  const missingSecrets = Object.entries(secretPresence).filter(([, present]) => !present).map(([name]) => name);
  if (missingSecrets.length) {
    throw new Error(`Required backend Secret names are absent: ${missingSecrets.join(", ")}.`);
  }

  let settingsResponse;
  try {
    settingsResponse = await fetchImpl(`${publicUrl.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
    });
  } catch {
    throw new Error("Supabase Auth settings could not be reached for the Google provider check.");
  }
  if (!settingsResponse.ok) {
    throw new Error(`Supabase Auth settings check failed with HTTP ${settingsResponse.status}.`);
  }
  const authSettings = await settingsResponse.json();
  if (authSettings?.external?.google !== true) {
    throw new Error("Google Auth is not enabled in the remote Supabase Auth configuration.");
  }

  return {
    checkedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    databaseSchemaContractsVerified: true,
    requiredSchemaMigrations: REQUIRED_MIGRATIONS,
    pendingAllowedMigrations: pending,
    functions: functionStates,
    requiredSecretNamesPresent: secretPresence,
    googleAuthEnabled: true,
    migrationsApplied: false,
    functionsToDeploy: REQUIRED_FUNCTIONS,
    functionsExcluded: ["publication-schedule"],
  };
}

async function main() {
  const [migrationPath, schemaContractPath, reportPath] = process.argv.slice(2);
  if (!migrationPath || !schemaContractPath || !reportPath) {
    throw new Error("Usage: node scripts/check-recovery-compatibility.mjs <migration-list.json> <schema-contract.json> <report.json>");
  }
  const result = await inspectRecoveryCompatibility({
    migrations: JSON.parse(readFileSync(migrationPath, "utf8")),
    schemaContract: JSON.parse(readFileSync(schemaContractPath, "utf8")),
    accessToken: process.env.SUPABASE_ACCESS_TOKEN,
    publicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
