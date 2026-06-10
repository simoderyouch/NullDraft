# NullDraft — Product Functionality

> An AI-powered desktop app that turns instructions into step-by-step screenshot documentation and exports professional reports.

**Tagline:** *From screenshots to reports — in flow.*

---

## 1. Product Vision

NullDraft bridges the gap between doing a task and documenting it. Users define (or import) a list of steps, capture screenshots guided by a floating overlay, and export a formatted document with figures, captions, and notes.

**Core value:**
- Reduce documentation time by 70–80%
- Keep figure numbering and formatting consistent
- Work with new projects or enhance existing documents
- Use AI to extract steps, describe screenshots, and assemble reports

**AI is central to NullDraft** — it is not an optional add-on. AI handles instruction parsing, screenshot understanding, caption writing, document analysis, and (planned) validation and smart editing across the full workflow.

---

## 2. Target Users

| User | Use case |
|------|----------|
| Students | Lab reports, project documentation, technical assignments (TP) |
| QA / developers | Bug reproduction guides, test case documentation |
| Consultants | Client reports with visual evidence |
| Teachers / trainers | Step-by-step guides and tutorials |
| DevOps / IT | Runbooks and setup procedures |

---

## 3. Core Workflows

### 3.1 New project (instructions → capture → export)

1. Create a project manually or upload an instruction file (PDF, TXT, DOCX).
2. AI parses the file and proposes a list of steps.
3. User reviews, edits, reorders, adds, or removes steps.
4. User starts guided capture via the floating HUD.
5. Screenshots are saved per step with automatic naming.
6. User reviews captures, retakes if needed, then exports a report.

### 3.2 Manual project (no AI)

1. Create a project with a custom name.
2. Add steps with title and description.
3. Capture screenshots step by step.
4. Export the finished documentation.

### 3.3 Resume existing project

1. Open a recent project from the dashboard.
2. Continue capture or edit steps.
3. Review thumbnails and fullscreen previews.
4. Export or update the report.

### 3.4 Existing document enhancement (planned)

1. Upload an existing Word or LaTeX document.
2. AI detects placeholders and missing figures.
3. Guided capture fills in screenshots.
4. Document is updated while preserving formatting and figure numbers.

### 3.5 AI-assisted workflow (end-to-end)

1. User uploads a lab assignment, TP, or instruction file.
2. **AI instruction parser** extracts structured steps (title + description per step).
3. User reviews and edits the generated plan.
4. User captures screenshots guided by the HUD.
5. **AI vision** analyzes each screenshot and writes a technical description.
6. **AI caption generator** produces figure captions for the export.
7. Report is assembled with AI-written text inserted under each figure.

---

## 4. AI & Intelligence Layer

NullDraft uses AI at multiple points in the documentation pipeline. The backend (FastAPI + Mistral) handles heavy AI work; the Electron app calls it over HTTP.

### 4.1 AI capabilities overview

| Capability | What it does | Model (current) | Status |
|------------|--------------|-----------------|--------|
| **Instruction parsing** | Read PDF/TXT/DOCX and extract a step-by-step plan | `mistral-large-latest` | ✅ Implemented |
| **Screenshot description** | Describe what is visible in a captured image | `pixtral-12b-2409` (vision) | ✅ Implemented |
| **Figure caption generation** | Write formal captions (e.g. "Figure 3 — Login screen") | `mistral-large-latest` | ✅ Implemented |
| **Document analysis** | Parse existing docx/tex, find placeholders & gaps | `mistral-large-latest` | ✅ Implemented |
| **Step validation** | Compare screenshot to expected step outcome | `pixtral-12b-2409` (vision) | ✅ Implemented |
| **Sensitive data detection** | Find passwords, emails, API keys in screenshots | `pixtral-12b-2409` (vision) | ✅ Implemented |
| **Smart crop** | Detect and crop relevant UI region | `pixtral-12b-2409` (vision) | ✅ Implemented |
| **OCR / text extraction** | Extract on-screen text for searchable reports | `pixtral-12b-2409` (vision) | ✅ Implemented |
| **Auto-caption from context** | One-line summary per screenshot for quick reports | `mistral-large-latest` | ✅ Implemented |
| **Next-step suggestion** | Suggest follow-up steps from the defined manual steps + source document | `mistral-large-latest` | ✅ Implemented |
| **Report narrative** | Write connecting prose between steps | `mistral-large-latest` | ✅ Implemented |
| **Branching logic** | Suggest conditional step paths (success vs. error) from steps + document | `mistral-large-latest` | ✅ Implemented |

