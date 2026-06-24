
---

# Research Report: Programmatic Presentation Deck Generation — Tools & Frameworks

*Research conducted June 2026. All star counts and activity dates are verified from GitHub API.*

---

## Summary

The landscape splits cleanly into four tiers: (1) **HTML/web slide frameworks** (reveal.js, Slidev, Marp, remark), which produce browser-renderable output that can be headlessly screenshot → video via Puppeteer; (2) **programmatic PPTX generators** (python-pptx, PptxGenJS), which write OpenXML directly and are "native" but hard to animate/record; (3) **the Pandoc bridge**, which converts markdown to either tier; and (4) **AI-native generators** (Presenton), which are full-stack SaaS replacements, not embeddable libraries. The **best two candidates for this skill** are **Slidev** (markdown-first, beautiful defaults, Vue animations, built-in headless PNG export) and **reveal.js** (most mature, best fragment/animation primitives, DeckTape for image export). Marp CLI is the simplest fallback for quick prototyping.

---

## Section 1: Code/Markdown-Driven Slide Frameworks

### 1.1 reveal.js
- **GitHub:** https://github.com/hakimel/reveal.js
- **Stars:** ⭐ 71,807 (as of 2026-06-24, verified via GitHub API)
- **Last Activity:** Pushed 2026-05-21 — **actively maintained**
- **Language/Stack:** Vanilla JavaScript (no build step required); HTML + CSS + Markdown plugin
- **Input Format:** HTML `<section>` tags, or Markdown via `data-markdown` attribute, or external `.md` file loaded at runtime
- **Output Format:** HTML (browser-rendered). Headless export: PDF via Chromium print or **DeckTape** (PNG/JPG per slide+fragment). No native PPTX.
- **Theming:** Full CSS override — supply custom stylesheet. Per-slide `data-background-color`, `data-background-image`, custom font-face injection. Themes are pure CSS files ([built-in: black, white, moon, sky, etc.](https://revealjs.com/themes/)). Fully adopts brand colors/fonts.
- **Headless/CLI:** No built-in CLI exporter, but: (a) serve with `npx reveal-md` or any HTTP server, (b) use **DeckTape** (`npx decktape reveal http://localhost:8000 slides.pdf`) or **Puppeteer** for screenshot automation. The `revealjs` output from `pandoc` is fully self-contained.
- **Fragment/Animation System:** ✅ **Best in class.** [Fragments](https://revealjs.com/fragments/) support `fade-in`, `fade-out`, `highlight-red/green/blue`, `highlight-current-*` (highlight then revert), `grow`, `shrink`, `strike`, and **custom CSS fragments** — wrapping individual words in `<span class="fragment highlight-current-red">` achieves karaoke highlighting precisely. [Auto-Animate](https://revealjs.com/auto-animate/) (`data-auto-animate`) morphs matching elements between slides via CSS transitions.
- **License:** MIT
- **Suitability for Skill:** ⭐⭐⭐⭐⭐ **Top candidate for video rendering.** The combination of per-element fragments + Auto-Animate + DeckTape/Puppeteer screenshot → ffmpeg assembly is the most proven pipeline for producing a styled, narrated video deck. Each fragment step renders as a distinct frame.

---

### 1.2 Slidev
- **GitHub:** https://github.com/slidevjs/slidev
- **Stars:** ⭐ 47,359 (2026-06-24)
- **Last Activity:** Pushed 2026-06-03 — **very actively maintained**
- **Language/Stack:** TypeScript + Vue 3 + Vite; Node.js ≥20.12
- **Input Format:** Single `.md` file with YAML frontmatter per slide, `---` slide separators; inline Vue JSX components; code blocks with syntax highlight
- **Output Format:** Vue SPA (browser), PDF (via Playwright), PNG per slide step (via `slidev export --format png`), PPTX (slides rendered as images embedded in PPTX)
- **Theming:** ✅ **Excellent.** Full Vue + UnoCSS + custom CSS. Per-deck `theme` in frontmatter, custom `style.css`, custom layouts. The agent injects brand colors via CSS variables or UnoCSS config. [Theme gallery](https://sli.dev/resources/theme-gallery) has 30+ themes.
- **Headless/CLI:** ✅ `slidev export --format png` exports every click step as numbered PNGs via headless Playwright. `slidev export --format pdf` for PDF. `slidev build` for static SPA. Fully scriptable from a Node.js agent.
- **Fragment/Animation System:** ✅ Strong. `v-click` Vue directive for incremental reveals; `v-motion` (built on [@vueuse/motion](https://motion.vueuse.org/)) for GSAP-style per-element enter/leave animations; `<Transition>` for slide transitions; [Shiki Magic Move](https://sli.dev/features/shiki-magic-move.md) for code animations. Word-level karaoke requires wrapping words in `<span>` + `v-motion`, but the framework fully supports it.
- **License:** MIT
- **Suitability for Skill:** ⭐⭐⭐⭐⭐ **Top candidate for AI-generated content.** Markdown-first means an LLM writes the deck as structured text. The built-in `slidev export --format png` produces per-click PNGs ready for video assembly. Beautiful defaults satisfy designers. The `Work with AI` section in [sli.dev docs](https://sli.dev/guide/work-with-ai) confirms the team explicitly supports LLM-driven authoring.

---

### 1.3 Marp / Marp CLI
- **GitHub (ecosystem):** https://github.com/marp-team/marp  
- **GitHub (CLI):** https://github.com/marp-team/marp-cli  
- **GitHub (framework):** https://github.com/marp-team/marpit
- **Stars (CLI):** ⭐ 3,659 (2026-06-24)
- **Last Activity:** CLI pushed 2026-05-06 — **actively maintained**
- **Language/Stack:** TypeScript (Node.js); underlying Marpit framework
- **Input Format:** Markdown with [Marp directives](https://marpit.marp.app/directives) in comments (`<!-- theme: gaia -->`), `---` slide separators
- **Output Format:** HTML, PDF, PPTX (images-in-PPTX), PNG images — **all from a single CLI command**
- **Theming:** ✅ Custom CSS theme files, full control over slide background, fonts, colors. Supply a `--theme custom.css` flag. The Marpit CSS theming system is pure CSS (no predefined classes to fight).
- **Headless/CLI:** ✅✅ **Simplest CLI of any framework.** `npx @marp-team/marp-cli@latest slides.md --pdf -o out.pdf`. `marp slides.md --images png -o ./frames/`. Docker image at `marpteam/marp-cli` for zero-install use. Built-in Chromium for rendering.
- **Fragment/Animation System:** ⚠️ Limited. Marp supports `<!-- _class: ... -->` for per-slide layout changes. Fragments ("steps") are not natively supported in the same way as reveal.js. No built-in per-word animation. For karaoke highlighting, custom HTML + CSS must be injected into the theme — possible but requires extra work.
- **License:** MIT
- **Suitability for Skill:** ⭐⭐⭐⭐ **Best for simple/fast generation.** The one-liner `marp slides.md --images png` converts markdown to a complete set of slide images in seconds. Great for early-stage skill prototyping. Insufficient for the downstream karaoke animation feature without custom work.

---

### 1.4 mdx-deck
- **GitHub:** https://github.com/jxnblk/mdx-deck
- **Stars:** ⭐ 11,491
- **Last Activity:** Pushed **2023-01-04** — ❌ **INACTIVE (3.5+ years no push)**
- **Language/Stack:** JavaScript/React/MDX (Gatsby-based)
- **Assessment:** Abandoned. Do not use for new projects. The MDX ecosystem has moved on; use Slidev or Spectacle instead.

---

### 1.5 Spectacle (Formidable)
- **GitHub:** https://github.com/FormidableLabs/spectacle
- **Stars:** ⭐ 10,137
- **Last Activity:** Pushed 2026-04-12 — **actively maintained**
- **Language/Stack:** TypeScript/React (JSX-first)
- **Input Format:** JSX/TSX code (primary), MDX (secondary)
- **Output Format:** HTML SPA
- **Theming:** CSS-in-JS via Emotion; full theming system
- **Headless/CLI:** No native export; needs Puppeteer/Playwright wrapper
- **Fragment/Animation System:** Yes — `<Appear>` component for incremental reveals, CSS transitions
- **License:** MIT
- **Suitability for Skill:** ⭐⭐⭐ React-native and JSX-first means the LLM generates React code, not simple markdown — more complex for agent scripting. Better for React teams who want live coding in slides.

---

### 1.6 remark / remarkjs
- **GitHub:** https://github.com/gnab/remark
- **Stars:** ⭐ 12,997
- **Last Activity:** Pushed 2024-06-19 — ⚠️ **slow maintenance**
- **Language/Stack:** Vanilla JavaScript (single-file browser library)
- **Input Format:** Markdown in HTML `<textarea>` or external `.md`
- **Output Format:** HTML (browser)
- **Theming:** Pure CSS; fully customizable
- **Headless/CLI:** Via DeckTape (`decktape remark slides.html slides.pdf`)
- **Fragment/Animation System:** Basic incremental reveal via `--` separator (sub-slides)
- **License:** MIT
- **Suitability for Skill:** ⭐⭐ Minimal and elegant but development momentum is low. Fine for simple text-heavy decks. DeckTape provides image export. Outclassed by Marp CLI for headless use.

---

### 1.7 WebSlides
- **GitHub:** https://github.com/webslides/WebSlides
- **Stars:** ⭐ 6,315
- **Last Activity:** Pushed **2022-12-10** — ❌ **ABANDONED**
- **Assessment:** No commits in 3.5+ years. Beautiful demo site but project is dead.

---

### 1.8 impress.js
- **GitHub:** https://github.com/impress/impress.js
- **Stars:** ⭐ 38,188
- **Last Activity:** Pushed 2026-01-24 — maintained (slowly)
- **Language/Stack:** Vanilla JavaScript
- **Input Format:** HTML with `data-x`, `data-y`, `data-z`, `data-rotate` position attributes on `<div>` elements
- **Output Format:** HTML with CSS3 3D transforms (Prezi-style)
- **Theming:** CSS
- **Headless/CLI:** Via DeckTape
- **Fragment/Animation System:** CSS transitions between positioned "frames"
- **License:** MIT
- **Suitability for Skill:** ⭐⭐ Visually spectacular but extremely complex to generate programmatically (each slide needs absolute position coordinates). Not LLM-friendly. Not suitable as the primary engine.

---

### 1.9 Pandoc (to reveal.js / Beamer)
- **GitHub:** https://github.com/jgm/pandoc
- **Stars:** ⭐ 35,986 (2026-06-24)
- **Last Activity:** Pushed 2026-06-23 — **very actively maintained**
- **Language/Stack:** Haskell; installed as system binary
- **Input Format:** Markdown (headings → slides; `---` → new slide; `::: incremental` → fragments)
- **Output Format:** reveal.js HTML (`-t revealjs`), Beamer PDF (`-t beamer`), PPTX (`-t pptx`), S5, Slidy, DZSlides
- **Theming:** `--css custom.css` for HTML; LaTeX `\beamertheme` for Beamer; `--reference-doc template.pptx` for PPTX
- **Headless/CLI:** ✅✅ `pandoc slides.md -t revealjs -o slides.html --self-contained --slide-level=2`. Single binary, zero Node.js dependency.
- **Fragment/Animation System:** Via reveal.js output — use `::: incremental` blocks or `.fragment` class in HTML comments. Pandoc itself doesn't animate, but its reveal.js output inherits the full reveal.js fragment system.
- **License:** GPL-2+
- **Suitability for Skill:** ⭐⭐⭐⭐ **Excellent bridge layer.** Agent writes plain Markdown → `pandoc -t revealjs` → self-contained HTML → Puppeteer/DeckTape → images → ffmpeg video. No Node.js build step; one system binary. Pairs perfectly with reveal.js as the animation layer.

---

## Section 2: Programmatic Deck File Generators

### 2.1 python-pptx
- **GitHub:** https://github.com/scanny/python-pptx
- **Stars:** ⭐ 3,428
- **Last Activity:** Pushed 2024-08-07 — ⚠️ maintained but slow (532 open issues)
- **Language/Stack:** Python (pure Python, no external dependencies)
- **Input Format:** Python API — `prs = Presentation(); slide = prs.slides.add_slide(layout); slide.shapes.add_textbox(...)`
- **Output Format:** `.pptx` (OpenXML)
- **Theming:** Full PPTX manipulation — `slide_width`, `slide_height`, custom color schemes, master slide layouts, font faces, text formatting
- **Headless/CLI:** Yes (Python script; `pip install python-pptx`)
- **Animation:** ⚠️ No built-in animation API. Animations must be inserted as raw OOXML XML via `pptx.oxml` — tedious but possible. PowerPoint's animation format (OOXML `<p:timing>`) is complex.
- **License:** MIT
- **Suitability for Skill:** ⭐⭐⭐ Best if the final deliverable must be an editable `.pptx`. Python-native means straightforward from an LLM-scripted agent. But headless video recording from `.pptx` requires LibreOffice conversion → HTML or screen-record (not truly headless on macOS). For karaoke-style animation, it's a dead end without heroic effort.

---

### 2.2 PptxGenJS
- **GitHub:** https://github.com/gitbrent/PptxGenJS
- **Stars:** ⭐ 5,743
- **Last Activity:** Pushed 2025-11-28 — **maintained**
- **Language/Stack:** TypeScript/JavaScript (Node.js or browser)
- **Input Format:** JS/TS API — `pres = new pptxgen(); slide = pres.addSlide(); slide.addText("Hello", {x:1, y:1, color:"363636"})`
- **Output Format:** `.pptx` (OOXML) — compatible with PowerPoint, Keynote, LibreOffice, Google Slides
- **Theming:** Slide Masters (`pres.defineSlideMaster({...})`), custom colors, fonts, background fills, shapes
- **Headless/CLI:** Yes (Node.js script; `npm install pptxgenjs`)
- **Animation:** ⚠️ Same limitation as python-pptx — requires inserting raw OOXML XML for PowerPoint animations. No library-level animation API. HTML-to-PPTX conversion via `pptx.tableToSlides()` is a helper feature.
- **License:** MIT
- **Suitability for Skill:** ⭐⭐⭐ The JavaScript counterpart to python-pptx. Well-suited for generating `.pptx` from a Node-based agent. 75+ demo slides show what's achievable. Same video-rendering problem as python-pptx.

---

### 2.3 officegen (Node.js)
- **GitHub:** https://github.com/Ziv-Barber/officegen — Note: archived/stale (~2k stars, no recent activity)
- **Assessment:** Superseded by PptxGenJS. Do not use.

### 2.4 Apache POI (Java)
- **URL:** https://poi.apache.org/
- **Assessment:** Java library, heavy JVM dependency. Powerful but not aligned with Python/Node stack. Skip unless Java is already in the toolchain.

### 2.5 Google Slides API
- **URL:** https://developers.google.com/slides
- **Assessment:** REST API requiring Google OAuth + cloud dependency. Can generate styled slides programmatically but requires internet connectivity and Google credentials. Not suitable for local/offline skill execution.

### 2.6 Aspose.Slides
- **Assessment:** Commercial product (paid license). Python, Java, .NET bindings. Excellent fidelity but no open-source use. Skip.

---

## Section 3: AI-Powered Deck Generators

### 3.1 Presenton ⭐ Most Notable Open-Source
- **GitHub:** https://github.com/presenton/presenton
- **Stars:** ⭐ 8,514 (2026-06-24) — **fastest growing**
- **Last Activity:** Pushed 2026-06-24 — ✅ **very actively maintained**
- **Language/Stack:** TypeScript (Next.js frontend) + Python FastAPI backend + Electron desktop app
- **Input Format:** Natural language prompt OR uploaded document (PDF, DOCX)
- **Output Format:** PPTX (fully editable), PDF
- **Theming:** Custom HTML/Tailwind CSS templates; can generate templates from existing PPTX files; supports brand colors/fonts
- **Headless/CLI:** REST API built-in; **MCP (Model Context Protocol) server** built-in — can be driven by Claude/GPT agents directly. Docker deployment available.
- **LLM Support:** OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI, Vertex AI, Amazon Bedrock, Ollama (local), any OpenAI-compatible endpoint
- **Animation:** Outputs PPTX — same animation limitations as above
- **License:** Apache 2.0
- **Suitability for Skill:** ⭐⭐⭐⭐ **The most complete open-source AI-first deck generator.** Self-hostable, MCP-compatible, generates PPTX from prompts. The limitation for our skill: outputs PPTX (not easily renderable to video headlessly) and is a full web application stack rather than an embeddable library. Best used as an **inspiration/reference architecture** or if PPTX output is the primary goal.

---

### 3.2 allweonedev/presentation-ai
- **GitHub:** https://github.com/allweonedev/presentation-ai
- **Stars:** ⭐ 2,871 (2026-06-24)
- **Last Activity:** Pushed 2026-06-05 — active
- **Language/Stack:** TypeScript (Next.js)
- **Input Format:** Prompt
- **Output Format:** Browser-based slides (React components)
- **License:** MIT
- **Suitability for Skill:** ⭐⭐ UI-first design; not designed as a headless library. Inspect for architecture inspiration.

---

### 3.3 Commercial AI Generators (Reference Only)

| Tool | Model | Output | Open Source? |
|---|---|---|---|
| **Gamma** (gamma.app) | SaaS | HTML/PDF/PPTX | ❌ No (API available, paid) |
| **Tome** (tome.app) | SaaS | Proprietary | ❌ No |
| **Beautiful.ai** | SaaS | PPTX/PDF | ❌ No |
| **Decktopus** | SaaS | PPTX/PDF | ❌ No |
| **SlideSpeak** | SaaS | PPTX | ❌ No |
| **SlidesGPT** | SaaS | PPTX | ❌ No |

---

## Section 4: Key Companion Tool — DeckTape

### DeckTape
- **GitHub:** https://github.com/astefanutti/decktape
- **Stars:** ⭐ 2,406 (2026-06-24)
- **Last Activity:** Pushed 2026-05-29 — **actively maintained**
- **Language/Stack:** JavaScript (Puppeteer/Chromium)
- **Function:** Headless PDF/PNG exporter for HTML presentations
- **Supported Frameworks:** reveal.js, remark, impress.js, Bespoke.js, CSSS, DZSlides, Flowtime, Generic
- **Key Feature for This Skill:** `--screenshots` flag exports **each fragment step** as a separate PNG image:
  ```bash
  decktape --screenshots reveal http://localhost:8000 output.pdf
  # → output_1_0.png, output_1_1.png (fragment), output_2_0.png ...
  ```
  These per-fragment PNGs are the exact frames needed for ffmpeg video assembly.
- **License:** MIT
- **Suitability for Skill:** ⭐⭐⭐⭐⭐ **Critical infrastructure tool** for the video rendering pipeline when using HTML-based frameworks.

---

## Section 5: Comparison Table

| Tool | Stars | Active? | Input | Output | Custom Theming | Headless CLI | Fragments/Animations | License | Video Pipeline Fit |
|---|---|---|---|---|---|---|---|---|---|
| **reveal.js** | 71.8k | ✅ | HTML/MD | HTML | ✅ Full CSS | Via Puppeteer/DeckTape | ✅✅ Best (fragments + Auto-Animate) | MIT | ✅✅ Excellent |
| **Slidev** | 47.4k | ✅ | Markdown/Vue | HTML/PDF/PNG | ✅ CSS+UnoCSS | ✅ `slidev export --png` | ✅✅ v-click + v-motion + GSAP | MIT | ✅✅ Excellent |
| **Marp CLI** | 3.7k | ✅ | Markdown | HTML/PDF/PPTX/PNG | ✅ CSS themes | ✅✅ Native CLI | ⚠️ Limited | MIT | ✅ Good (PNG output) |
| **Pandoc→reveal.js** | 36k | ✅ | Markdown | HTML (reveal.js) | ✅ CSS | ✅✅ Single binary | ✅ Via reveal.js | GPL-2+ | ✅✅ Excellent |
| **remark** | 13k | ⚠️ Slow | Markdown | HTML | ✅ CSS | Via DeckTape | ⚠️ Basic sub-slides | MIT | ✅ OK |
| **impress.js** | 38.2k | ⚠️ Slow | HTML (positions) | HTML 3D | ✅ CSS | Via DeckTape | ⚠️ CSS transitions | MIT | ⚠️ Complex to generate |
| **mdx-deck** | 11.5k | ❌ Dead | MDX | HTML | ✅ Theme-UI | ❌ Unmaintained | React transitions | MIT | ❌ Not recommended |
| **WebSlides** | 6.3k | ❌ Dead | HTML | HTML | ✅ CSS | Via Puppeteer | ⚠️ CSS only | MIT | ❌ Abandoned |
| **Spectacle** | 10.1k | ✅ | JSX/MDX | HTML | ✅ CSS-in-JS | Via Puppeteer | ✅ `<Appear>` | MIT | ✅ OK |
| **python-pptx** | 3.4k | ⚠️ Slow | Python API | .pptx | ✅ Full OOXML | ✅ Python script | ⚠️ Raw XML only | MIT | ⚠️ No headless video |
| **PptxGenJS** | 5.7k | ✅ | JS/TS API | .pptx | ✅ Slide Masters | ✅ Node script | ⚠️ Raw XML only | MIT | ⚠️ No headless video |
| **Presenton** | 8.5k | ✅✅ | Prompt/doc | PPTX/PDF | ✅ HTML+Tailwind | ✅ REST API/MCP | ⚠️ Via PPTX | Apache 2.0 | ⚠️ PPTX path only |
| **DeckTape** | 2.4k | ✅ | HTML URL | PDF/PNG per frame | N/A (renderer) | ✅✅ CLI | Renders each fragment | MIT | ✅✅ Critical companion |

---

## Section 6: Final Ranked Recommendation

### 🥇 Rank 1: **Slidev** — Recommended Primary Engine
**URL:** https://github.com/slidevjs/slidev | **Stars:** 47,359 | **License:** MIT

**Why #1 for this specific skill:**
- **Markdown-first authoring** — an LLM writes a `.md` file; Slidev renders it. No HTML boilerplate to generate.
- **`slidev export --format png`** outputs every click/transition step as numbered PNGs via headless Playwright — the perfect input for ffmpeg video assembly.
- **Built-in CSS variable theming** — brand colors and fonts are injected in a single `style.css` block or via `theme.config.ts`. The agent just writes `--color-primary: #your-brand-color`.
- **`v-click` + `v-motion` + GSAP** — wrap words in `<span v-click>` or `<span v-motion>` for karaoke-style per-word animations. The Vue component model means custom `<HighlightWord>` components can be defined once and reused.
- **Active `Work with AI` documentation** at https://sli.dev/guide/work-with-ai — the team explicitly supports LLM authoring.
- **Built-in recording** via the Slidev UI (manual), plus headless via `slidev export`.

**Trade-off vs. reveal.js:** Requires Node.js + a build step (Vite). Startup takes ~5–10 seconds. More complex dependency graph. But the output quality and markdown ergonomics justify this for a designer-targeted skill.

---

### 🥈 Rank 2: **reveal.js + Pandoc bridge** — Best Animation Primitives
**URLs:** https://github.com/hakimel/reveal.js + https://github.com/jgm/pandoc | **Stars:** 71,807 + 35,986 | **License:** MIT + GPL-2+

**Why #2:**
- **Pandoc is a single binary** — `pandoc slides.md -t revealjs --self-contained -o slides.html`. Zero npm, zero build. The agent just invokes `pandoc` from Python or shell.
- **reveal.js fragments are the most powerful** — per-element `fragment highlight-current-red/blue/green` classes directly express karaoke word highlighting. The `.element: class="fragment highlight-current-blue"` Pandoc Markdown syntax enables this in plain text.
- **DeckTape `--screenshots`** exports every fragment step as a PNG. `decktape --screenshots reveal slides.html out.pdf` → `out_1_0.png`, `out_1_1.png` per word highlight step → ffmpeg assembles to video.
- **Auto-Animate** (`data-auto-animate`) enables smooth element morphing between slides — useful for brand-style transitional animations.
- **71k stars, 15 years of ecosystem** — most tutorial content, most Puppeteer automation examples, most production usage.

**Trade-off vs. Slidev:** Pandoc-generated reveal.js HTML is less visually polished out-of-the-box than Slidev's default theme. Custom CSS for brand styling is more manual. The pipeline is: `LLM → markdown → pandoc → HTML → DeckTape/Puppeteer → PNGs → ffmpeg`.

---

### 🥉 Rank 3: **Marp CLI** — Simplest Prototyping Path
**URL:** https://github.com/marp-team/marp-cli | **Stars:** 3,659 | **License:** MIT

**Why #3:**
- `npx @marp-team/marp-cli slides.md --images png` produces slide PNGs in **one command, zero config**.
- Markdown input is the simplest of all frameworks — no special directives unless needed.
- Custom CSS theme can inject brand colors/fonts.
- **Docker image** (`marpteam/marp-cli`) makes it reproducible across environments.
- **But:** No fragment/animation system → cannot do karaoke word highlighting without injecting custom HTML/JS into the theme. Fine for Phase 1 (static slide images) but requires swapping to reveal.js or Slidev for Phase 5 (karaoke animation).

---

## Section 7: HTML vs. PPTX — Architecture Trade-off Analysis

| Dimension | HTML/reveal.js/Slidev | .pptx (python-pptx/PptxGenJS) |
|---|---|---|
| **Headless video recording** | ✅ Puppeteer screenshots → ffmpeg | ❌ Must use LibreOffice export or screen-record |
| **Per-word/karaoke animation** | ✅ CSS classes on `<span>` | ⚠️ OOXML `<p:timing>` — extremely complex XML |
| **Custom brand theming** | ✅ Pure CSS, any color/font | ✅ Slide Masters, but requires template .pptx |
| **Reproducibility on macOS** | ✅ Chrome/Chromium bundled in most CLIs | ⚠️ LibreOffice needed for video path |
| **User shareability** | ✅ Share HTML URL or PDF | ✅ Share .pptx file — most familiar to non-devs |
| **Editable by hand** | ⚠️ Edit in code editor | ✅ Open in PowerPoint/Keynote/Google Slides |
| **AI agent generation effort** | ✅ LLM writes markdown → rendered automatically | ⚠️ LLM writes Python/JS code for each element's position |
| **Fragment reveals** | ✅ Native `class="fragment"` | ⚠️ Manually timed animation entries in OOXML |

**Verdict:** For this skill's full pipeline (brand-styled deck → narrated video → karaoke animation), the **HTML path is overwhelmingly superior**. The PPTX path is only justified if the primary deliverable is a `.pptx` file for human editing, and even then, convert the HTML output to PPTX images (as Marp CLI's `--pptx` or Slidev's PPTX export do) for the "native file" deliverable.

---

## Section 8: Recommended Full Pipeline for the Skill

```
┌─────────────────────────────────────────────────────────────────┐
│ AGENT SKILL PIPELINE (recommended)                              │
│                                                                 │
│  1. Style Extraction  →  CSS variables (colors, fonts)          │
│                          + Slidev theme config                  │
│                                                                 │
│  2. Deck Generation   →  LLM writes slides.md (Slidev syntax)   │
│                          `slidev build` (Vite → static HTML)    │
│                          OR `pandoc -t revealjs` (no-build alt)  │
│                                                                 │
│  3. Voiceover         →  TTS system writes slides_tts.json      │
│                          (timing metadata per word)             │
│                                                                 │
│  4. Frame Export      →  `slidev export --format png`           │
│                          OR DeckTape `--screenshots`            │
│                          → frame_001.png, frame_002.png ...     │
│                                                                 │
│  5. Karaoke Animation →  Inject <span v-click>word</span>       │
│                          into slides.md, re-export as PNG       │
│                          OR inject fragment classes in revealjs  │
│                                                                 │
│  6. Video Assembly    →  ffmpeg: frames + voiceover.mp3         │
│                          → final_presentation.mp4               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Gaps and Uncertainties

1. **Slidev's video export cadence:** `slidev export --format png` exports per click-step but the mapping of PNG frame indices to voiceover timestamps requires custom timing logic — no out-of-box TTS-sync. This is a custom implementation task for the skill.

2. **DeckTape screenshot mode on macOS:** Verified CLI syntax but not macOS-specific Chromium path behavior. Docker usage (`docker run ghcr.io/astefanutti/decktape`) is the most reliable cross-platform approach.

3. **Pandoc → reveal.js fragment syntax:** Pandoc supports `::: incremental` lists and `.fragment` attributes via [HTML comments](https://pandoc.org/MANUAL.html). Per-*word* fragment wrapping still requires post-processing (a Python script to wrap individual tokens in `<span class="fragment highlight-current-blue">`).

4. **Presenton API stability:** The MCP server feature is new (v3, released ~2025). Documentation at https://docs.presenton.ai/v3/get-started/quickstart — worth investigating for a PPTX-output variant of the skill.

5. **Deckset** (macOS app, https://www.deckset.com/) — mentioned in the query but is a **commercial closed-source macOS app**, not scriptable from CLI. Excluded from recommendation.

6. **officegen** — archived on GitHub, last meaningful activity 2019. Replaced by PptxGenJS.