#!/usr/bin/env node
// capture_demo.mjs — run a project's UI and capture a live demo: per-route
// screenshots + a screen recording of a scroll/navigation flow.
//
// Usage:
//   node capture_demo.mjs <projectDir> --out <dir> [options]
//   node capture_demo.mjs --url http://localhost:3000 --out <dir> [options]
//
// Options:
//   --url <baseUrl>      capture a already-running/live site (skip serving)
//   --routes a,b,c       explicit routes/paths to capture (relative to base)
//   --max-routes N       cap auto-discovered routes (default 6)
//   --record true|false  also record a screen-recording flow (default true)
//   --width / --height   viewport (default 1440x900)
//   --port N             server port (default: a free port)
//   --wait-selector S    wait for this CSS selector on each route before shooting
//
// Detects a UI: a known framework dev script (astro/next/vite/nuxt/...) when
// node_modules exists, else a static site (serves the folder). Outputs:
//   <dir>/demo/shots/NN-<route>.png   per-route screenshots (viewport + full page)
//   <dir>/demo/demo.mp4               screen recording of the flow (if --record)
//   <dir>/demo/manifest.json          { baseUrl, routes, shots, video }

import { mkdir, writeFile, rm, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

function log(m) { process.stderr.write(`capture_demo: ${m}\n`); }
function out(m) { process.stdout.write(m + '\n'); }

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', rej);
    srv.listen(0, () => { const p = srv.address().port; srv.close(() => res(p)); });
  });
}

function sh(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'], ...opts });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${c}: ${err.slice(-300)}`))));
    p.on('error', rej);
  });
}

async function waitReady(url, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.status < 500) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Known framework dev servers (used only if node_modules is present).
const FRAMEWORKS = [
  { dep: 'astro', script: 'dev', port: 4321 },
  { dep: 'next', script: 'dev', port: 3000 },
  { dep: 'nuxt', script: 'dev', port: 3000 },
  { dep: 'vite', script: 'dev', port: 5173 },
  { dep: '@sveltejs/kit', script: 'dev', port: 5173 },
  { dep: 'react-scripts', script: 'start', port: 3000 },
  { dep: 'gatsby', script: 'develop', port: 8000 }
];

async function detectServer(projectDir) {
  const pkgPath = join(projectDir, 'package.json');
  let pkg = null;
  if (existsSync(pkgPath)) {
    try { pkg = JSON.parse(await readFile(pkgPath, 'utf8')); } catch { /* ignore */ }
  }
  const hasNodeModules = existsSync(join(projectDir, 'node_modules'));
  if (pkg && hasNodeModules) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const fw of FRAMEWORKS) {
      if (deps[fw.dep] && pkg.scripts && pkg.scripts[fw.script]) {
        return { mode: 'framework', fw, script: fw.script };
      }
    }
  }
  // Static fallback: any .html present?
  const entries = await readdir(projectDir).catch(() => []);
  if (entries.includes('index.html') || entries.some((e) => e.endsWith('.html'))) {
    return { mode: 'static' };
  }
  return { mode: 'static' }; // best effort
}

function parsePortFromLog(buf) {
  const m = buf.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

async function startServer(projectDir, detect, port) {
  if (detect.mode === 'static') {
    // Serve the folder with Python's http.server (no extra deps).
    const child = spawn('python3', ['-m', 'http.server', String(port), '--directory', projectDir],
      { stdio: ['ignore', 'ignore', 'ignore'], detached: true });
    return { child, baseUrl: `http://localhost:${port}/` };
  }
  // framework: run the dev script; many bind to their default port, but detect from logs.
  const child = spawn('npm', ['run', detect.script, '--', '--port', String(port)],
    { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let logbuf = '';
  let detectedPort = null;
  const onData = (d) => { logbuf += d.toString(); const p = parsePortFromLog(logbuf); if (p) detectedPort = p; };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  // Give it a moment to print its URL.
  await new Promise((r) => setTimeout(r, 3000));
  const finalPort = detectedPort || port || detect.fw.port;
  return { child, baseUrl: `http://localhost:${finalPort}/` };
}

function stopServer(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* group */ }
  try { child.kill('SIGTERM'); } catch { /* single */ }
}

function routeName(route) {
  const clean = route.replace(/^\//, '').replace(/[/?#]+/g, '-').replace(/\.html?$/i, '').replace(/[^a-z0-9_-]/gi, '');
  return clean || 'home';
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = Math.max(200, Math.floor(window.innerHeight * 0.6));
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        y += step;
        if (y >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          setTimeout(resolve, 300);
        }
      }, 220);
    });
  });
}

