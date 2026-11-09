import assert from "node:assert/strict";
import test from "node:test";
import {
  downloadDirectMp3,
  hasMp3Signature,
  isMp3ContentType,
  MAX_AUDIO_DOWNLOAD_BYTES,
  parseDirectAudioUrl,
} from "../src/lib/audio-download.ts";

test("accepts HTTPS direct URLs and rejects unsafe protocols or embedded credentials", () => {
  assert.equal(parseDirectAudioUrl(" https://cdn.example.com/music.mp3?token=abc ").hostname, "cdn.example.com");
  assert.throws(() => parseDirectAudioUrl("http://cdn.example.com/music.mp3"), /HTTPS/);
  assert.throws(() => parseDirectAudioUrl("https://user:pass@cdn.example.com/music.mp3"), /HTTPS/);
});

test("identifies MP3 from MIME type or direct .mp3 path", () => {
  assert.equal(isMp3ContentType("audio/mpeg; charset=binary", "/download"), true);
  assert.equal(isMp3ContentType(null, "/music.MP3"), true);
  assert.equal(isMp3ContentType("text/html", "/watch"), false);
});

test("recognizes ID3 tags and MPEG audio frame headers", () => {
  assert.equal(hasMp3Signature(new Uint8Array([0x49, 0x44, 0x33, 0x04])), true);
  assert.equal(hasMp3Signature(new Uint8Array([0xff, 0xfb, 0x90, 0x64])), true);
  assert.equal(hasMp3Signature(new Uint8Array([0x00, 0x00, 0x00])), false);
});

test("downloads a direct MP3 without credentials and gives it the requested filename", async () => {
  let requestUrl = "";
  let requestInit;
  const { blob, filename } = await downloadDirectMp3("https://cdn.example.com/music.mp3", async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]), {
      headers: { "content-type": "audio/mpeg" },
    });
  });

  assert.equal(requestUrl, "https://cdn.example.com/music.mp3");
  assert.equal(requestInit.credentials, "omit");
  assert.equal(blob.type, "audio/mpeg");
  assert.equal(filename, "audio.mp3");
});

test("rejects non-MP3 responses and oversized downloads", async () => {
  await assert.rejects(
    downloadDirectMp3("https://cdn.example.com/file", async () => new Response("<html>", {
      headers: { "content-type": "text/html" },
    })),
    /não retornou um arquivo MP3/,
  );

  await assert.rejects(
    downloadDirectMp3("https://cdn.example.com/music.mp3", async () => new Response(null, {
      headers: { "content-type": "audio/mpeg", "content-length": String(MAX_AUDIO_DOWNLOAD_BYTES + 1) },
    })),
    /excede o limite de 50 MB/,
  );
});
