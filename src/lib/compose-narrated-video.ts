/** Local export leaves the original library video untouched and never calls an AI provider. */
export async function composeNarratedVideo(videoBlob: Blob, audioBlob: Blob, audioContext?: AudioContext): Promise<Blob> {
  if (typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Este navegador não suporta exportação narrada. Baixe o MP3 e o vídeo para editar separadamente.");
  }
  const mime = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp8,opus", "video/webm"].find(t => MediaRecorder.isTypeSupported(t));
  if (!mime) throw new Error("Este navegador não suporta um formato de exportação. Baixe o MP3 separadamente.");
  const videoUrl = URL.createObjectURL(videoBlob);
  const video = document.createElement("video");
  video.src = videoUrl; video.muted = true; video.playsInline = true;
  const context = audioContext ?? new AudioContext();
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let source: AudioBufferSourceNode | null = null;
  let frame = 0;
  try {
    // Resume before any asynchronous download/decode loses the user's click activation.
    await context.resume();
    if (context.state !== "running") throw new Error("Permita reprodução de áudio neste navegador antes de exportar.");
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("O vídeo não ficou pronto para exportar.")), 15000);
      video.onloadeddata = () => { clearTimeout(timer); resolve(); };
      video.onerror = () => { clearTimeout(timer); reject(new Error("O navegador não conseguiu decodificar o vídeo.")); };
      video.load();
    });
    const audio = await context.decodeAudioData(await audioBlob.arrayBuffer());
    const duration = Math.max(video.duration, audio.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 120) throw new Error("A exportação narrada aceita até dois minutos.");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const drawing = canvas.getContext("2d");
    if (!drawing || !canvas.width || !canvas.height) throw new Error("Não foi possível preparar a imagem do vídeo.");
    drawing.drawImage(video, 0, 0);
    stream = canvas.captureStream(30);
    const destination = context.createMediaStreamDestination();
    source = context.createBufferSource(); source.buffer = audio; source.connect(destination);
    for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
    const chunks: Blob[] = [];
    const finished = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder!.onstop = () => resolve(new Blob(chunks, { type: recorder!.mimeType }));
      recorder!.onerror = () => reject(new Error("A exportação falhou neste navegador."));
    });
    // Start playback before recording, so blocked playback cannot leave a pending recorder.
    await video.play();
    recorder.start(250);
    const started = performance.now();
    source.start();
    const draw = () => { drawing.drawImage(video, 0, 0); frame = requestAnimationFrame(draw); };
    draw();
    // Hold the final frame when narration lasts longer than the source clip; never cut the speech.
    await new Promise<void>(resolve => setTimeout(resolve, Math.max(0, duration * 1000 - (performance.now() - started)) + 150));
    recorder.stop();
    const output = await finished;
    if (!output.size) throw new Error("A exportação retornou um arquivo vazio.");
    return output;
  } finally {
    cancelAnimationFrame(frame);
    if (recorder?.state === "recording") recorder.stop();
    video.pause(); video.removeAttribute("src"); video.load();
    try { source?.stop(); } catch { /* Already stopped. */ }
    source?.disconnect();
    stream?.getTracks().forEach(track => track.stop());
    await context.close();
    URL.revokeObjectURL(videoUrl);
  }
}