async function discoverRoutes(page, baseUrl, max) {
  const links = await page.evaluate((origin) => {
    const set = new Set(['/']);
    document.querySelectorAll('a[href]').forEach((a) => {
      try {
        const u = new URL(a.getAttribute('href'), location.href);
        if (u.origin !== location.origin) return;
        if (/\.(zip|pdf|png|jpg|jpeg|svg|mp4|js|css)$/i.test(u.pathname)) return;
        set.add(u.pathname + u.search);
      } catch { /* skip */ }
    });
    return [...set];
  }, baseUrl);
  return links.slice(0, max);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      url: { type: 'string' },
      routes: { type: 'string' },
      'max-routes': { type: 'string' },
      record: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' },
      port: { type: 'string' },
      'wait-selector': { type: 'string' }
    }
  });

  const projectDir = positionals[0] ? resolve(positionals[0]) : null;
  if (!values.out) { log('missing --out <dir>'); process.exit(1); }
  if (!projectDir && !values.url) { log('provide <projectDir> or --url'); process.exit(1); }

  const outDir = resolve(values.out);
  const demoDir = join(outDir, 'demo');
  const shotsDir = join(demoDir, 'shots');
  const videoDir = join(demoDir, '_rec');
  await rm(demoDir, { recursive: true, force: true });
  await mkdir(shotsDir, { recursive: true });

  const width = parseInt(values.width || '1440', 10);
  const height = parseInt(values.height || '900', 10);
  const maxRoutes = parseInt(values['max-routes'] || '6', 10);
  const record = values.record !== 'false';
  const waitSel = values['wait-selector'] || null;

  // --- bring up a server (unless --url) ---
  let baseUrl = values.url;
  let server = null;
  if (!baseUrl) {
    const detect = await detectServer(projectDir);
    const port = parseInt(values.port || '', 10) || (await freePort());
    log(`detected ${detect.mode}${detect.fw ? ' (' + detect.fw.dep + ')' : ''}; starting server on :${port}`);
    server = await startServer(projectDir, detect, port);
    baseUrl = server.baseUrl;
    const ready = await waitReady(baseUrl);
    if (!ready) { stopServer(server.child); log(`server did not become ready at ${baseUrl}`); process.exit(1); }
  }
  log(`base URL: ${baseUrl}`);

  const browser = await chromium.launch();
  const manifest = { baseUrl, routes: [], shots: [], video: null };
  try {
    // --- routes ---
    let routes;
    if (values.routes) {
      routes = values.routes.split(',').map((r) => r.trim()).filter(Boolean);
    } else {
      const p = await browser.newPage({ viewport: { width, height } });
      await p.goto(baseUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      routes = await discoverRoutes(p, baseUrl, maxRoutes);
      await p.close();
    }
    manifest.routes = routes;
    log(`routes (${routes.length}): ${routes.join(', ')}`);

    // --- screenshots ---
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    let i = 0;
    for (const route of routes) {
      const url = new URL(route, baseUrl).href;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      } catch {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      }
      if (waitSel) await page.waitForSelector(waitSel, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      await autoScroll(page);
      const name = `${String(i + 1).padStart(2, '0')}-${routeName(route)}`;
      const viewShot = join(shotsDir, `${name}.png`);
      const fullShot = join(shotsDir, `${name}-full.png`);
      await page.screenshot({ path: viewShot });
      await page.screenshot({ path: fullShot, fullPage: true }).catch(() => {});
      manifest.shots.push({ route, viewport: viewShot, full: fullShot });
      out(`\u2713 shot ${name}`);
      i++;
    }
    await page.close();

    // --- screen recording of a flow ---
    if (record) {
      const ctx = await browser.newContext({
        viewport: { width, height },
        recordVideo: { dir: videoDir, size: { width, height } }
      });
      const rp = await ctx.newPage();
      for (const route of routes) {
        const url = new URL(route, baseUrl).href;
        try { await rp.goto(url, { waitUntil: 'networkidle', timeout: 30000 }); }
        catch { await rp.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {}); }
        if (waitSel) await rp.waitForSelector(waitSel, { timeout: 6000 }).catch(() => {});
        await rp.waitForTimeout(900);
        await autoScroll(rp);
        await rp.waitForTimeout(500);
      }
      await rp.close();
      await ctx.close(); // finalizes the .webm
      // find the produced webm and convert to mp4
      const recs = (await readdir(videoDir).catch(() => [])).filter((f) => f.endsWith('.webm'));
      if (recs.length) {
        const webm = join(videoDir, recs[0]);
        const mp4 = join(demoDir, 'demo.mp4');
        await sh('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
        manifest.video = mp4;
        out(`\u2713 demo recording -> ${mp4}`);
      }
    }
  } finally {
    await browser.close();
    if (server) stopServer(server.child);
    await rm(videoDir, { recursive: true, force: true }).catch(() => {});
  }

  await writeFile(join(demoDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  out(`\u2713 demo captured: ${manifest.shots.length} shots${manifest.video ? ' + recording' : ''} -> ${demoDir}`);
}

main().catch((e) => { log(e.stack || e.message); process.exit(1); });
