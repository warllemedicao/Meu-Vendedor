import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/frontend-recovery.yml", import.meta.url),
  "utf8",
);

function stepBlock(name) {
  const marker = `      - name: ${name}`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `workflow step not found: ${name}`);
  const next = workflow.indexOf("\n      - name:", start + marker.length);
  return workflow.slice(start, next === -1 ? workflow.length : next);
}

test("passes the Supabase access token explicitly to the compatibility checker", () => {
  const step = stepBlock("Verify only compatible backend contracts");
  assert.match(step, /SUPABASE_ACCESS_TOKEN:\s*\$\{\{\s*secrets\.SUPABASE_ACCESS_TOKEN\s*\}\}/);
  assert.match(step, /NEXT_PUBLIC_SUPABASE_URL:\s*https:\/\/jzchlrvxdaffnrgbvabv\.supabase\.co/);
  assert.match(step, /check-recovery-compatibility\.mjs/);
});

test("uses a read-only credential to inspect environment protections", () => {
  const job = workflow.slice(
    workflow.indexOf("  verify-protected-approval:"),
    workflow.indexOf("\n  publish:"),
  );
  assert.match(job, /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
  assert.match(job, /permissions:\n\s+contents:\s+read/);
  assert.doesNotMatch(job, /^\s+administration:\s*read\s*$/m);
  assert.match(job, /if ! gh api .*frontend-recovery/);
  assert.match(job, /prevent_self_review/);
  assert.match(job, /can_admins_bypass == false/);
});

test("keeps the Supabase schema query explicitly read-only with the pinned CLI", () => {
  const install = stepBlock("Install pinned Supabase CLI");
  const query = stepBlock("Verify Shopee and YouTube database contracts read-only");
  assert.match(install, /supabase@3\.1\.0/);
  assert.match(query, /db query/);
  assert.match(query, /--remote="\$SUPABASE_PROJECT_ID"/);
  assert.match(query, /--read-only/);
  assert.match(query, /--output-format json/);
  assert.match(query, /--file scripts\/recovery-schema-contract\.sql/);
});

test("uses either GitHub Secret or Variable for the public key without logging it", () => {
  assert.match(
    workflow,
    /secrets\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*\|\|\s*vars\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
  );
  assert.doesNotMatch(workflow, /echo\s+.*\$(?:\{)?NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

test("does not apply migrations in the recovery workflow", () => {
  assert.doesNotMatch(workflow, /\bdb push\b/);
});
