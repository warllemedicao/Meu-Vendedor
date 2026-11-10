// Deterministic crop of the exact, documented Flamengo garment; no generation.
// The previous orange-dress RGB threshold was rejected and is not a preset.
import sharp from "sharp";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const root = "/tmp/mv-video-research";
const source = await readFile(`${root}/flamengo.jpg`);
const expected = "73ccd4990382d1e0efb4ca768ec79afa8f948e502e5aff0687f32d6a286465e7";
if (createHash("sha256").update(source).digest("hex") !== expected) throw new Error("product_sha256_mismatch");
const polygon="188,7 202,2 328,7 345,28 404,56 429,110 477,238 414,276 380,258 372,532 137,532 122,268 88,262 48,241 94,86 124,56 182,28";
const mask=Buffer.from(`<svg width="532" height="532"><polygon points="${polygon}" fill="white"/></svg>`);
const cutout=await sharp(source).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
await sharp(cutout).flatten({background:'#ffffff'}).png().toFile(`${root}/garment-flamengo.png`);
const prepared = await readFile(`${root}/garment-flamengo.png`);
await writeFile(`${root}/garment-flamengo-manifest.json`,JSON.stringify({source:"https://cf.shopee.com.br/file/br-11134207-820lk-mv387fqpgs8zac",sourceSha256:expected,preparedSha256:createHash("sha256").update(prepared).digest("hex"),method:"Manual visible garment polygon; original RGB pixels on white; no generative edit",polygon},null,2));
console.log("Prepared original Flamengo garment pixels for visual review.");
