// align.mjs — match timed narration words to on-slide <span data-w> words so the
// actual slide text can highlight in sync with the voiceover (Phase 4).
//
// The narration complements the slide (it doesn't repeat it verbatim), so only a
// subset of narration words appear on the slide. We highlight those meaningful
// overlaps and skip stopwords/very short words to avoid flicker on filler.

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'your', 'our', 'its', 'it\u2019s',
  'this', 'that', 'with', 'from', 'into', 'than', 'then', 'just', 'will', 'was',
  'were', 'what', 'which', 'when', 'where', 'about', 'also', 'like', 'here', 'there',
  'they', 'them', 'their', 'have', 'has', 'had', 'can', 'could', 'would', 'should',
  'who', 'why', 'how', 'all', 'any', 'one', 'two', 'too', 'get', 'got', 'let',
  'out', 'now', 'see', 'use', 'via', 'per', 'off', 'yet', 'own', 'why'
]);

/** Lowercase + strip leading/trailing punctuation (Unicode-aware). */
export function normalizeWord(s) {
  if (s == null) return '';
  return String(s).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function isMatchable(n) {
  return n.length >= 3 && !STOPWORDS.has(n);
}

/**
 * Match narration words to a slide's spans.
 * @param {Array<{i:number, word:string}>} slideSpans  on-slide words (DOM order)
 * @param {Array<{text:string, start:number, end:number}>} narrationWords  timed (slide-local seconds)
 * @param {number} slideStart  global time offset for this slide (seconds)
 * @returns {Array<{dataW:number, start:number, end:number}>}  global-time highlight events
 */
export function matchInslide(slideSpans, narrationWords, slideStart = 0) {
  const queues = new Map(); // normalized word -> queue of data-w indices (DOM order)
  for (const s of slideSpans) {
    const n = normalizeWord(s.word);
    if (!isMatchable(n)) continue;
    if (!queues.has(n)) queues.set(n, []);
    queues.get(n).push(s.i);
  }

  const events = [];
  for (const w of narrationWords) {
    const n = normalizeWord(w.text);
    if (!isMatchable(n)) continue;
    const q = queues.get(n);
    if (q && q.length) {
      const dataW = q.shift();
      events.push({
        dataW,
        start: +(slideStart + w.start).toFixed(3),
        end: +(slideStart + w.end).toFixed(3)
      });
    }
  }
  // Sort by start so the driver can process in order.
  events.sort((a, b) => a.start - b.start);
  return events;
}
