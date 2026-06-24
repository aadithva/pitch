# Internal (Microsoft) Prior-Art Scan — via WorkIQ / M365 Copilot

> Source: WorkIQ (`ask_work_iq`) query against tenant data (emails, chats, files, meetings).
> Date: 2026-06-25. Conversation grounded in real tenant artifacts.

## TL;DR
**No single internal project does the full pipeline** (auto deck → video → AI narration → karaoke-style word highlighting). Microsoft has **~80% of the pieces in isolation**, but **nothing combines them end-to-end**. This validates the idea as a novel integration.

## What already exists internally (signals found)
| Capability | Status | Evidence |
|---|---|---|
| Slide generation via Copilot (PPT, `.md → slides` exploration) | ✅ Present | Copilot PowerPoint, internal design Teams chat: "Take text from a .md and put it into a visually beautiful deck" |
| Auto speaker notes / narration **script** generation | ✅ Present | "Copilot crafts speaker notes tailored to each slide" |
| AI hackathon (FHL/CAP) culture building end-to-end prototypes | ✅ Present | "Using AI to create real mocks and end-to-end experiences"; "Building whole products using AI assistants" |
| Slide decks used as **inputs to video** assets | ✅ (manual/semi-auto) | File: `AI-for-ListsVideo-JeffPresentation.pptx` |
| Active research into presentation automation | ✅ Present | Internal research: **"AI-Powered Presentation Creation Journeys: Why Users Turn to Tools Other Than Copilot"** |

## What was NOT found internally (the gap = our opportunity)
- ❌ Fully automated **slides → narrated video export**
- ❌ **AI voiceover rendering** from notes/script (voice synthesis)
- ❌ **Word-by-word synchronized highlighting** (karaoke style)
- ❌ A **timeline sync engine** linking narration to on-screen elements

## The gap, as a pipeline (WorkIQ synthesis)
```
Design / Code / Markdown
   ↓
Auto structured deck            (exists, partially ✅)
   ↓
Narration script                (exists today ✅ — Copilot speaker notes)
   ↓
AI voice synthesis              (missing ❌)
   ↓
Timeline sync engine            (missing ❌)
   ↓
Video export                    (missing ❌)
```

## Where this lands internally (adjacency / potential collaborators)
- Copilot agents / multimodal output
- PowerPoint Copilot roadmap
- Stream / video generation tooling
- **Accessibility** (strong overlap: narration + synchronized highlighting aids reading/comprehension)

## Implications for our skill
1. **Differentiation is real** — the novel value is the *integration* of voice synthesis + timeline sync + video export on top of deck+script generation.
2. Reuse the proven stage: LLM-generated narration script (the agent itself produces this well).
3. Focus engineering effort on the **three missing stages**: TTS voiceover, word-timeline sync, video render.
4. Accessibility framing is a strong narrative for the project (and a feature: synced highlighting + narration).
