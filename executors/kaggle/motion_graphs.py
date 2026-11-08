"""Fixed ComfyUI API graphs. User input supplies data, never nodes or code.

Graphs follow the pinned official ComfyUI and WanVideoWrapper contracts.
"""


def graph(engine, prompt, seconds=2, seed=42, mode="animate"):
    if engine not in ("wan-animate", "scail", "vace"):
        raise ValueError("engine_unavailable")
    if seconds not in (2, 3, 4) or mode not in ("animate", "replace"):
        raise ValueError("input_invalid")
    width, height, fps = 288, 512, 16
    length = seconds * fps + 1
    g = {}

    def node(key, cls, **inputs):
        g[str(key)] = {"class_type": cls, "inputs": inputs}
        return [str(key), 0]

    ref = node(1, "MVInput", kind="reference")
    driver = node(2, "MVInput", kind="driver")
    vae = node(3, "VAELoader", vae_name="wan_2.1_vae.safetensors")
    clip = node(4, "CLIPLoader", clip_name="umt5_xxl_fp16.safetensors", type="wan", device="cpu")
    positive = node(5, "CLIPTextEncode", clip=clip, text=prompt)
    negative = node(6, "CLIPTextEncode", clip=clip, text="distorted hands, extra fingers, identity change, product deformation, text, watermark, flicker")
    if engine == "wan-animate":
        # The known Kaggle workflow uses the WanVideo wrapper's block offload.
        g.pop("3")
        vae = node(3, "WanVideoVAELoader", model_name="wan_2.1_vae.safetensors", precision="fp16")
        swap = node(10, "WanVideoBlockSwap", blocks_to_swap=40, offload_img_emb=True, offload_txt_emb=True, use_non_blocking=False, vace_blocks_to_swap=0, prefetch_blocks=0, block_swap_debug=False)
        model = node(11, "WanVideoModelLoader", model="Wan2.2-Animate-14B-Q3_K_M.gguf", base_precision="fp16", quantization="disabled", load_device="offload_device", attention_mode="sdpa", rms_norm_function="default", block_swap_args=swap)
        vision = node(12, "CLIPVisionLoader", clip_name="clip_vision_h.safetensors")
        image_embed = node(13, "WanVideoClipVisionEncode", clip_vision=vision, image_1=ref, strength_1=1, strength_2=1, crop="center", combine_embeds="average", force_offload=True, tiles=0, ratio=0.5)
        pose = node(14, "DWPreprocessor", image=driver, detect_hand="enable", detect_body="enable", detect_face="enable", resolution=512, bbox_detector="yolox_l.onnx", pose_estimator="dw-ll_ucoco_384.onnx", scale_stick_for_xinsr_cn="disable")
        embeds = node(15, "WanVideoAnimateEmbeds", width=width, height=height, num_frames=length, force_offload=True, frame_window_size=length, colormatch="disabled", pose_strength=1, face_strength=1, tiled_vae=True, vae=vae, clip_embeds=image_embed, ref_images=ref, pose_images=pose)
        # Replacement uses supplied masks in VACE/SCAIL instead; never imply this pose graph preserves the product.
        if mode == "replace":
            raise ValueError("wan_replacement_use_scail_or_vace")
        text = node(16, "WanVideoTextEmbedBridge", positive=positive, negative=negative)
        samples = node(17, "WanVideoSampler", model=model, image_embeds=embeds, text_embeds=text, steps=20, cfg=1, shift=5, seed=seed, force_offload=True, scheduler="unipc", riflex_freq_index=0, denoise_strength=1, batched_cfg="", rope_function="comfy", start_step=0, end_step=-1, add_noise_to_samples=False)
        decoded = node(18, "WanVideoDecode", vae=vae, samples=samples, enable_vae_tiling=True, tile_x=272, tile_y=272, tile_stride_x=144, tile_stride_y=128, normalization="default")
    else:
        if engine == "scail":
            model = node(10, "UnetLoaderGGUF", unet_name="SCAIL-2-Q3_K_M.gguf")
            sam = node(11, "CheckpointLoaderSimple", ckpt_name="sam3.1_multiplex_fp16.safetensors")
            human = node(12, "CLIPTextEncode", clip=["11", 1], text="human")
            dt = node(13, "SAM3_VideoTrack", images=driver, model=sam, conditioning=human, detection_threshold=0.5, max_objects=1, detect_interval=1)
            rt = node(14, "SAM3_VideoTrack", images=ref, model=sam, conditioning=human, detection_threshold=0.5, max_objects=1, detect_interval=1)
            masks = node(15, "SCAIL2ColoredMask", driving_track_data=dt, ref_track_data=rt, object_indices="0", sort_by="left_to_right", replacement_mode=mode == "replace")
            vision = node(16, "CLIPVisionLoader", clip_name="clip_vision_h.safetensors")
            vision_embed = node(17, "CLIPVisionEncode", clip_vision=vision, image=ref, crop="none")
            node(18, "WanSCAILToVideo", positive=positive, negative=negative, vae=vae, width=width, height=height, length=length, batch_size=1, pose_video=driver, pose_video_mask=masks, reference_image=ref, reference_image_mask=["15", 1], clip_vision_output=vision_embed, replacement_mode=mode == "replace", pose_strength=1, pose_start=0, pose_end=1, video_frame_offset=0, previous_frame_count=5)
        else:
            model = node(10, "UNETLoader", unet_name="wan2.1_vace_1.3B_fp16.safetensors", weight_dtype="default")
            mask = node(11, "MVInput", kind="mask")
            node(18, "WanVaceToVideo", positive=positive, negative=negative, vae=vae, width=width, height=height, length=length, batch_size=1, strength=1, reference_image=ref, control_video=driver, control_masks=["11", 1])
        sampled = node(20, "ModelSamplingSD3", model=model, shift=5)
        samples = node(21, "KSampler", model=sampled, seed=seed, steps=20, cfg=5, sampler_name="uni_pc", scheduler="simple", denoise=1, positive=["18", 0], negative=["18", 1], latent_image=["18", 2])
        if engine == "vace":
            samples = node(23, "TrimVideoLatent", samples=samples, trim_amount=["18", 3])
        decoded = node(22, "VAEDecodeTiled", samples=samples, vae=vae, tile_size=256, overlap=64, temporal_size=16, temporal_overlap=4)
    node(99, "SaveImage", images=decoded, filename_prefix="motion")
    return g
