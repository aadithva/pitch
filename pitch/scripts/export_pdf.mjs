#!/usr/bin/env node
// export_pdf.mjs — render a deck.html to a PDF (and optionally per-slide PNGs).
//
// Usage:
//   node export_pdf.mjs <deck.html> --out <deck.pdf> [--png <dir>] [--width 1280] [--height 720]
//
// Strategy: screenshot each slide headlessly (capture.mjs), then assemble the
// PNGs into a one-slide-per-page PDF via Chromium's printer. This is robust
// (no reliance on reveal's print-pdf mode) and reuses the video capture path.

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { captureDeck } from './lib/capture.mjs';

function fail(msg) {
  process.stderr.write(`export_pdf: ${msg}\n`);
  process.exit(1);
}

async function pngsToPdf(shots, width, height, outPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const imgs = shots
      .map((b) => `<img src="data:image/png;base64,${b.toString('base64')}">`)
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: ${width}px ${height}px; margin: 0; }
      html, body { margin: 0; padding: 0; }
      img { display: block; width: ${width}px; height: ${height}px; page-break-after: always; }
    </style></head><body>${imgs}</body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path: outPath,
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      preferCSSPageSize: true
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      png: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' }
    }
  });

  const deckPath = positionals[0];
  if (!deckPath) fail('missing <deck.html>. Usage: export_pdf.mjs <deck.html> --out <deck.pdf> [--png <dir>]');
  if (!existsSync(deckPath)) fail(`deck not found: ${deckPath}`);

  const width = parseInt(values.width || '1280', 10);
  const height = parseInt(values.height || '720', 10);
  const outPath = resolve(values.out || deckPath.replace(/\.html?$/i, '.pdf'));

  const shots = await captureDeck(deckPath, { width, height });

  if (values.png) {
    const pngDir = resolve(values.png);
    await mkdir(pngDir, { recursive: true });
    await Promise.all(
      shots.map((b, i) => writeFile(join(pngDir, `slide_${String(i + 1).padStart(3, '0')}.png`), b))
    );
    process.stdout.write(`\u2713 ${shots.length} PNG frames -> ${pngDir}\n`);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await pngsToPdf(shots, width, height, outPath);
  process.stdout.write(`\u2713 PDF written: ${outPath} (${shots.length} slides)\n`);
}

main().catch((e) => fail(e.stack || e.message));
