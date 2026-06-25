// deck.mjs — slide-spec -> reveal.js HTML rendering.

/** HTML-escape a string. */
export function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip leading/trailing punctuation for the word manifest (matching aid). */
function stripPunct(token) {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * Wrap each word of `text` in <span class="w" data-w="i"> for later karaoke
 * highlighting. Whitespace is preserved. `ctx` carries the running counter,
 * the current slide index, and the collected word manifest.
 */
export function spanWords(text, ctx) {
  if (text == null || text === '') return '';
  const parts = String(text).split(/(\s+)/);
  let out = '';
  for (const part of parts) {
    if (part === '' || /^\s+$/.test(part)) {
      out += part;
      continue;
    }
    const i = ctx.counter++;
    ctx.words.push({ i, slide: ctx.slide, word: stripPunct(part) });
    out += `<span class="w" data-w="${i}">${esc(part)}</span>`;
  }
  return out;
}

const TYPE_LAYOUT = {
  cover: 'title',
  problem: 'statement',
  users: 'statement',
  insight: 'statement',
  solution: 'split',
  how: 'diagram',
  features: 'cards',
  results: 'stat',
  next: 'list',
  cta: 'closing',
  team: 'cards',
  appendix: 'list',
  content: 'statement',
  statement: 'statement'
};

const KICKER = {
  problem: 'The Problem',
  users: 'Who It\u2019s For',
  insight: 'The Insight',
  solution: 'The Solution',
  how: 'How It Works',
  features: 'Highlights',
  results: 'Results',
  next: 'What\u2019s Next',
  cta: 'Get Started',
  team: 'The Team',
  appendix: 'Appendix'
};

function hasVisual(slide) {
  return slide.visual && slide.visual.type && slide.visual.type !== 'none';
}

/** Derive a layout from explicit override -> type -> available content. */
export function pickLayout(slide) {
  let l = slide.layout || TYPE_LAYOUT[slide.type] || 'statement';
  if (l === 'split' && !hasVisual(slide)) l = 'statement';
  if (l === 'showcase' && !hasVisual(slide)) l = 'statement';
  if (l === 'diagram' && !hasVisual(slide)) l = slide.bullets?.length ? 'list' : 'statement';
  if (l === 'stat' && !slide.stat) l = 'statement';
  if (l === 'cards' && !(slide.cards && slide.cards.length)) l = slide.bullets?.length ? 'list' : 'statement';
  return l;
}

function kickerHtml(slide) {
  const label = slide.eyebrow || KICKER[slide.type];
  return label ? `<span class="kicker">${esc(label)}</span>` : '';
}

function visualHtml(slide, ctx) {
  if (!hasVisual(slide)) return '';
  const v = slide.visual;
  if (v.type === 'image' && v.src) {
    return `<img src="${esc(v.src)}" alt="${esc(v.alt || '')}">`;
  }
  if (v.type === 'flow' && Array.isArray(v.steps)) {
    const items = v.steps.map((s, i) => {
      const arrow = i < v.steps.length - 1 ? '<div class="flow-arrow">\u2192</div>' : '';
      return `<div class="flow-step"><span class="flow-label">${spanWords(s, ctx)}</span></div>${arrow}`;
    }).join('');
    return `<div class="flow">${items}</div>`;
  }
  if (v.type === 'mermaid' && v.code) {
    ctx.useMermaid = true;
    return `<pre class="mermaid">${esc(v.code)}</pre>`;
  }
  return '';
}

function bulletsHtml(items, ctx) {
  if (!items || !items.length) return '';
  const lis = items.map((b) => `<li>${spanWords(b, ctx)}</li>`).join('\n        ');
  return `<ul class="bullets">\n        ${lis}\n      </ul>`;
}

function quoteHtml(slide, ctx) {
  if (!slide.quote || !slide.quote.text) return '';
  const attr = slide.quote.attribution
    ? `<span class="attribution">${esc(slide.quote.attribution)}</span>`
    : '';
  return `<blockquote class="quote">${spanWords(slide.quote.text, ctx)}${attr}</blockquote>`;
}

function notesHtml(slide) {
  const text = slide.narration || slide.notes;
  return text ? `\n      <aside class="notes">${esc(text)}</aside>` : '';
}

/** Render a single slide spec to a reveal.js <section>. */
export function renderSlide(slide, slideIndex, ctx) {
  ctx.slide = slideIndex;
  const layout = pickLayout(slide);
  const k = kickerHtml(slide);
  const rule = '<hr class="accent-rule">';
  // Lazy span helpers: spanWords runs only for text that is actually emitted,
  // so data-w indices stay contiguous and match the word manifest exactly.
  const h1 = () => (slide.title ? `<h1>${spanWords(slide.title, ctx)}</h1>` : '');
  const h2 = () => (slide.title ? `<h2>${spanWords(slide.title, ctx)}</h2>` : '');
  const bodyP = () => (slide.body ? `<p class="body">${spanWords(slide.body, ctx)}</p>` : '');
  const subP = () => (slide.subtitle ? `<p class="subtitle">${spanWords(slide.subtitle, ctx)}</p>` : '');
  let inner = '';

  switch (layout) {
    case 'title':
      inner = `<div>
      ${k}
      ${h1()}
      ${subP()}
      ${bodyP()}
    </div>`;
      break;

    case 'statement':
      inner = `${k}
    ${h2()}
    ${rule}
    ${bodyP()}
    ${bulletsHtml(slide.bullets, ctx)}
    ${quoteHtml(slide, ctx)}`;
      break;

    case 'split':
      inner = `<div class="split">
      <div class="text">
        ${k}
        ${h2()}
        ${rule}
        ${bodyP()}
        ${bulletsHtml(slide.bullets, ctx)}
      </div>
      <div class="visual">${visualHtml(slide, ctx)}</div>
    </div>`;
      break;

    case 'cards': {
      const head = `${k}
    ${h2()}
    ${rule}`;
      const cards = (slide.cards || [])
        .map((c) => {
          const icon = c.icon ? `<span class="icon">${esc(c.icon)}</span>` : '';
          const ch = c.heading ? `<h3>${spanWords(c.heading, ctx)}</h3>` : '';
          const ct = c.text ? `<p>${spanWords(c.text, ctx)}</p>` : '';
          return `<div class="card">${icon}${ch}${ct}</div>`;
        })
        .join('\n      ');
      inner = `${head}
    <div class="cards">
      ${cards}
    </div>`;
      break;
    }

    case 'stat': {
      const s = slide.stat || {};
      const head = `${k}
    ${h2()}
    ${rule}`;
      inner = `${head}
    <div class="stat-value">${esc(s.value || '')}</div>
    <div class="stat-label">${spanWords(s.label || '', ctx)}</div>
    ${quoteHtml(slide, ctx)}`;
      break;
    }

    case 'diagram':
      inner = `${k}
    ${h2()}
    ${rule}
    <div class="diagram">${visualHtml(slide, ctx)}</div>
    ${bodyP()}`;
      break;

    case 'showcase':
      inner = `<div class="sc-split">
      <div class="sc-text">
        ${k}
        ${h2()}
        ${rule}
        ${bodyP()}
      </div>
      <div class="sc-shot">${visualHtml(slide, ctx)}</div>
    </div>`;
      break;

    case 'list':
      inner = `${k}
    ${h2()}
    ${rule}
    ${bodyP()}
    ${bulletsHtml(slide.bullets, ctx)}`;
      break;

    case 'closing':
      inner = `${h2()}
    ${bodyP()}
    ${slide.cta ? `<span class="cta-step">${esc(slide.cta)}</span>` : ''}`;
      break;

    default:
      inner = `${k}${h2()}${rule}${bodyP()}`;
  }

  const id = slide.id ? ` id="${esc(slide.id)}"` : '';
  return `      <section class="layout-${layout}" data-slide="${slideIndex}"${id}>
    ${inner}${notesHtml(slide)}
  </section>`;
}

/** Render all slides; returns { html, words, useMermaid }. */
export function renderSlides(slides) {
  const ctx = { counter: 0, words: [], slide: 0, useMermaid: false };
  const html = slides.map((s, i) => renderSlide(s, i, ctx)).join('\n');
  return { html, words: ctx.words, useMermaid: ctx.useMermaid };
}