### 4.2 Where AI is used in the app

```
Upload instructions ──► AI parses steps ──► User reviews plan
                                                │
                                                ▼
                                         Guided capture
                                                │
                                                ▼
                              AI describes each screenshot (vision)
                                                │
                                                ▼
                              AI writes captions + report text
                                                │
                                                ▼
                                         Export document
```

| Stage | AI role | User interaction |
|-------|---------|------------------|
| **Project creation** | Parse uploaded file into steps | User uploads PDF/TXT; AI fills step list |
| **Step review** | None (user edits AI output) | User can fix titles, descriptions, order |
| **During capture** | Optional live hints (planned) | HUD shows AI-suggested focus areas |
| **After capture** | Vision description per screenshot | Auto-runs or triggered on export |
| **Export** | Captions, narrative, formatting | User picks template; AI fills content |
| **Document update** | Map placeholders → screenshots (planned) | User uploads existing doc |

### 4.3 Instruction parsing (implemented)

**Trigger:** User uploads a file on the Create Project screen.

**Supported inputs:**
- Plain text (`.txt`, `.md`)
- PDF (text extracted via PyPDF2)

**Planned inputs:** `.docx`, `.tex`

**AI prompt goal:** Act as a technical documentation assistant. Extract key steps from lab assignments, TPs, or task instructions.

**Output schema:**
```json
{
  "steps": [
    {
      "id": "unique-string",
      "title": "Short step title",
      "description": "Detailed instruction for what the user should do"
    }
  ]
}
```

**API:** `POST /analyze-instructions` — accepts file upload, returns `{ steps: [...] }`

**Frontend:** `CreateProject.tsx` → `uploadAssessmentAndGenerateSteps()` in `app/src/lib/api/index.ts`

### 4.4 Screenshot description — vision (backend ready)

**Trigger:** After a screenshot is captured (planned: auto on capture or on export).

**AI prompt goal:** Given a step title and screenshot, describe what is happening on screen and write a short technical explanation suitable for a report.

**Model:** `pixtral-12b-2409` (Mistral vision)

**Input:** Step title + PNG image (base64)

**Output:**
```json
{
  "description": "The user has opened the application login page. The username and password fields are visible..."
}
```

**API:** `POST /generate-description?step_title=...` — accepts image file upload

**Frontend API:** `generateScreenshotDescription()` is wired into the Review page (per-step "Describe") and the Export page ("Generate AI text").

**Stored in project as:** `generated_description` on each step (field reserved in backend `ReportRequest`)

### 4.5 Planned AI features (detailed)

#### Caption generation
- Input: step title, step description, AI screenshot description
- Output: formal figure caption, e.g. `Figure 2 — Dashboard after successful login`
- Used in: LaTeX `\caption{}`, Word caption paragraphs, Markdown alt text

#### Document analysis (existing document workflow)
- Input: uploaded `.docx` or `.tex`
- Output: list of placeholders, missing figures, suggested capture steps
- Preserves existing figure numbering when inserting new screenshots

#### Step validation
- Input: step description + captured screenshot
- Output: pass/fail + message ("Expected login form; got error dialog")
- Use case: QA workflows, lab assignment compliance

#### Sensitive data blur (AI-assisted)
- Input: screenshot
- Output: bounding boxes for passwords, emails, tokens, personal data
- App applies blur before saving or exporting

#### Smart crop
- Input: screenshot + step description
- Output: crop region focusing on relevant UI (form, button, error message)
- Reduces noise in reports

#### OCR & searchability
- Extract all visible text from screenshots
- Index in project manifest for search
- Include extracted text in export metadata

#### Report narrative generation
- Input: all steps + descriptions + captions
- Output: introductory paragraph, section transitions, conclusion
- Produces polished prose, not just bullet points

#### Branching & next-step suggestion
- Input: the defined manual steps and the source document/instructions (not screenshot content)
- Output: suggested next step (title + description) to add to the procedure
- Branching: conditional step lists for error vs. success paths (`POST /suggest-branches`, surfaced via the Review "Branches" button)

