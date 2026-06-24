#!/usr/bin/env node
// render_video.mjs — turn a deck + narration audio into a narrated MP4 with
// karaoke captions (the current spoken word highlights), rendered in-browser and
// captured deterministically frame-by-frame. No libass required.
//
// Usage:
//   node render_video.mjs <deck.html> <audioDir> --out final.mp4 [--fps 12] [--pad 0.4]
//
// <audioDir> is the directory containing audio/index.json (the tts.py output dir).

import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

function fail(msg) {
  process.stderr.write(`render_video: ${msg}\n`);
  process.exit(1);
}

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))));
    p.on('error', rej);
  });
}

// --- the in-page caption + seek driver (injected into the deck) -------------
const DRIVER = `
<style>
  #dv-caption{position:fixed;left:7%;right:7%;bottom:5%;margin:0 auto;max-width:86%;
    text-align:center;font-family:var(--font-body);font-size:30px;line-height:1.4;
    color:var(--text);background:rgba(2,6,23,0.55);padding:0.55em 0.9em;border-radius:14px;
    z-index:99999;opacity:0;box-shadow:0 8px 30px rgba(0,0,0,.35);}
  #dv-caption .cw{padding:0 .14em;border-radius:6px;color:#cbd5e1;}
  #dv-caption .cw.done{color:var(--text);}
  #dv-caption .cw.active{background:var(--highlight);color:#0b1020;}
</style>
<script>
(function(){
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function cap(){
    var c=document.getElementById('dv-caption');
    if(!c){c=document.createElement('div');c.id='dv-caption';document.body.appendChild(c);}
    return c;
  }
  function build(s){
    var c=cap();
    if(!s.words||!s.words.length){c.innerHTML='';c.style.opacity=0;return;}
    c.style.opacity=1;
    c.innerHTML=s.words.map(function(w){return '<span class="cw">'+esc(w.text)+'</span>';}).join(' ');
  }
  window.__dvSetup=function(tl){window.__TL=tl;window.__cur=-1;cap();};
  window.__dvSeek=function(t){
    var tl=window.__TL||[];var s=tl.length?tl[0]:null;
    for(var i=0;i<tl.length;i++){ if(t>=tl[i].start) s=tl[i]; else break; }
    if(!s) return -1;
    if(s.index!==window.__cur){ window.__cur=s.index; if(window.Reveal) window.Reveal.slide(s.index,0,0); build(s); }
    var c=cap();
    if(!s.words||!s.words.length){ c.style.opacity=0; return s.index; }
    c.style.opacity=1;
    var spans=c.querySelectorAll('.cw');
    for(var j=0;j<s.words.length;j++){
      var el=spans[j]; if(!el) continue; var w=s.words[j];
      var active = t>=w.gStart && t<w.gEnd;
      var done = t>=w.gEnd;
      el.className='cw'+(active?' active':'')+(done?' done':'');
    }
    return s.index;
  };
})();
</script>
`;

async function loadSlides(audioBase) {
  const indexPath = join(audioBase, 'audio', 'index.json');
  if (!existsSync(indexPath)) fail(`audio index not found: ${indexPath}. Run tts.py first.`);
  const idx = JSON.parse(await readFile(indexPath, 'utf8'));
  return idx.slides;
}

