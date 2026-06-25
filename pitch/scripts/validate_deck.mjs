#!/usr/bin/env node
// validate_deck.mjs — verify that a rendered deck is structurally sound.
//
// Usage:
//   node validate_deck.mjs <deck.html> [--manifest <deck.words.json>]
//
// Checks:
//   - deck contains at least one <section>
//   - no unresolved {{PLACEHOLDER}} tokens remain
//   - word manifest exists and matches the number of data-w spans
//   - manifest slide count matches the slide count

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

function fail(msg) {
  process.stderr.write(`validate_deck: ${msg}\n`);
  process.exit(1);
}

function countMatches(text, regex) {
  return (text.match(regex) || []).length;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { manifest: { type: 'string', short: 'm' } }
  });

  const deckPath = positionals[0];
  if (!deckPath) fail('missing <deck.html>. Usage: validate_deck.mjs <deck.html> [--manifest <deck.words.json>]');

  const deckFile = resolve(deckPath);
  if (!existsSync(deckFile)) fail(`deck not found: ${deckFile}`);

  const html = await readFile(deckFile, 'utf8');
  const htmlWithoutComments = html
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/\/\*([\s\S]*?)\*\//g, '');
  const slideCount = countMatches(htmlWithoutComments, /<section\b/g);
  const placeholderCount = countMatches(htmlWithoutComments, /\{\{[^}]+\}\}/g);
  const wordSpanCount = countMatches(htmlWithoutComments, /<span\b[^>]*data-w=/g);

  const manifestPath = resolve(values.manifest || deckFile.replace(/\.html?$/i, '') + '.words.json');
  if (!existsSync(manifestPath)) fail(`manifest not found: ${manifestPath}`);

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const manifestWordCount = Array.isArray(manifest.words) ? manifest.words.length : 0;
  const manifestSlideCount = Number.isInteger(manifest.slides) ? manifest.slides : 0;

  const issues = [];
  if (slideCount === 0) issues.push('no <section> slides detected');
  if (placeholderCount > 0) issues.push(`found ${placeholderCount} unresolved placeholder token(s)`);
  if (wordSpanCount === 0) issues.push('no data-w spans found');
  if (manifestSlideCount !== slideCount) issues.push(`manifest slides (${manifestSlideCount}) != slide count (${slideCount})`);
  if (manifestWordCount !== wordSpanCount) issues.push(`manifest words (${manifestWordCount}) != word spans (${wordSpanCount})`);

  if (issues.length) {
    for (const issue of issues) process.stderr.write(`validate_deck: ${issue}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `✓ deck validated: ${deckFile}\n` +
    `  slides: ${slideCount}, words: ${wordSpanCount}, manifest: ${manifestPath}\n`
  );
}

main().catch((e) => fail(e.stack || e.message));