### 4.6 AI providers & configuration

| Provider | Use case | Status |
|----------|----------|--------|
| **Mistral AI** | Primary — instruction parsing, vision descriptions | ✅ Implemented |
| **OpenAI** | Alternative — GPT-4o / Vision API (set provider + install `openai`) | ✅ Implemented |
| **Ollama (local)** | Offline / privacy — Llama, Mistral local models | 🔲 Planned |

**Configuration:**
- API key stored in Settings (`config.json` via Electron IPC)
- Backend reads `MISTRAL_API_KEY` from environment or `.env`
- Health check reports AI availability: `GET /health` → `{ mistral_configured: true/false }`

**Privacy principles:**
- Screenshots sent to cloud AI only when user triggers AI features
- Local LLM option planned for fully offline workflows
- No training on user data (standard API provider policies)

### 4.7 AI API reference

| Endpoint | Method | Purpose | AI model | Status |
|----------|--------|---------|----------|--------|
| `/health` | GET | Check server + AI key configured | — | ✅ |
| `/analyze-instructions` | POST | Parse file (txt/md/pdf/docx) → steps | `mistral-large-latest` | ✅ |
| `/generate-description` | POST | Screenshot → description | `pixtral-12b-2409` | ✅ |
| `/generate-captions` | POST | Steps + descriptions → captions | `mistral-large-latest` | ✅ |
| `/generate-narrative` | POST | Steps → intro/conclusion prose | `mistral-large-latest` | ✅ |
| `/validate-step` | POST | Screenshot vs. expected step | `pixtral-12b-2409` | ✅ |
| `/analyze-document` | POST | Existing doc → placeholder map | `mistral-large-latest` | ✅ |
| `/detect-sensitive` | POST | Screenshot → blur regions | `pixtral-12b-2409` | ✅ |
| `/ocr` | POST | Screenshot → extracted text | `pixtral-12b-2409` | ✅ |
| `/suggest-next` | POST | Defined steps + document → next-step suggestion | `mistral-large-latest` | ✅ |
| `/suggest-branches` | POST | Defined steps + document → success/error branches | `mistral-large-latest` | ✅ |
| `/smart-crop` | POST | Screenshot + step title → relevant crop region (optionally applied) | `pixtral-12b-2409` | ✅ |
| `/blur-regions` | POST | Apply blur to regions (Pillow) | — | ✅ |
| `/optimize-image` | POST | Resize/compress screenshot (Pillow) | — | ✅ |
| `/generate-report` | POST | Assemble md/tex/docx/pdf/json report (optional AI narrative) | — | ✅ |
| `/enhance-document` | POST | Insert captured figures into an existing docx/tex | — | ✅ |
| `/generate-latex-report` | POST | Back-compat LaTeX/PDF assembly | — | ✅ |

### 4.8 AI in export & data model

Steps can carry AI-generated content alongside user-defined fields:

```json
{
  "id": "uuid",
  "number": 1,
  "title": "Login to application",
  "description": "Open the app and enter credentials",
  "imagePath": "step-01-login.png",
  "captured": true,
  "skipped": false,
  "generated_description": "The login page displays username and password fields...",
  "generated_caption": "Figure 1 — Application login interface"
}
```

Export uses `generated_description` and `generated_caption` when present; falls back to `description` if AI text is missing.

---

## 5. Feature Catalog

> AI-specific features are documented in **Section 4**. This catalog covers the rest of the app.

### 5.1 Dashboard & navigation

| Feature | Description | Status |
|---------|-------------|--------|
| Home dashboard | Entry point with branding and quick actions | ✅ Implemented |
| Recent projects | List projects with step count and last modified time | ✅ Implemented |
| Open project | Resume work from dashboard | ✅ Implemented |
| Delete project | Remove project folder and manifest | ✅ Implemented |
| Drag-and-drop upload | Drop instruction files on dashboard to start | ✅ Implemented |
| Templates library | Start a project from a predefined template | ✅ Implemented |
| New / Open / Settings shortcuts | Primary navigation actions | ✅ Implemented |
| Frameless window controls | Minimize and close custom title bar | ✅ Implemented |
| System tray | Background presence with show/quit menu | ✅ Implemented |

---

### 5.2 Project management

