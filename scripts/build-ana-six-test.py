from pathlib import Path
import ast, hashlib, json, secrets
repo=Path(__file__).resolve().parents[1]; p=Path('/tmp/mv-ana-six');p.mkdir(exist_ok=True)
config=json.loads((p/'control.json').read_text()) if (p/'control.json').exists() else {'url':'https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/ana-six-test','gate':secrets.token_hex(32)}
(p/'control.json').write_text(json.dumps(config));(p/'control.json').chmod(0o600)
s=(repo/'executors/kaggle/distilled_benchmark.py').read_text()
s=s.replace('revision=REPORT["model_revision"]','revision="854c04a4c8a53d990b418c7478f0802c0fc8c726"')
s=s.replace('model_revision=model.get("sha")','model_revision="854c04a4c8a53d990b418c7478f0802c0fc8c726"')
s=s.replace('{"action": "report", "report": REPORT}','{"action": "callback", "id": CONFIG["id"], "report": REPORT}')
s=s.replace('"x-benchmark-gate": CONFIG["report_gate"]','"x-job-token": CONFIG["report_gate"]')
s=s.replace('image = load_image(CONFIG["image_url"]).convert("RGB")','''import imageio.v2 as imageio
    import numpy as np
    from PIL import Image
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    seed_path = ROOT / 'seed-two-seconds.mp4'
    urllib.request.urlretrieve(CONFIG['seed_video'], seed_path)
    import hashlib
    if hashlib.sha256(seed_path.read_bytes()).hexdigest() != CONFIG['seed_sha256']:
        raise RuntimeError('seed_video_hash_mismatch')
    reader = imageio.get_reader(str(seed_path), 'ffmpeg')
    assembled = [f.copy() for f in reader]
    reader.close()
    if len(assembled) not in (48, 96):
        raise RuntimeError('seed_video_frame_count_mismatch')
    image = Image.fromarray(assembled[-1]).convert('RGB')''')
a=s.index('    prompt = "A photorealistic');b=s.index('\n    tokenized =',a)
s=s[:a]+'''    prompt = "A photorealistic adult woman in the reference wears the same orange red midi wrap dress, short sleeves, V neckline and metallic waist detail. She makes a very small elegant hand gesture near her waist and gently shifts her weight, smiling naturally. Preserve her exact face, hair, body proportions, dress design and background. Natural fabric and plausible hands. Static camera, soft warm light, no cuts, no new objects, no text. She is silent."'''+s[b:]
a=s.index('    # Short proof first;');b=s.index('        torch.cuda.empty_cache()',a)
s=s[:a]+'''    attempts = [('continuation_2', 43, 49), ('continuation_3', 44, 49)] if len(assembled) == 48 else [('continuation_3', 44, 49)]
    for label, seed, frame_count in attempts:
'''+s[b:]
s=s.replace('        del frames','''        # Keep the seed identity through image-to-video continuation; no repeated MP4.
        continuation = (np.clip(np.asarray(frames[1:49]), 0, 1) * 255).round().astype(np.uint8)
        continuation = np.stack([np.asarray(Image.fromarray(frame).resize((assembled[0].shape[1], assembled[0].shape[0]), Image.Resampling.LANCZOS)) for frame in continuation])
        assembled.extend(frame.copy() for frame in continuation)
        image = Image.fromarray(continuation[-1]).convert('RGB')
        if len(assembled) not in (96, 144):
            raise RuntimeError('continuation_frame_count_mismatch')
        checkpoint = ROOT / 'assembled-progress.mp4'
        export_to_video([Image.fromarray(frame) for frame in assembled], str(checkpoint), fps=24)
        del frames''')
s=s.replace('    report("complete")','''    if len(assembled) != 144:
        raise RuntimeError('final_frame_count_mismatch')
    raw_final = ROOT / 'six-seconds-raw.mp4'
    export_to_video([Image.fromarray(frame) for frame in assembled], str(raw_final), fps=24, quality=9)
    subprocess.run([ffmpeg, '-y', '-i', str(raw_final), '-t', '6', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(ROOT / 'short_generation.mp4')], check=True, capture_output=True, timeout=180)
    report('complete', final_frames=144, final_seconds=6, method='two_generated_continuations_after_preserved_2s_seed')''')
ast.parse(s);(p/'generation.py').write_text(s)
sup=(repo/'executors/kaggle/ana_midi_supervisor.py').read_text()
sup=sup.replace("['reference', 'product', 'driver']","['reference', 'product', 'driver']")
sup=sup.replace("'id': cfg['id'], 'report_url'", "'seed_video': cfg['seed_video'], 'seed_sha256': cfg['seed_sha256'], 'id': cfg['id'], 'report_url'")
ast.parse(sup);(p/'supervisor.py').write_text(sup)
print('Two-continuation generation and bounded supervisor syntax OK')
controller=(repo/'executors/kaggle/ana_six_controller.ts').read_text()
controller=controller.replace('__GATE_HASH__',hashlib.sha256(config['gate'].encode()).hexdigest()).replace('__SOURCE__',json.dumps(s)).replace('__SUPERVISOR__',json.dumps(sup))
(p/'controller.ts').write_text(controller)
print('Controller built locally; no deployment or GPU submission performed')