async function buildAudio(audioBase, slides, pad, segDir, outWav) {
  await rm(segDir, { recursive: true, force: true });
  await mkdir(segDir, { recursive: true });
  const segPaths = [];
  for (const s of slides) {
    const seg = join(segDir, `seg_${String(s.index).padStart(3, '0')}.wav`);
    const total = (s.duration + pad).toFixed(3);
    if (s.mp3) {
      // narration + trailing silence (apad), trimmed to exact length
      await run('ffmpeg', ['-y', '-i', join(audioBase, s.mp3), '-af', `apad=pad_dur=${pad}`,
        '-t', total, '-ar', '44100', '-ac', '2', seg]);
    } else {
      await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', total, seg]);
    }
    segPaths.push(seg);
  }
  const listPath = join(segDir, 'list.txt');
  await writeFile(listPath, segPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-ar', '44100', '-ac', '2', outWav]);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      fps: { type: 'string' },
      pad: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' }
    }
  });
  const deckPath = positionals[0];
  const audioBase = positionals[1];
  if (!deckPath || !audioBase) fail('usage: render_video.mjs <deck.html> <audioDir> --out final.mp4 [--fps 12] [--pad 0.4]');
  if (!existsSync(deckPath)) fail(`deck not found: ${deckPath}`);

  const fps = parseInt(values.fps || '12', 10);
  const pad = parseFloat(values.pad || '0.4');
  const width = parseInt(values.width || '1280', 10);
  const height = parseInt(values.height || '720', 10);
  const outPath = resolve(values.out || 'final.mp4');
  const workDir = join(dirname(outPath), '_video');
  const framesDir = join(workDir, 'frames');
  const segDir = join(workDir, 'audio');
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  // Timeline (with per-slide pad folded into the global clock).
  const slides = await loadSlides(audioBase);
  const timeline = [];
  let cursor = 0;
  for (const s of slides) {
    const start = cursor;
    let words = [];
    if (s.words) {
      const w = JSON.parse(await readFile(join(audioBase, s.words), 'utf8'));
      words = w.map((x) => ({ text: x.text, gStart: +(start + x.start).toFixed(3), gEnd: +(start + x.end).toFixed(3) }));
    }
    timeline.push({ index: s.index, start: +start.toFixed(3), words });
    cursor = start + s.duration + pad;
  }
  const totalDuration = cursor;
  const totalFrames = Math.ceil(totalDuration * fps);
  process.stdout.write(`render_video: ${slides.length} slides, ${totalDuration.toFixed(1)}s, ${totalFrames} frames @ ${fps}fps\n`);

  // Inject the caption driver into a sibling video-deck HTML.
  const deckHtml = await readFile(deckPath, 'utf8');
  const videoHtml = deckHtml.replace('</body>', `${DRIVER}\n</body>`);
  const videoDeckPath = join(dirname(resolve(deckPath)), 'deck.__video.html');
  await writeFile(videoDeckPath, videoHtml, 'utf8');

  // Build the narration audio track (parallel with browser warmup below).
  const voiceover = join(segDir, 'voiceover.wav');
  const audioPromise = buildAudio(audioBase, slides, pad, segDir, voiceover);

  // Capture frames.
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(videoDeckPath).href, { waitUntil: 'load' });
    await page.waitForSelector('.reveal.ready', { timeout: 20000 });
    await page.evaluate(() => window.Reveal.configure({ transition: 'none', backgroundTransition: 'none', controls: false, progress: false, slideNumber: false }));
    await page.evaluate((tl) => window.__dvSetup(tl), timeline);
    await page.waitForTimeout(400);

    let last = -1;
    for (let f = 0; f < totalFrames; f++) {
      const t = f / fps;
      const cur = await page.evaluate((tt) => window.__dvSeek(tt), t);
      if (cur !== last) {
        last = cur;
        const hasM = await page.evaluate(() => !!document.querySelector('.reveal section.present .mermaid'));
        if (hasM) {
          await page.waitForFunction(() => {
            const m = document.querySelector('.reveal section.present .mermaid');
            const svg = m && m.querySelector('svg');
            return svg && svg.getBoundingClientRect().height > 10;
          }, { timeout: 8000 }).catch(() => {});
        }
      }
      await page.screenshot({ path: join(framesDir, `f_${String(f).padStart(6, '0')}.png`), type: 'png' });
    }
  } finally {
    await browser.close();
  }

  await audioPromise;
  await rm(videoDeckPath, { force: true });

  // Mux frames + narration into the final MP4.
  await mkdir(dirname(outPath), { recursive: true });
  await run('ffmpeg', ['-y',
    '-framerate', String(fps), '-i', join(framesDir, 'f_%06d.png'),
    '-i', voiceover,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '160k', '-shortest', outPath]);

  process.stdout.write(`\u2713 video written: ${outPath}\n`);
}

main().catch((e) => fail(e.stack || e.message));
