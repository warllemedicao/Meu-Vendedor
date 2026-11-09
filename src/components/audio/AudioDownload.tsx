"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download, Music2 } from "lucide-react";
import { downloadDirectMp3 } from "@/lib/audio-download";

export function AudioDownload() {
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setDownloadUrl("");
    setMessage("");
    setError("");

    try {
      const { blob } = await downloadDirectMp3(url);
      setDownloadUrl(URL.createObjectURL(blob));
      setMessage("Arquivo pronto. Clique no botão abaixo para salvar audio.mp3.");
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Não foi possível baixar este MP3.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-2xl rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Music2 className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">Link direto para MP3</h2>
          <p className="text-sm text-muted">O arquivo é baixado no seu navegador; não é enviado ao Meu Vendedor.</p>
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
        <div>
          <label htmlFor="audio-url" className="mb-1.5 block text-sm font-medium">Link do arquivo</label>
          <input
            id="audio-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://exemplo.com/audio.mp3"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          />
          <p className="mt-1.5 text-xs text-muted">Use o endereço direto do arquivo MP3, não o link de uma página de música.</p>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(event) => setAuthorized(event.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>Tenho autorização para baixar e usar este arquivo e respeito os termos do site de origem.</span>
        </label>

        <button
          type="submit"
          disabled={busy || !authorized}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden />
          {busy ? "Baixando..." : "Baixar audio.mp3"}
        </button>
      </form>

      {message && <p role="status" className="mt-4 text-sm text-primary">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download="audio.mp3"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary"
        >
          <Download className="size-4" aria-hidden />
          Salvar audio.mp3
        </a>
      )}

      <div className="mt-5 rounded-lg bg-surface-muted p-3 text-xs leading-relaxed text-muted">
        <p><strong className="text-foreground">Limites:</strong> somente URLs HTTPS diretas que entreguem MP3, até 50 MB. O servidor de origem precisa permitir acesso pelo navegador (CORS). Links de páginas/plataformas, conteúdo protegido ou DRM não são extraídos nem convertidos.</p>
      </div>
    </section>
  );
}
