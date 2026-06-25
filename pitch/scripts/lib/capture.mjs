// capture.mjs — headless capture of a reveal.js deck, slide by slide.
// Reused by export_pdf.mjs (Phase 1) and the video renderer (Phase 4).

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

/**
 * Open a deck.html headlessly and screenshot each slide.
 * @returns {Promise<Buffer[]>} one PNG buffer per slide, in order.
 */
export async function captureDeck(deckPath, opts = {}) {
  const { width = 1280, height = 720, pause = 400, scale = 2 } = opts;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: scale
    });
    await page.goto(pathToFileURL(deckPath).href, { waitUntil: 'load' });
    await page.waitForSelector('.reveal.ready', { timeout: 20000 });
    // Disable slide transitions during capture so we never screenshot a slide
    // that is still animating into place (which would shift/clip its content).
    // The live deck keeps its transitions; this only affects headless capture.
    await page.evaluate(() =>
      window.Reveal.configure({ transition: 'none', backgroundTransition: 'none', controls: false, progress: false, slideNumber: false })
    );
    // Give late assets (web fonts, mermaid from CDN) a moment to settle.
    await page.waitForTimeout(600);

    const total = await page.evaluate(() => window.Reveal.getTotalSlides());
    const shots = [];
    for (let i = 0; i < total; i++) {
      await page.evaluate((idx) => window.Reveal.slide(idx, 0, 0), i);
      await page.waitForTimeout(pause);
      // If the visible slide has a mermaid diagram, wait for it to render.
      const hasMermaid = await page.evaluate(
        () => !!document.querySelector('.reveal section.present .mermaid')
      );
      if (hasMermaid) {
        await page
          .waitForFunction(
            () => {
              const m = document.querySelector('.reveal section.present .mermaid');
              if (!m) return true;
              const svg = m.querySelector('svg');
              return svg && svg.getBoundingClientRect().height > 10;
            },
            { timeout: 8000 }
          )
          .catch(() => {});
        await page.waitForTimeout(350);
      }
      shots.push(await page.screenshot({ type: 'png' }));
    }
    return shots;
  } finally {
    await browser.close();
  }
}
