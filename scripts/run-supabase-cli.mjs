import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function redactSupabaseOutput(value, environment = process.env) {
  let output = String(value);
  const secrets = [
    environment.SUPABASE_ACCESS_TOKEN,
    environment.SUPABASE_DB_PASSWORD,
  ].filter((secret) => typeof secret === "string" && secret.length > 0);

  for (const secret of secrets) {
    if (secret.length < 8) {
      output = output
        .split(/\r?\n/)
        .map((line) => (line.includes(secret) ? "[REDACTED]" : line))
        .join("\n");
      continue;
    }
    for (const variant of new Set([secret, encodeURIComponent(secret), encodeURI(secret)])) {
      output = output.split(variant).join("[REDACTED]");
    }
  }

  return output
    .replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(
      /(["']?(?:access[-_ ]?token|token|password)["']?\s*[:=]\s*["']?)[^,\s}"']+/gi,
      "$1[REDACTED]",
    )
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[REDACTED DATABASE URL]");
}

function runSupabase() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node scripts/run-supabase-cli.mjs <Supabase CLI arguments...>");
    process.exitCode = 2;
    return;
  }

  const commandName = args.slice(0, 2).join(" ");
  const child = spawn("supabase", args, { stdio: ["inherit", "pipe", "pipe"] });
  const stdout = [];
  const stderr = [];
  let spawnFailed = false;

  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));

  child.once("error", (error) => {
    spawnFailed = true;
    console.error(
      `Could not start Supabase CLI "${commandName}": ${redactSupabaseOutput(error.message)}`,
    );
    process.exitCode = 1;
  });

  child.once("close", (code, signal) => {
    if (spawnFailed) return;

    const output = Buffer.concat(stdout).toString("utf8");
    const errors = Buffer.concat(stderr).toString("utf8");
    if (code === 0) {
      process.stdout.write(redactSupabaseOutput(output));
      process.stderr.write(redactSupabaseOutput(errors));
      return;
    }

    console.error(
      `Supabase CLI "${commandName}" failed with exit code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}.`,
    );
    const diagnostic = [output, errors].filter((text) => text.length > 0).join("\n").trim();
    console.error(diagnostic ? redactSupabaseOutput(diagnostic) : "The command returned no diagnostic output.");
    process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runSupabase();
}
