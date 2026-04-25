# Script2Video

**English** · [中文](README.zh.md)

An AI tool that turns a written script into a storyboard video. Paste your screenplay, and the AI automatically splits it into shots, generates prompts, produces each clip, and stitches everything into a final film.

---

## Features

| Feature | Description |
|---------|-------------|
| **AI Storyboarding** | Paste a script and the AI splits it into structured shots (angle, composition, mood, dialogue, SFX) |
| **Multi-model Video Generation** | Generate a video clip per shot using Veo, Runway, MiniMax Hailuo, or Luma Ray |
| **Shot Continuity** | Optionally use an image model to synthesize the first frame of each shot from the last frame of the previous one |
| **Soft Subtitles** | Generate WebVTT / SRT subtitle files (not burned in) for separate export |
| **Full Export** | Stitch all completed clips into a single mp4 / webm with an embedded subtitle track |
| **Multi-session** | IndexedDB-backed sessions — switch between projects; deleting a session clears its video cache |
| **Reference Images** | Upload up to 3 reference images; the AI assigns them to matching shots |
| **i18n UI** | Interface in English / Chinese; auto-detects system language, switchable in the navbar |

---

## Supported Models

### Chat Models (storyboard generation)

| Provider | Models |
|----------|--------|
| **Google Gemini** | gemini-2.5-pro, gemini-2.0-flash, etc. (fetched dynamically) |
| **OpenAI** | gpt-4.1, gpt-4o, gpt-4o-mini, o4-mini, o3 |
| **Anthropic** | claude-opus-4-5, claude-sonnet-4-5, claude-haiku-3-5 |

### Video Models

| Provider | Models |
|----------|--------|
| **Google Veo** | veo-3.1, veo-3.0, veo-2.0, etc. (fetched dynamically, requires Gemini key) |
| **Runway** | gen4.5, gen4_turbo (5s / 10s) |
| **MiniMax** | Hailuo-2.3, Hailuo-2.3Fast, Hailuo-02 (6s / 10s) |
| **Luma** | ray-2, ray-flash-2 (5–9s) |

### Image Models (shot frame synthesis)

| Provider | Model | Capability |
|----------|-------|------------|
| **Google Gemini** | Imagen 4, Flash Image, etc. (fetched dynamically) | text-to-image / img2img |
| **OpenAI** | gpt-image-1 | img2img (edits API) |
| **fal.ai** | FLUX Kontext Pro | img2img (best for frame continuity) |
| **fal.ai** | FLUX Pro | text-to-image |
| **Stability AI** | Stable Image Ultra | text-to-image |
| **Stability AI** | Stable Image Core | text-to-image (low cost) |
| **Stability AI** | SD3 Large (img2img) | img2img |

The "Frame Synthesis" toggle is automatically disabled when no image provider is configured.

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm / yarn
- At least one provider API key

### Install & Run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configure API Keys

Go to `/settings` and save a key for each provider you want to use:

| Provider | Key page |
|----------|----------|
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| Runway | [app.runwayml.com/settings](https://app.runwayml.com/settings) |
| MiniMax | [platform.minimax.io](https://platform.minimax.io) |
| Luma | [lumalabs.ai/dream-machine/api](https://lumalabs.ai/dream-machine/api) |
| fal.ai | [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) |
| Stability AI | [platform.stability.ai/account/keys](https://platform.stability.ai/account/keys) |

> All API keys are encrypted with **AES-256-GCM** and stored in an HttpOnly cookie — never in browser storage.

---

## Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| **Chat model** | Model used for storyboard generation (Gemini / OpenAI / Anthropic) | Latest available |
| **Video model** | Model used for clip generation (Veo / Runway / MiniMax / Luma) | Latest available |
| **Image model** | Model used for frame synthesis (Gemini / OpenAI / fal.ai / Stability AI) | Latest available |
| **Aspect ratio** | 16:9 landscape / 9:16 portrait | 16:9 |
| **Max shot duration** | Maximum length per shot in seconds; range adjusts per video model | Per model |
| **Subtitle language** | Target language for AI-generated subtitles and dialogue | en-US |
| **Subtitles (WebVTT)** | Whether to generate a subtitle track | On |
| **Frame synthesis** | Generate each shot's first frame from the previous shot's last frame | On |
| **Serial tail-frame** | Force sequential generation, feeding the last frame as input to the next shot | On |
| **Auto-continue** | Automatically trigger the next generation round when done (partially implemented) | On |

---

## Architecture

```
app/
  api/
    chat/route.ts           # Storyboard generation via Gemini / OpenAI / Anthropic
    image/generate/route.ts # Frame synthesis (Gemini / OpenAI / fal.ai / Stability AI)
    models/route.ts         # Aggregates available models from all configured providers
    settings/route.ts       # Save / read / delete API keys (encrypted cookie)
    video/
      start/route.ts        # Submit video generation jobs (Veo / Runway / MiniMax / Luma)
      status/route.ts       # Poll job status, normalized response format
      proxy/route.ts        # Proxy video downloads (CORS bypass, multi-CDN)
components/
  ChatWorkspace.tsx         # Main workspace: params panel + chat + shot grid
  JobsPanel.tsx             # Generation progress drawer: video playback, export
  SessionsPanel.tsx         # Session history drawer (active session highlighted, XX/XX progress)
  Navbar.tsx                # Navbar (theme / language switch)
  WelcomeCard.tsx           # Onboarding card shown when no provider is configured
  Providers.tsx             # Global providers (theme / i18n)
lib/
  i18n.tsx                  # i18n context, translation strings, useI18n() hook
  types.ts                  # Core types (Shot, Storyboard, ModelInfo, Provider, etc.)
  client/
    exportVideo.ts          # Client-side video stitching (FFmpeg WASM or native API)
    media.ts                # Image compression
  db/
    idb.ts                  # IndexedDB wrapper
    videoCache.ts           # Video blob cache
  prompts/storyboard.ts     # System prompt for storyboard generation
  providers/
    gemini.ts               # Gemini API (chat / image / Veo)
    openai.ts               # OpenAI Chat + Image API
    anthropic.ts            # Anthropic Messages API
    runway.ts               # Runway Gen API
    minimax.ts              # MiniMax Video API
    luma.ts                 # Luma Dream Machine API
    fal.ts                  # fal.ai Image API (FLUX Kontext)
    stability.ts            # Stability AI Image API
  server/session.ts         # Server-side encrypted cookie (multi-provider key storage)
  stores/
    jobs.ts                 # Zustand: job state, session progress, video cache
    sessions.ts             # Zustand: session list (sorted by createdAt)
  utils/vtt.ts              # WebVTT / SRT utilities
```

### Tech Stack

- **Framework**: Next.js (App Router)
- **UI**: HeroUI v3 + Tailwind CSS v4
- **State**: Zustand + IndexedDB (local persistence)
- **Language**: TypeScript 5

### Adding a New Language

Edit [lib/i18n.tsx](lib/i18n.tsx): add keys to the `Messages` type, fill in translations in both the `en` and `zh` objects, then extend the `Locale` type and `messages` map.

### Dev Commands

```bash
pnpm dev      # development server with hot reload
pnpm build    # production build
pnpm start    # start production server
pnpm lint     # ESLint
```

---

## Notes

- Veo video generation requires a **paid Google AI Studio account**; some models (veo-3.x) require additional access approval
- Video generation is async polling and typically takes **30s – 3 min** depending on the model and server load
- Video export runs entirely in the browser; a large number of shots may require significant memory
- IndexedDB video cache has no size limit — clear old sessions from the jobs panel periodically
