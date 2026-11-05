import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFfmpegArguments } from '../scripts/generate-video-demo.mjs';

test('renderizador local define exatamente 6 segundos, 9:16 e MP4 sem áudio ou IA', () => {
  const args = buildFfmpegArguments('/authorized/ana.webp', '/tmp/demo.mp4');
  assert.deepEqual(args.slice(args.indexOf('-frames:v'), args.indexOf('-frames:v') + 2), ['-frames:v', '180']);
  assert.match(args[args.indexOf('-vf') + 1], /scale=1080:1920/);
  assert.match(args[args.indexOf('-vf') + 1], /format=yuv420p/);
  assert.ok(args.includes('-an'));
  assert.ok(args.includes('libx264'));
  assert.ok(args.includes('-f'));
  assert.ok(args.includes('mp4'));
  assert.ok(args.some((value) => value.startsWith('comment=Still image of Ana; no AI video generation')));
  assert.equal(args.at(-1), '/tmp/demo.mp4');
});
