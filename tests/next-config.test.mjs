import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const configPath = fileURLToPath(new URL("../next.config.ts", import.meta.url));

function loadConfig(env) {
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", `await import(${JSON.stringify(configPath)})`],
    { encoding: "utf8", env },
  );
}

test("static export refuses to build without both public Supabase variables", () => {
  const env = { ...process.env, MEU_VENDEDOR_STATIC_EXPORT: "1" };
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  delete env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const result = loadConfig(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

test("normal Next.js builds remain available without Supabase configuration", () => {
  const env = { ...process.env };
  delete env.MEU_VENDEDOR_STATIC_EXPORT;
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  delete env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const result = loadConfig(env);
  assert.equal(result.status, 0, result.stderr);
});
