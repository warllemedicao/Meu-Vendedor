import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const authorizedImage = resolve(projectRoot, "public/presenters/ana.webp");

export function buildFfmpegArguments(inputPath, outputPath) {
  return [
    "-hide_banner",
    "-loglevel", "error",
    "-n",
    "-loop", "1",
    "-framerate", "30",
    "-i", inputPath,
    "-frames:v", "180",
    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p",
    "-an",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "28",
    "-movflags", "+faststart",
    "-metadata", "title=Local technical demo",
    "-metadata", "comment=Still image of Ana; no AI video generation",
    "-f", "mp4",
    outputPath,
  ];
}

function runFfmpeg(args) {
  return new Promise((resolvePromise, reject) => {
    const process = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    process.stderr.setEncoding("utf8");
    process.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000); });
    process.once("error", (error) => {
      reject(error.code === "ENOENT"
        ? new Error("FFmpeg não está instalado. Instale o binário ffmpeg para gerar o teste local.")
        : error);
    });
    process.once("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`FFmpeg terminou com código ${code}: ${stderr.trim() || "falha sem detalhes"}`));
    });
  });
}

export async function generateDemoVideo(outputPath = resolve(tmpdir(), `meu-vendedor-video-demo-${randomUUID()}.mp4`)) {
  const resolvedOutput = resolve(outputPath);
  await access(authorizedImage);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await runFfmpeg(buildFfmpegArguments(authorizedImage, resolvedOutput));
  return resolvedOutput;
}

async function main() {
  const outputPath = await generateDemoVideo(process.argv[2]);
  process.stdout.write(`Teste técnico local gerado (6s, 9:16, sem IA): ${outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Falha ao gerar o vídeo de teste."}\n`);
    process.exitCode = 1;
  });
}