| Feature | Description | Status |
|---------|-------------|--------|
| Create project | Name a project and define steps | ✅ Implemented |
| Edit project | Modify steps on an existing project | ✅ Implemented |
| Project manifest | `project.json` stores metadata and step state | ✅ Implemented |
| Local storage | Projects under `~/.config/nulldraft/projects/` | ✅ Implemented |
| Step fields | Title, description, number, capture state | ✅ Implemented |
| Add / remove steps | Dynamic step list management | ✅ Implemented |
| Reorder steps | Drag-and-drop step ordering | ✅ Implemented |
| Skip steps | Mark steps as skipped during capture | ✅ Implemented |
| Session persistence | State preserved across Review ↔ Capture ↔ Edit | ✅ Implemented |
| Project templates | Reusable templates (e.g. lab report, bug guide) | ✅ Implemented |
| Screenshot version history | Retakes archived under `.history/` | ✅ Implemented |
| Crash recovery / autosave | Recover interrupted sessions (resume banner on launch) | ✅ Implemented |

---

### 5.3 Guided capture (Floating HUD)

| Feature | Description | Status |
|---------|-------------|--------|
| Floating HUD overlay | Always-on-top, minimal capture guide | ✅ Implemented |
| Step progress | Current step / total steps display | ✅ Implemented |
| Step title & description | Context for what to capture | ✅ Implemented |
| Capture button | Trigger screenshot from HUD | ✅ Implemented |
| Next / Back / Skip | Navigate the capture sequence | ✅ Implemented |
| Finish capture | Complete session and return to main window | ✅ Implemented |
| Capture flash feedback | Brief screen flash on successful capture | ✅ Implemented |
| HUD auto-hide during capture | Overlay hidden so it is not in the screenshot | ✅ Implemented |
| Global hotkeys | Configurable shortcuts for capture, skip, back | ✅ Implemented |
| Default hotkeys | `Ctrl+Shift+S` capture, `Ctrl+Shift+N` skip, `Ctrl+Shift+B` back | ✅ Implemented |
| Retake screenshot | Replace current step image, keep history | ✅ Implemented |
| Per-step notes | Quick text notes during capture & review | ✅ Implemented |
| Progress bar | Visual completion indicator (HUD + Review) | ✅ Implemented |
| Capture mode selector | Full screen / active window / specific display | ✅ Implemented |
| Keyboard-only workflow | Full capture without mouse | 🔲 Partial |
| Mini-toolbar mode | Smaller, less intrusive overlay variant | ✅ Implemented |

---

### 5.4 Screenshot engine

| Feature | Description | Status |
|---------|-------------|--------|
| Full-screen capture | Capture entire primary display | ✅ Implemented |
| Auto-naming | `step-01-title-slug.png` per step | ✅ Implemented |
| Linux Wayland support | xdg-desktop-portal + Electron fallbacks | ✅ Implemented |
| Linux X11 support | CLI tools + screenshot-desktop fallback | ✅ Implemented |
| Windows / macOS capture | Cross-platform via Electron / screenshot-desktop | ✅ Implemented |
| Active window capture | Capture focused application only | ✅ Implemented |
| Region capture | Crop to a rectangle region | ✅ Implemented |
| Region memory | Reuse last capture region | ✅ Implemented |
| Multi-monitor support | Choose display to capture | ✅ Implemented |
| Smart crop (AI) | Auto-focus on relevant UI area | ✅ Implemented |
| Image optimization | Compress and resize before storage | ✅ Implemented |

---

### 5.5 Review & preview

| Feature | Description | Status |
|---------|-------------|--------|
| Review page | Overview of all steps before/after capture | ✅ Implemented |
| Capture status indicators | Green checkmark for captured steps | ✅ Implemented |
| Thumbnail previews | Small preview of each screenshot | ✅ Implemented |
| Fullscreen preview | Modal view of full-size image | ✅ Implemented |
| Back to review from capture | Return without losing project context | ✅ Implemented |
| Retake from review | Re-capture a specific step | ✅ Implemented |
| AI describe / validate from review | Per-step AI description & validation | ✅ Implemented |
| Annotation preview | See edits before export | ✅ Implemented |

---

### 5.6 Annotation & image editing

