#!/usr/bin/env node
// splice_demo.mjs — insert a screen-recording (demo.mp4) into a narrated deck
// video as a "live demo" section. Normalizes the recording to the deck's
// resolution/fps, gives it a short spoken intro (optional), and concatenates.
//
// Usage:
//   node splice_demo.mjs <deckVideo.mp4> <demo.mp4> --out final.mp4
//        [--at <sec>] [--narration "text"] [--voice en-US-AriaNeural]
//        [--max-demo <sec>]
//
// --at <sec>   insert at this timestamp (split the deck video); default: append.
//              Pick a slide boundary (silent pad gap) for a clean cut.

import { mkdir, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VENV_EDGE = join(__dirname, '..', '.venv', 'bin', 'edge-tts');

function fail(m) { process.stderr.write(`splice_demo: ${m}\n`); process.exit(1); }

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${c}: ${err.slice(-400)}`))));
    p.on('error', rej);
  });
}

function ffprobeJson(file) {
  return new Promise((res, rej) => {
    const p = spawn('ffprobe', ['-v', 'error', '-print_format', 'json',
      '-show_streams', '-show_format', file], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => { try { res(JSON.parse(out)); } catch (e) { rej(e); } });
    p.on('error', rej);
  });
}

function vfNormalize(w, h, fps) {
  return `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${fps},format=yuv420p`;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      at: { type: 'string' },
      narration: { type: 'string' },
      voice: { type: 'string' },
      'max-demo': { type: 'string' }
    }
  });
  const deckVideo = positionals[0];
  const demo = positionals[1];
  if (!deckVideo || !demo) fail('usage: splice_demo.mjs <deckVideo.mp4> <demo.mp4> --out final.mp4 [--at <sec>] [--narration "..."]');
  if (!existsSync(deckVideo)) fail(`deck video not found: ${deckVideo}`);
  if (!existsSync(demo)) fail(`demo video not found: ${demo}`);

  const outPath = resolve(values.out || 'final.mp4');
  const work = join(dirname(outPath), '_splice');
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });

  // Match the deck video's resolution + fps.
  const probe = await ffprobeJson(deckVideo);
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const W = v.width, H = v.height;
  const [fn, fd] = (v.r_frame_rate || '12/1').split('/').map(Number);
  const FPS = Math.max(1, Math.round(fn / (fd || 1)));

  // Demo duration (optionally capped).
  const demoProbe = await ffprobeJson(demo);
  let demoDur = parseFloat(demoProbe.format.duration) || 10;
  const maxDemo = parseFloat(values['max-demo'] || '');
  if (maxDemo && maxDemo < demoDur) demoDur = maxDemo;

  // 1) Normalized silent demo video.
  const demoV = join(work, 'demo_v.mp4');
  await run('ffmpeg', ['-y', '-i', demo, '-t', String(demoDur),
    '-vf', vfNormalize(W, H, FPS), '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', demoV]);

  // 2) Demo audio: spoken intro (padded to demo length) or silence.
  const demoA = join(work, 'demo_a.wav');
  if (values.narration && existsSync(VENV_EDGE)) {
    const narr = join(work, 'narr.mp3');
    await run(VENV_EDGE, ['--voice', values.voice || 'en-US-AriaNeural',
      '--text', values.narration, '--write-media', narr]);
    await run('ffmpeg', ['-y', '-i', narr, '-af', 'apad', '-t', String(demoDur),
      '-ar', '44100', '-ac', '2', demoA]);
  } else {
    if (values.narration) process.stderr.write('splice_demo: .venv edge-tts not found; demo will be silent.\n');
    await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-t', String(demoDur), demoA]);
  }

  // 3) Mux demo segment (video + audio), normalized.
  const demoSeg = join(work, 'demo_seg.mp4');
  await run('ffmpeg', ['-y', '-i', demoV, '-i', demoA,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-shortest', demoSeg]);

  // 4) Build the segment list (optionally split the deck at --at).
  const norm = (src, dst, extra = []) => run('ffmpeg', ['-y', ...extra, '-i', src,
    '-vf', vfNormalize(W, H, FPS), '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-ar', '44100', '-ac', '2', dst]);

  const segments = [];
  if (values.at) {
    const at = parseFloat(values.at);
    const partA = join(work, 'part_a.mp4');
    const partB = join(work, 'part_b.mp4');
    await norm(deckVideo, partA, ['-to', String(at)]);
    await norm(deckVideo, partB, ['-ss', String(at)]);
    segments.push(partA, demoSeg, partB);
  } else {
    const deckN = join(work, 'deck_n.mp4');
    await norm(deckVideo, deckN);
    segments.push(deckN, demoSeg);
  }

  // 5) Concatenate via the concat filter (uniform params guaranteed above).
  const inputs = segments.flatMap((s) => ['-i', s]);
  const n = segments.length;
  const streams = segments.map((_, i) => `[${i}:v][${i}:a]`).join('');
  await mkdir(dirname(outPath), { recursive: true });
  await run('ffmpeg', ['-y', ...inputs,
    '-filter_complex', `${streams}concat=n=${n}:v=1:a=1[v][a]`,
    '-map', '[v]', '-map', '[a]', '-r', String(FPS),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', outPath]);

  await rm(work, { recursive: true, force: true });
  process.stdout.write(`\u2713 spliced: deck + ${demoDur.toFixed(1)}s live demo -> ${outPath}\n`);
}

main().catch((e) => fail(e.stack || e.message));
