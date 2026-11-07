"""Private, bounded Kaggle I2V benchmark. Config is injected at launch, never committed.

No Kaggle/Supabase administrative credentials are passed to this script.
The optional report callback accepts only benchmark reports through a disposable gate.
"""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request

CONFIG = globals().get("BENCHMARK_CONFIG", {})
ROOT = Path("/kaggle/working")
ROOT.mkdir(parents=True, exist_ok=True)
START = time.monotonic()
REPORT = {"model": "hunyuanvideo-community/HunyuanVideo-1.5-Diffusers-480p_i2v_step_distilled", "stage": "starting", "runs": [], "metrics": {}}
REPORT["quantization"] = "nf4"
REPORT["offloading"] = CONFIG.get("offloading", "model")
REPORT["steps"] = 12
REPORT["quantized_components"] = ["text_encoder"] if REPORT["offloading"] == "hybrid" else ["transformer", "text_encoder"]


def safe(value):
    return re.sub(r"https?://[^\s\"']+", "[url]", str(value))[:800]


def report(stage, **values):
    REPORT.update(values)
    REPORT["stage"] = stage
    REPORT["elapsed_seconds"] = round(time.monotonic() - START, 3)
    text = json.dumps(REPORT)
    (ROOT / "benchmark-report.json").write_text(text)
    print("MV_BENCHMARK " + text, flush=True)
    if CONFIG.get("report_url") and CONFIG.get("report_gate"):
        try:
            req = urllib.request.Request(CONFIG["report_url"], data=json.dumps({"action": "report", "report": REPORT}).encode(), headers={"Content-Type": "application/json", "x-benchmark-gate": CONFIG["report_gate"]}, method="POST")
            with urllib.request.urlopen(req, timeout=15) as response:
                response.read(1024)
        except Exception:
            pass


