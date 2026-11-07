"""CPU-only export benchmark using an existing completed video, not new video generation."""
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request

CONFIG = globals().get("BENCHMARK_CONFIG", {})
ROOT = Path("/kaggle/working")
ROOT.mkdir(parents=True, exist_ok=True)
START = time.monotonic()
REPORT = {"stage": "starting", "kind": "existing_video_lanczos_upscale_not_native_4k", "gpu_requested": False, "cpu_count": os.cpu_count(), "metrics": {}}


def report(stage, **fields):
    REPORT.update(fields)
    REPORT.update(stage=stage, elapsed_seconds=round(time.monotonic() - START, 3))
    (ROOT / "benchmark-report.json").write_text(json.dumps(REPORT))
    print("MV_BENCHMARK " + json.dumps(REPORT), flush=True)
    try:
        req = urllib.request.Request(CONFIG["report_url"], data=json.dumps({"action": "report", "report": REPORT}).encode(), headers={"Content-Type": "application/json", "x-benchmark-gate": CONFIG["report_gate"]}, method="POST")
        with urllib.request.urlopen(req, timeout=15) as response:
            response.read(1024)
    except Exception:
        pass


try:
    import imageio_ffmpeg
    began = time.monotonic()
    original = ROOT / "existing-original.mp4"
    with urllib.request.urlopen(CONFIG["image_url"], timeout=60) as response, original.open("wb") as file:
        total = 0
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > 100 * 1024 * 1024:
                raise RuntimeError("input_too_large")
            file.write(chunk)
    REPORT["metrics"]["download_seconds"] = round(time.monotonic() - began, 3)

    def metadata(path):
        reader = imageio_ffmpeg.read_frames(str(path))
        value = next(reader)
        reader.close()
        return {k: value[k] for k in ["size", "fps", "duration", "codec"] if k in value}

    report("input_downloaded", input=metadata(original), input_bytes=original.stat().st_size, ffmpeg=imageio_ffmpeg.get_ffmpeg_version())
    binary = imageio_ffmpeg.get_ffmpeg_exe()
    began = time.monotonic()
    output = ROOT / "existing-video-4k-lanczos.mp4"
    subprocess.run([binary, "-y", "-i", str(original), "-t", "6", "-vf", "scale=2160:3840:flags=lanczos:force_original_aspect_ratio=decrease,pad=2160:3840:(ow-iw)/2:(oh-ih)/2", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", str(output)], check=True, capture_output=True, timeout=300)
    REPORT["metrics"]["upscale_encode_seconds"] = round(time.monotonic() - began, 3)
    REPORT["metrics"]["output_bytes"] = output.stat().st_size
    report("upscale_complete", output=metadata(output), output_file=output.name)
    for source, target in [(original, "existing-original-frame.png"), (output, "existing-upscaled-frame.png")]:
        subprocess.run([binary, "-y", "-ss", "2", "-i", str(source), "-frames:v", "1", str(ROOT / target)], check=True, capture_output=True, timeout=60)
    report("complete")
except Exception as error:
    message = re.sub(r"https?://[^\s\"']+", "[url]", str(error))[:600]
    report("failed", error_type=type(error).__name__, error=message)
    raise SystemExit(1)
