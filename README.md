<div align="center">

# NullDraft

**From screenshots to reports — in flow.**

An AI-powered desktop app that turns instructions into step-by-step screenshot
documentation and exports professional, figure-rich reports.

[![Electron](https://img.shields.io/badge/Electron-2C2E3B?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Mistral AI](https://img.shields.io/badge/Mistral_AI-FF7000?logo=mistralai&logoColor=white)](https://mistral.ai/)

</div>

---

## Overview

NullDraft bridges the gap between **doing** a task and **documenting** it.

Define (or import) a list of steps, capture screenshots guided by a floating
overlay, and export a formatted document with figures, captions, and notes — all
in one flow. It's built for technical reports, lab write-ups (TP), runbooks, bug
reproductions, and step-by-step guides where screenshots do the heavy lifting.

AI is central, not optional: it parses instructions into steps, describes
screenshots, writes figure captions, runs OCR, and can enrich exports with an
AI-written introduction and conclusion.

## Features

- **Guided capture** — a floating HUD walks you through each step; capture full
  screen, an active window, a specific display, or a drag-to-select region (with
  region memory).
- **AI step generation** — upload a PDF / TXT / DOCX assignment and get a
  structured, editable list of steps.
- **AI enrichment** — per-screenshot descriptions, figure captions, OCR text
  extraction, smart crop, and AI intro/conclusion prose.
- **Multi-format export** — PDF, DOCX, LaTeX, Markdown, and JSON, with templates,
  table of contents, list of figures, branding (author, subtitle, watermark,
  logo) and automatic figure numbering.
- **Existing-document enhancement** — drop in a `.docx` / `.tex`, detect figure
  placeholders, and fill them with captures while preserving numbering.
- **Privacy first** — optional local-only mode (no cloud AI calls) and optional
  AES-256-GCM encryption of project manifests.
- **Resilient** — crash recovery resumes an interrupted capture session.

## Workflow

```
Define  ──▶  Review  ──▶  Capture  ──▶  Export
(steps)     (edit/AI)     (HUD)         (PDF/DOCX/…)
```

1. **Define** — create a project manually or import an instruction file (AI
   extracts the steps).
2. **Review** — edit, reorder, add or remove steps; run AI describe / OCR.
3. **Capture** — follow the floating HUD and snap a screenshot per step.
4. **Export** — pick a format and template, add branding, and generate.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron + electron-vite |
| UI | React, React Router, Tailwind CSS, shadcn/ui, Framer Motion |
| Language | TypeScript |
| Backend | Python · FastAPI · Uvicorn |
| AI | Mistral AI (`mistral-large-latest`, `pixtral-12b-2409`); optional OpenAI |
| Documents | python-docx, PyPDF2, Pillow, LibreOffice (PDF) |

The Electron app talks to a local FastAPI backend over HTTP. The app starts and
health-checks the backend automatically.

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- A **Mistral API key** (or OpenAI) for AI features
- *(optional)* **LibreOffice** (`soffice`) for PDF export

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then add your API key
```

Configure `backend/.env`:

```env
MISTRAL_API_KEY=your_key_here
# AI_PROVIDER=mistral              # or "openai"
# OPENAI_API_KEY=your_openai_key
# NULLDRAFT_PORT=8000
```

> The desktop app launches the backend for you. To run it standalone:
> `python server.py` (serves on `127.0.0.1:8000`).

### 2. Desktop app

```bash
cd app
npm install
npm run dev
```

On Linux, if the sandbox blocks launch, use:

```bash
npm run dev:no-sandbox
```

## Building

```bash
cd app
npm run build          # compile main / preload / renderer
npm run build:linux    # AppImage + deb
npm run build:win      # nsis + portable
```

## Project Structure

```
NullDraft/
├── app/                 # Electron + React desktop application
│   └── src/
│       ├── main.ts          # Electron main process
│       ├── preload.ts       # secure IPC bridge
│       ├── pages/           # Dashboard, Create, Review, Capture, Export, …
│       └── components/      # UI components (HUD, workflow stepper, …)
└── backend/             # FastAPI service
    ├── server.py            # API endpoints
    ├── ai.py                # AI provider abstraction & capabilities
    ├── report_gen.py        # multi-format document generation
    ├── doc_enhance.py       # inject figures into existing docs
    └── images.py            # image processing
```

## Privacy

- **Local-only mode** disables every cloud AI call (capture and export still work).
- **Project encryption** secures project manifests with AES-256-GCM derived from
  a passphrase.
- API keys live in `backend/.env`, which is git-ignored.

## License

This project is provided as-is. See the repository for license details.