| Feature | Description | Status |
|---------|-------------|--------|
| Highlight regions | Draw attention to UI elements | ✅ Implemented |
| Arrows and shapes | Point to buttons, fields, errors | ✅ Implemented |
| Text labels | Add callouts on screenshots | ✅ Implemented |
| Blur sensitive data | Hide passwords, emails, keys | ✅ Implemented |
| AI sensitive-data blur | Automatic detection of secrets | ✅ Implemented |
| Crop & rotate | Basic image adjustments | 🔲 Partial (blur/crop regions) |
| Screenshot version history | Keep previous versions on retake | ✅ Implemented |

---

### 5.7 Document export

| Feature | Description | Status |
|---------|-------------|--------|
| Export screen | Choose format, filename, and template | ✅ Implemented |
| LaTeX export | Generate `.tex` with figures and captions | ✅ Implemented |
| PDF export | Render PDF via LibreOffice headless | ✅ Implemented |
| Word (.docx) export | Generate formatted Word report | ✅ Implemented |
| Markdown export | Plain `.md` with image references | ✅ Implemented |
| JSON manifest export | Steps + image paths for automation | ✅ Implemented |
| Figure auto-numbering | Sequential figure labels (Figure 1, 2, …) | ✅ Implemented |
| Table of contents | Auto-generated ToC | ✅ Implemented |
| List of figures | Auto-generated LoF | ✅ Implemented |
| Custom templates | Default, minimal, detailed, academic, business, runbook | ✅ Implemented |
| Custom branding | Author, subtitle, logo, watermark | ✅ Implemented |
| AI report enrichment | Auto-generate descriptions + captions before export | ✅ Implemented |
| Update existing document | Insert figures into uploaded docx/tex (Enhance Document flow) | ✅ Implemented |
| Open export folder | Reveal generated files in file manager | ✅ Implemented |

---

### 5.8 Settings & configuration

| Feature | Description | Status |
|---------|-------------|--------|
| API key storage | Mistral / OpenAI key for AI features | ✅ Implemented |
| Hotkey customization | Capture, skip, and back shortcuts | ✅ Implemented |
| Dark mode toggle | UI theme preference (applied at runtime) | ✅ Implemented |
| Config persistence | Saved to local config file | ✅ Implemented |
| Provider selection | Choose Mistral or OpenAI | ✅ Implemented |
| Default project location | Configurable storage path | ✅ Implemented |
| Export defaults | Default format and template | ✅ Implemented |
| Screenshot quality settings | Format (PNG/JPG) and compression | ✅ Implemented |
| Privacy controls | Local-only mode toggle (enforced on screenshot AI calls) + AES-256 project encryption | ✅ Implemented |

---

### 5.9 Backend services

| Feature | Description | Status |
|---------|-------------|--------|
| FastAPI server | Python backend on `localhost:8000` | ✅ Implemented |
| Health check | `GET /health` | ✅ Implemented |
| Analyze instructions | `POST /analyze-instructions` | ✅ Implemented |
| Generate description | `POST /generate-description` (vision) | ✅ Implemented |
| Generate report (all formats) | `POST /generate-report` (md/tex/docx/pdf/json) | ✅ Implemented |
| Generate LaTeX report | `POST /generate-latex-report` | ✅ Implemented |
| Auto-start backend | Electron spawns Python on launch | ✅ Implemented |
| Auto-stop backend | Kill Python process on app quit | ✅ Implemented |

---

### 5.10 Platform & distribution

| Feature | Description | Status |
|---------|-------------|--------|
| Linux (AppImage, deb) | Build targets configured | ✅ Build config |
| Windows (NSIS, portable) | Build targets configured | ✅ Build config |
| macOS | Build support | 🔲 Planned |
| Auto-update | Check and install new versions | 🔲 Planned |
| Code signing | Trusted installers | 🔲 Planned |

---

## 6. Keyboard Shortcuts (default)

| Action | Default shortcut |
|--------|------------------|
| Capture screenshot | `Ctrl+Shift+S` |
| Skip step | `Ctrl+Shift+N` |
| Go back | `Ctrl+Shift+B` |

All shortcuts are configurable in Settings.

---

## 7. Data model

### Project manifest (`project.json`)