def main():
    os.environ["HF_HOME"] = "/tmp/mv-hf-cache"
    os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
    os.environ["TOKENIZERS_PARALLELISM"] = "false"
    os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
    import torch
    import psutil
    torch.set_num_threads(4)
    hardware = {"torch": torch.__version__, "python": sys.version.split()[0], "cuda_available": torch.cuda.is_available(), "ram_total_bytes": psutil.virtual_memory().total, "ram_available_bytes": psutil.virtual_memory().available, "disk_free_bytes": shutil.disk_usage("/tmp").free, "gpus": []}
    for index in range(torch.cuda.device_count()):
        p = torch.cuda.get_device_properties(index)
        hardware["gpus"].append({"name": p.name, "vram_bytes": p.total_memory, "compute_capability": list(torch.cuda.get_device_capability(index))})
    report("hardware_checked", hardware=hardware)
    if not hardware["cuda_available"]:
        raise RuntimeError("cuda_not_available")

    # Check network access before spending time installing or downloading weights.
    began = time.monotonic()
    with urllib.request.urlopen("https://huggingface.co/api/models/" + REPORT["model"] + "?blobs=true", timeout=60) as response:
        model = json.load(response)
    weights = [f for f in model.get("siblings", []) if f["rfilename"].endswith(".safetensors")]
    weight_bytes = sum(f.get("size", f.get("lfs", {}).get("size", 0)) for f in weights)
    REPORT["metrics"]["model_metadata_seconds"] = round(time.monotonic() - began, 3)
    report("model_catalog_checked", model_revision=model.get("sha"), model_weight_bytes=weight_bytes, model_gated=bool(model.get("gated")))
    if weight_bytes and weight_bytes > hardware["disk_free_bytes"] * 0.85:
        raise RuntimeError("insufficient_disk_for_model_weights")

    began = time.monotonic()
    requirements = ["diffusers==0.42.1", "transformers==5.4.0", "accelerate==1.12.0", "sentencepiece==0.2.1", "imageio-ffmpeg==0.6.0", "ftfy==6.3.1"]
    if REPORT["quantization"] == "nf4":
        requirements.append("bitsandbytes==0.49.2")
    install = subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", *requirements], capture_output=True, text=True, timeout=600)
    REPORT["metrics"]["installation_seconds"] = round(time.monotonic() - began, 3)
    if install.returncode:
        raise RuntimeError("dependency_install_failed: " + safe((install.stdout + install.stderr)[-700:]))
    import importlib.metadata
    REPORT["dependencies"] = {p: importlib.metadata.version(p) for p in ["diffusers", "transformers", "accelerate", "huggingface-hub", "torch"]}
    report("dependencies_installed")

    from huggingface_hub import snapshot_download
    began = time.monotonic()
    location = snapshot_download(REPORT["model"], revision=REPORT["model_revision"], ignore_patterns=["*.md", "*.png", "*.jpg", ".gitattributes"], max_workers=4)
    REPORT["metrics"]["download_seconds"] = round(time.monotonic() - began, 3)
    report("weights_downloaded", disk_free_after_download=shutil.disk_usage("/tmp").free)

    from diffusers import HunyuanVideo15ImageToVideoPipeline
    from diffusers.utils import export_to_video, load_image
    import imageio_ffmpeg
    began = time.monotonic()
    options = {"dtype": torch.float16, "low_cpu_mem_usage": True}
    if REPORT["quantization"] == "nf4":
        from diffusers.quantizers import PipelineQuantizationConfig
        options["quantization_config"] = PipelineQuantizationConfig(quant_backend="bitsandbytes_4bit", quant_kwargs={"load_in_4bit": True, "bnb_4bit_quant_type": "nf4", "bnb_4bit_compute_dtype": torch.float16}, components_to_quantize=REPORT["quantized_components"])
    pipeline = HunyuanVideo15ImageToVideoPipeline.from_pretrained(location, **options)
    if REPORT["offloading"] == "model":
        pipeline.enable_model_cpu_offload()
    elif REPORT["offloading"] == "hybrid":
        from accelerate import cpu_offload, cpu_offload_with_hook
        from diffusers.hooks import apply_group_offloading
        # Group hooks only touch the unquantized visual transformer.
        apply_group_offloading(pipeline.transformer, onload_device=torch.device("cuda:0"), offload_device=torch.device("cpu"), offload_type="block_level", num_blocks_per_group=1, use_stream=False)
        # Params4bit cannot be reconstructed on meta by sequential Accelerate hooks.
        # Move the quantized encoder as a module, preserving its quantization state.
        _, text_hook = cpu_offload_with_hook(pipeline.text_encoder, execution_device=torch.device("cuda:0"))

        def offload_text_after_forward(module, inputs, output):
            text_hook.offload()

        pipeline.text_encoder.register_forward_hook(offload_text_after_forward)
        _, image_hook = cpu_offload_with_hook(pipeline.image_encoder, execution_device=torch.device("cuda:0"))

        def offload_image_after_forward(module, inputs, output):
            image_hook.offload()

        pipeline.image_encoder.register_forward_hook(offload_image_after_forward)
        for name in ["text_encoder_2", "vae"]:
            cpu_offload(getattr(pipeline, name), execution_device=torch.device("cuda:0"), offload_buffers=True)
    else:
        # Do not mix accelerate model hooks with Diffusers group hooks.
        from diffusers.hooks import apply_group_offloading
        for name in ["transformer", "text_encoder", "text_encoder_2", "image_encoder"]:
            component = getattr(pipeline, name)
            apply_group_offloading(component, onload_device=torch.device("cuda:0"), offload_device=torch.device("cpu"), offload_type="block_level", num_blocks_per_group=1, use_stream=False)
        # VAE uses convolutional leaves rather than transformer block groups.
        apply_group_offloading(pipeline.vae, onload_device=torch.device("cuda:0"), offload_device=torch.device("cpu"), offload_type="leaf_level", use_stream=False)
    pipeline.vae.enable_tiling()
    pipeline.vae.enable_slicing()
    pipeline.tokenizer_max_length = 256
    if pipeline.scheduler.config.shift != 7 or pipeline.guider.config.guidance_scale != 1:
        raise RuntimeError("unexpected_step_distilled_configuration")
    REPORT["metrics"]["load_seconds"] = round(time.monotonic() - began, 3)
    report("model_loaded")
    image = load_image(CONFIG["image_url"]).convert("RGB")
    image.save(ROOT / "reference.png")
    prompt = "A photorealistic adult product presenter from the reference image makes one small, controlled presentation gesture. Preserve the exact face, body proportions, hair, clothing, product shape, colors and packaging from the reference. Natural skin texture and subtle blinking, physically plausible hands and fabric motion. Keep the product visible. Preserve the background and soft lighting. Eye-level medium shot, locked camera, one continuous shot, no scene cuts, no added text or objects. The presenter is silent."
    tokenized = pipeline.tokenizer(prompt, add_special_tokens=False).input_ids
    if len(tokenized) > pipeline.tokenizer_max_length:
        raise RuntimeError("benchmark_prompt_exceeds_token_budget")
    report("reference_ready", prompt_tokens=len(tokenized), tokenizer_max_length=pipeline.tokenizer_max_length)
    # Short proof first; only attempt six seconds after a successful MP4.
    attempts = [("short_generation", 42, 49)]
    if CONFIG.get("attempt_six_seconds") == "yes":
        attempts.append(("six_second_generation", 43, 145))
    for label, seed, frame_count in attempts:
        if label == "six_second_generation" and time.monotonic() - START + REPORT["runs"][0]["total_generation_and_encode_seconds"] * 9 + 60 > 3300:
            report("complete_single_run", long_run_skipped="insufficient_time_in_bounded_session")
            return
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()
        report(label + "_starting", requested_frames=frame_count, generation_elapsed_seconds=0)
        began = time.monotonic()
        stopped = threading.Event()

        def monitor():
            while not stopped.wait(45):
                report(label, generation_elapsed_seconds=round(time.monotonic() - began, 3), ram_available_now=psutil.virtual_memory().available, gpu_allocated_bytes=torch.cuda.memory_allocated(), gpu_reserved_bytes=torch.cuda.memory_reserved())

        threading.Thread(target=monitor, daemon=True).start()
        try:
            # This pipeline derives its resolution from the image and model target_size.
            # v0.42.1 does not accept height/width or step callbacks.
            frames = pipeline(image=image, prompt=prompt, num_frames=frame_count, num_inference_steps=12, generator=torch.Generator("cuda").manual_seed(seed)).frames[0]
        finally:
            stopped.set()
        torch.cuda.synchronize()
        render_seconds = time.monotonic() - began
        raw = ROOT / (label + "-raw.mp4")
        export_to_video(frames, str(raw), fps=24)
        final = ROOT / (label + ".mp4")
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        subprocess.run([ffmpeg, "-y", "-i", str(raw), "-t", str(2 if frame_count == 49 else 6), "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", str(final)], check=True, capture_output=True, timeout=120)
        row = {"label": label, "seed": seed, "steps": 12, "requested_frames": frame_count, "generated_frames": len(frames), "native_frame_shape": list(frames[0].shape), "render_seconds": round(render_seconds, 3), "total_generation_and_encode_seconds": round(time.monotonic() - began, 3), "gpu_peak_allocated_bytes": torch.cuda.max_memory_allocated(), "gpu_peak_reserved_bytes": torch.cuda.max_memory_reserved(), "mp4_bytes": final.stat().st_size, "file": final.name, "audio": False}
        REPORT["runs"].append(row)
        report(label + "_complete")
        for second in ([0, 1] if frame_count == 49 else [0, 2, 4, 5]):
            frame_path = ROOT / (label + "-frame-" + str(second) + ".png")
            subprocess.run([ffmpeg, "-y", "-ss", str(second), "-i", str(final), "-frames:v", "1", str(frame_path)], check=True, capture_output=True, timeout=60)
        del frames
    report("complete")


try:
    main()
except Exception as error:
    import traceback
    report("failed", failed_stage=REPORT.get("stage"), error_type=type(error).__name__, error=safe(error), traceback=safe(" > ".join(f"{Path(f.filename).name}:{f.lineno}:{f.name}" for f in traceback.extract_tb(error.__traceback__))[-800:]))
    raise SystemExit(1)
