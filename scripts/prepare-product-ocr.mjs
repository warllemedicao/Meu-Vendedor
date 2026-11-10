import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const destination = resolve('public/product-ocr');
const worker = dirname(require.resolve('tesseract.js/package.json'));
const core = dirname(require.resolve('tesseract.js-core/package.json'));
const language = dirname(require.resolve('@tesseract.js-data/por/package.json'));
await mkdir(join(destination, 'core'), { recursive: true });
await mkdir(join(destination, 'lang'), { recursive: true });
await copyFile(join(worker, 'dist/worker.min.js'), join(destination, 'worker.min.js'));
for (const name of await readdir(core)) {
  if (name.endsWith('.wasm') || name.endsWith('.wasm.js')) await copyFile(join(core, name), join(destination, 'core', name));
}
await copyFile(join(language, '4.0.0/por.traineddata.gz'), join(destination, 'lang/por.traineddata.gz'));
await copyFile(join(worker, 'LICENSE.md'), join(destination, 'LICENSE-tesseract.txt'));
console.log('OCR worker, WebAssembly and Portuguese data prepared locally.');