```json
{
  "name": "Project Name",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "currentStepIndex": 0,
  "steps": [
    {
      "id": "uuid",
      "number": 1,
      "title": "Step title",
      "description": "What the user should do",
      "imagePath": "step-01-title-slug.png",
      "captured": true,
      "skipped": false,
      "generated_description": "AI-written explanation of the screenshot (optional)",
      "generated_caption": "Figure 1 — Short caption (optional)"
    }
  ]
}
```

### On-disk layout

```
~/.config/nulldraft/
├── config.json
└── projects/
    └── <project-slug>/
        ├── project.json
        ├── step-01-....png
        ├── step-02-....png
        └── report.tex / report.docx (after export)
```

---

## 8. Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│                  Electron + React (app/)                 │
│  Dashboard │ Create/Edit │ Review │ Capture │ Export    │
│  Floating HUD │ Settings │ System Tray │ Global Hotkeys  │
└──────────────────────────┬──────────────────────────────┘
                           │ IPC + HTTP
┌──────────────────────────▼──────────────────────────────┐
│              FastAPI backend (backend/)                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ AI Layer                                             │  │
│  │  • Instruction parsing (mistral-large-latest)       │  │
│  │  • Vision descriptions (pixtral-12b-2409)           │  │
│  │  • Captions, validation, doc analysis (planned)     │  │
│  └─────────────────────────────────────────────────────┘  │
│  Document export │ PDF/LaTeX/Word assembly               │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Mistral AI │ OpenAI (planned) │ Ollama (planned)          │
│  python-docx │ LaTeX/Jinja2 │ Local project storage        │
└─────────────────────────────────────────────────────────┘
```

---

## 9. Roadmap phases

### Phase 1 — MVP (screenshot loop) ✅ Mostly complete

- [x] Project create / edit / delete
- [x] Step definition and reordering
- [x] Floating HUD with hotkeys
- [x] Screenshot capture and auto-naming
- [x] Review with thumbnails and fullscreen preview
- [x] AI instruction parsing (PDF / text / DOCX)
- [x] Document export (Word, LaTeX, PDF, Markdown, JSON)
- [x] Electron ↔ Python lifecycle (auto start/stop)

### Phase 2 — AI polish & capture improvements

- [x] Wire AI screenshot descriptions into capture/export UI
- [x] AI figure caption generation
- [x] Batch AI description for all captured steps
- [x] Retake screenshots with version history
- [x] Annotation tools (arrows, blur, highlight, text)
- [x] AI-assisted sensitive data blur
- [x] DOCX / LaTeX instruction upload (AI parsing)
- [x] Project templates library
- [x] Region and window capture modes
- [x] OpenAI provider option in Settings

### Phase 3 — AI document workflows

- [x] AI document analysis (existing docx/tex → capture plan)
- [ ] Existing document enhancement (AI placeholder fill)
- [x] AI report narrative (intro, transitions, conclusion)
- [x] Custom export templates and branding
- [x] Figure captions, ToC, and List of Figures
- [x] JSON manifest export for automation
- [x] Step validation (AI compares screenshot to expected outcome)

### Phase 4 — Advanced AI & collaboration

- [ ] Local LLM via Ollama (fully offline AI)
- [ ] AI smart crop (focus on relevant UI)
- [ ] AI branching step logic
- [x] AI next-step suggestions from screen content
- [ ] Video / GIF capture per step
- [x] OCR on screenshots (searchable reports)
- [ ] Cloud sync and team collaboration
- [ ] Web read-only report viewer
- [ ] Word plugin / VS Code extension

---

## 10. Non-functional requirements

| Requirement | Target |
|-------------|--------|
| Privacy | Local-first; screenshots stored on disk by default |
| Performance | Capture feedback under 500 ms after hotkey |
| Reliability | Graceful fallback chain for screenshot tools on Linux |
| Cross-platform | Windows, macOS, Linux (X11 and Wayland) |
| Accessibility | Keyboard-navigable capture workflow |
| Security | API keys stored locally; optional encryption for projects |
| AI availability | Graceful degradation when API key missing; manual steps still work |
| AI latency | Instruction parsing < 30 s; per-screenshot description < 15 s |

---

## 11. Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ Implemented | Working in the current codebase |
| ✅ Partial | UI or backend exists but not fully wired |
| 🔲 Planned | Defined but not yet built |

---

*Last updated: June 2026*
