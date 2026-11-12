import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectPendingMigrations } from "../scripts/check-pending-migrations.mjs";

function withMigrations(files, run) {
  const directory = mkdtempSync(join(tmpdir(), "meu-vendedor-migrations-"));
  mkdirSync(directory, { recursive: true });
  try {
    for (const [name, sql] of Object.entries(files)) {
      writeFileSync(join(directory, name), sql);
    }
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("classifies only unapplied local migrations and allows additive SQL", () => {
  withMigrations({
    "20261112180000_schedule.sql": "create table public.example (id uuid primary key);",
  }, directory => {
    const result = inspectPendingMigrations({
      migrations: [
        { local: "20261112180000", remote: "" },
        { local: "20261112180100", remote: "20261112180100" },
      ],
    }, directory);

    assert.deepEqual(result.pending, [{ local: "20261112180000", remote: "" }]);
    assert.deepEqual(result.highRisk, []);
  });
});

test("flags pending constraint-removal operations", () => {
  withMigrations({
    "20261112190000_tiktok.sql": "alter table public.items drop constraint if exists items_destination_check;",
  }, directory => {
    const result = inspectPendingMigrations({
      migrations: [{ local: "20261112190000", remote: "" }],
    }, directory);

    assert.deepEqual(result.highRisk, [{
      version: "20261112190000",
      file: "20261112190000_tiktok.sql",
    }]);
  });
});

test("flags destructive statements even when their keywords appear near SQL strings", () => {
  withMigrations({
    "20261112190100_cleanup.sql": "select '--'; drop table public.temporary_items;",
  }, directory => {
    const result = inspectPendingMigrations({
      migrations: [{ local: "20261112190100", remote: "" }],
    }, directory);

    assert.equal(result.highRisk.length, 1);
  });
});

test("refuses to deploy when remote migration history is missing locally", () => {
  withMigrations({}, directory => {
    assert.throws(
      () => inspectPendingMigrations({
        migrations: [{ local: "", remote: "20261112170000" }],
      }, directory),
      /missing locally/,
    );
  });
});

test("fails closed when a pending version has no matching migration file", () => {
  withMigrations({}, directory => {
    assert.throws(
      () => inspectPendingMigrations({
        migrations: [{ local: "20261112170000", remote: "" }],
      }, directory),
      /Expected exactly one local SQL file/,
    );
  });
});
