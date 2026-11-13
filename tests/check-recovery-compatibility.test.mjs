import assert from "node:assert/strict";
import test from "node:test";
import { inspectRecoveryCompatibility } from "../scripts/check-recovery-compatibility.mjs";

const applied = [
  { local: "20261104000200", remote: "20261104000200" },
  { local: "20261106233237", remote: "20261106233237" },
  { local: "20261112180000", remote: "" },
  { local: "20261112180100", remote: "" },
  { local: "20261112190000", remote: "" },
  { local: "20261112200000", remote: "" },
];
const secrets = [
  "MV_CREDENTIAL_ENCRYPTION_KEY",
  "MV_SYNC_JOB_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
].map((name) => ({ name, value: "must-never-be-returned" }));
const functions = ["marketplace", "youtube-connection"].map((slug, index) => ({
  slug,
  status: "ACTIVE",
  version: index + 3,
}));

function mockFetch({ functionRows = functions, secretRows = secrets, googleEnabled = true } = {}) {
  return async (url) => {
    if (url.endsWith("/functions")) return Response.json(functionRows);
    if (url.endsWith("/secrets")) return Response.json(secretRows);
    if (url.endsWith("/auth/v1/settings")) return Response.json({ external: { google: googleEnabled } });
    throw new Error(`Unexpected request: ${url}`);
  };
}

const baseInput = {
  migrations: { migrations: applied },
  schemaContract: { rows: [{ compatible: true }] },
  accessToken: "test-access-token",
  publicUrl: "https://jzchlrvxdaffnrgbvabv.supabase.co",
  publishableKey: "test-publishable-key",
};

test("allows only the four known publication migrations to remain pending", async () => {
  const report = await inspectRecoveryCompatibility({ ...baseInput, fetchImpl: mockFetch() });
  assert.deepEqual(report.pendingAllowedMigrations, [
    "20261112180000",
    "20261112180100",
    "20261112190000",
    "20261112200000",
  ]);
  assert.equal(report.migrationsApplied, false);
  assert.deepEqual(report.functionsToDeploy, ["marketplace", "youtube-connection"]);
  assert.equal(JSON.stringify(report).includes("must-never-be-returned"), false);
});

test("blocks recovery when a required backend schema migration is unapplied", async () => {
  const migrations = {
    migrations: applied.map((row) =>
      row.local === "20261106233237" ? { ...row, remote: "" } : row),
  };
  await assert.rejects(
    inspectRecoveryCompatibility({ ...baseInput, migrations, fetchImpl: mockFetch() }),
    /Required backend schema migrations are not applied: 20261106233237/,
  );
});

test("blocks recovery when the read-only database schema contract is missing or false", async (t) => {
  await t.test("contract is false", async () => {
    await assert.rejects(
      inspectRecoveryCompatibility({
        ...baseInput,
        schemaContract: { rows: [{ compatible: false }] },
        fetchImpl: mockFetch(),
      }),
      /tables or SQL functions required by Shopee\/YouTube are missing or unverified/,
    );
  });
  await t.test("contract output is unsupported", async () => {
    await assert.rejects(
      inspectRecoveryCompatibility({
        ...baseInput,
        schemaContract: { rows: [] },
        fetchImpl: mockFetch(),
      }),
      /tables or SQL functions required by Shopee\/YouTube are missing or unverified/,
    );
  });
});

test("blocks unknown pending migrations rather than assuming compatibility", async () => {
  const migrations = { migrations: [...applied, { local: "20261113000000", remote: "" }] };
  await assert.rejects(
    inspectRecoveryCompatibility({ ...baseInput, migrations, fetchImpl: mockFetch() }),
    /Unexpected pending migrations block recovery: 20261113000000/,
  );
});

test("blocks when a required function or backend Secret is absent", async (t) => {
  await t.test("function is inactive", async () => {
    const inactive = functions.map((row) =>
      row.slug === "marketplace" ? { ...row, status: "DISABLED" } : row);
    await assert.rejects(
      inspectRecoveryCompatibility({ ...baseInput, fetchImpl: mockFetch({ functionRows: inactive }) }),
      /missing or not active: marketplace/,
    );
  });
  await t.test("secret name is missing", async () => {
    await assert.rejects(
      inspectRecoveryCompatibility({ ...baseInput, fetchImpl: mockFetch({ secretRows: secrets.slice(1) }) }),
      /Required backend Secret names are absent: MV_CREDENTIAL_ENCRYPTION_KEY/,
    );
  });
});

test("blocks when Google Auth is not enabled", async () => {
  await assert.rejects(
    inspectRecoveryCompatibility({ ...baseInput, fetchImpl: mockFetch({ googleEnabled: false }) }),
    /Google Auth is not enabled/,
  );
});
