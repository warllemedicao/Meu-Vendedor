import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { redactSupabaseOutput } from "../scripts/run-supabase-cli.mjs";

test("redacts database passwords and management tokens from CLI diagnostics", () => {
  const accessToken = "sbp_test-token-value";
  const databasePassword = "db:P@ss word";
  const diagnostic = [
    `Authorization: Bearer ${accessToken}`,
    `{"password":"${databasePassword}"}`,
    `postgresql://postgres:${encodeURIComponent(databasePassword)}@db.example.test/postgres`,
    "password authentication failed for user postgres",
  ].join("\n");

  const redacted = redactSupabaseOutput(diagnostic, {
    SUPABASE_ACCESS_TOKEN: accessToken,
    SUPABASE_DB_PASSWORD: databasePassword,
  });

  assert.doesNotMatch(redacted, /sbp_test-token-value|db:P@ss word|db%3AP%40ss%20word/);
  assert.match(redacted, /Authorization: Bearer \[REDACTED\]/);
  assert.match(redacted, /password authentication failed for user postgres/);
  assert.match(redacted, /\[REDACTED DATABASE URL\]/);
});

test("redacts short secrets without corrupting unrelated diagnostic text", () => {
  assert.equal(
    redactSupabaseOutput("May be required\npassword authentication failed", {
      SUPABASE_DB_PASSWORD: "May",
    }),
    "[REDACTED]\npassword authentication failed",
  );
});

test("reports sanitized stdout and stderr while preserving the CLI exit code", () => {
  const directory = mkdtempSync(join(tmpdir(), "meu-vendedor-supabase-cli-"));
  const cliPath = join(directory, "supabase");
  const accessToken = "sbp_test-token-value";
  const databasePassword = "db-test-password";

  try {
    writeFileSync(
      cliPath,
      [
        "#!/usr/bin/env node",
        `process.stdout.write(JSON.stringify({ args: process.argv.slice(2), error: "database connection refused", password: process.env.SUPABASE_DB_PASSWORD }));`,
        `process.stderr.write(\`Authorization: Bearer \${process.env.SUPABASE_ACCESS_TOKEN}\\n\`);`,
        "process.exitCode = 17;",
      ].join("\n"),
    );
    chmodSync(cliPath, 0o755);

    const result = spawnSync(
      process.execPath,
      [
        new URL("../scripts/run-supabase-cli.mjs", import.meta.url).pathname,
        "migration",
        "list",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          SUPABASE_ACCESS_TOKEN: accessToken,
          SUPABASE_DB_PASSWORD: databasePassword,
        },
      },
    );

    assert.equal(result.status, 17);
    assert.match(result.stderr, /migration list.*exit code 17/);
    assert.match(result.stderr, /"args":\["migration","list"\]/);
    assert.doesNotMatch(result.stderr, /--password/);
    assert.match(result.stderr, /database connection refused/);
    assert.match(result.stderr, /Authorization: Bearer \[REDACTED\]/);
    assert.doesNotMatch(result.stderr, /sbp_test-token-value|db-test-password/);
    assert.match(result.stderr, /"password":"\[REDACTED\]"/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
