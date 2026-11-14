import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const directory = join(process.cwd(), "supabase/migrations");
const read = (file) => readFileSync(join(directory, file), "utf8");

test("publication schema restricts access to the owner and service role", () => {
  const sql = read("20261112180000_publication_scheduling.sql");
  assert.match(sql, /alter table public\.mv_publications enable row level security/i);
  assert.match(sql, /alter table public\.mv_publication_attempts enable row level security/i);
  assert.match(sql, /revoke all on public\.mv_publications, public\.mv_publication_attempts from anon, authenticated/i);
  assert.match(sql, /using \(user_id = \(select auth\.uid\(\)\)\)/i);
  assert.match(sql, /revoke all on function public\.mv_process_due_publications\(\) from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.mv_apply_publication_action\(uuid,uuid,text,uuid\) from public, anon, authenticated/i);
  assert.equal((sql.match(/set search_path = pg_catalog, public, pg_temp/gi) ?? []).length, 2);
});

test("scheduler only queues manual action, never marks posts as published", () => {
  const sql = read("20261112180000_publication_scheduling.sql");
  const scheduler = sql.split("create or replace function public.mv_process_due_publications()")[1].split("create or replace function public.mv_apply_publication_action(")[0];
  assert.match(scheduler, /set status = 'awaiting_manual_action'/);
  assert.match(scheduler, /for update skip locked/i);
  assert.match(scheduler, /on conflict \(publication_id, attempt_number\) do nothing/i);
  assert.doesNotMatch(scheduler, /set status = 'published'/i);
});

test("destination migrations are ordered and preserve previously permitted destinations", () => {
  const initial = read("20261112180000_publication_scheduling.sql");
  const tiktok = read("20261112190000_publication_tiktok_destination.sql");
  const social = read("20261112200000_publication_social_destinations.sql");
  const destinations = ["shopee_video", "pinterest", "other_app"];
  for (const destination of destinations) {
    for (const sql of [initial, tiktok, social]) assert.ok(sql.includes("'"+destination+"'"));
  }
  assert.match(tiktok, /'tiktok_video'/);
  for (const destination of ["tiktok_video", "kwai", "facebook_stories"]) {
    assert.ok(social.includes("'"+destination+"'"));
  }
  for (const sql of [tiktok, social]) {
    assert.match(sql, /drop constraint if exists mv_publications_destination_check/i);
    assert.match(sql, /add constraint mv_publications_destination_check/i);
    assert.match(sql, /^begin;/i);
    assert.match(sql, /commit;\s*$/i);
  }
});

test("cron migration schedules only the manual handoff processor", () => {
  const sql = read("20261112180100_publication_scheduler_cron.sql");
  assert.match(sql, /'mv-publication-scheduler'/);
  assert.match(sql, /'\* \* \* \* \*'/);
  assert.match(sql, /select public\.mv_process_due_publications\(\)/);
});
