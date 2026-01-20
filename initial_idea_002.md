### NullDraft – Project Specification
# NullDraft

> An intelligent AI-powered desktop application that automates technical documentation by extracting screenshot requirements, guiding users through capture workflows with a floating HUD overlay, and generating or updating professional Word/LaTeX documents.

---

##  Overview

NullDraft bridges the gap between task execution and documentation by intelligently parsing assignment instructions, identifying required visual documentation points, and orchestrating the entire screenshot-to-document workflow through an elegant, non-intrusive interface.

**Key Value Propositions:**

- **Time Efficiency**: Reduce documentation time by 70-80%
- **Consistency**: Standardized figure numbering and formatting
- **Flexibility**: Works with new or existing documents
- **Intelligence**: AI-driven screenshot requirement detection

---

## 🏗️ System Architecture

### Architectural Overview

```
┌─────────────────────────────────────────────────────────┐
│                     User Interface Layer                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Main Control │  │ Floating HUD │  │ Preview Mode │  │
│  │   Dashboard  │  │   Overlay    │  │    Window    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Processing Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Document     │  │ LLM Engine   │  │ Task Manager │  │
│  │ Parser       │  │ (AI Analysis)│  │ & Scheduler  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Capture & Storage Layer                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Screenshot   │  │ Image        │  │ Asset        │  │
│  │ Engine       │  │ Processor    │  │ Manager      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Document Generation Layer               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Word         │  │ LaTeX        │  │ Markdown     │  │
│  │ Generator    │  │ Compiler     │  │ Exporter     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Workflow Models

### Model A: New Document Generation

```
START
  │
  ├─► Upload Instructions (PDF/TXT/DOCX)
  │
  ├─► AI Analysis & Extraction
  │    ├─ Identify steps
  │    ├─ Detect screenshot points
  │    └─ Generate captions
  │
  ├─► Task Review & Customization
  │    ├─ Edit descriptions
  │    ├─ Skip unnecessary steps
  │    └─ Reorder sequence
  │
  ├─► Guided Screenshot Capture
  │    ├─ Floating HUD appears
  │    ├─ User follows steps
  │    └─ Hotkey capture (Ctrl+Shift+S)
  │
  ├─► Automatic Processing
  │    ├─ Auto-naming
  │    ├─ Auto-cropping (optional)
  │    └─ Quality validation
  │
  ├─► Document Assembly
  │    ├─ Apply template
  │    ├─ Insert figures
  │    └─ Generate ToC/LoF
  │
  └─► Export (.docx / .tex / .md / .pdf)
```

### Model B: Existing Document Enhancement

```
START
  │
  ├─► Upload Existing Document (.docx / .tex)
  │
  ├─► Document Analysis
  │    ├─ Extract existing content
  │    ├─ Identify placeholders
  │    ├─ Detect missing figures
  │    └─ Parse figure references
  │
  ├─► Screenshot Plan Generation
  │    ├─ Map placeholders to requirements
  │    ├─ Suggest new figure locations
  │    └─ Maintain existing numbering
  │
  ├─► Guided Capture (as above)
  │
  ├─► Smart Document Update
  │    ├─ Preserve formatting
  │    ├─ Insert at placeholders
  │    ├─ Update figure numbers
  │    └─ Refresh List of Figures
  │
  └─► Export Updated Document
```

---

## ⭐ Feature Breakdown

### 🎯 MVP (Minimum Viable Product)

#### Core Features

|Feature|Description|Priority|
|---|---|---|
|**Document Upload**|Support .pdf, .docx, .txt, .tex|Critical|
|**AI Extraction**|Parse instructions, identify steps|Critical|
|**Screenshot Manager**|Full screen, window, region capture|Critical|
|**Floating HUD**|Always-on-top, glass-morphic overlay|Critical|
|**Hotkey System**|Customizable keyboard shortcuts|Critical|
|**Auto-Save**|Sequential naming and organization|Critical|
|**Document Export**|.docx, .tex, .md output|Critical|

#### User Experience Flow

1. **Upload Phase**: Drag-and-drop or browse for instruction files
2. **Review Phase**: Interactive checklist with edit/skip options
3. **Capture Phase**: Minimal, elegant overlay guides each step
4. **Export Phase**: One-click generation with format selection

---

### 🚀 Advanced Features (v2.0+)

#### Intelligence Layer

- **AI Auto-Cropping**: Detect and focus on relevant UI components
- **Sensitive Data Blur**: Automatic detection and obfuscation of passwords, emails, keys
- **Step Validation**: Compare captured screen with expected state
- **Missing Screenshot Detection**: Analyze user actions and flag gaps

#### Productivity Enhancements

- **Video Capture Mode**: Generate GIFs or MP4s for complex workflows
- **OCR Integration**: Extract text from screenshots for searchability
- **Flowchart Generation**: Auto-create process diagrams from steps
- **Session Management**: Save/resume documentation projects
- **Versioning System**: Track changes, regenerate only modified sections

#### Collaboration Features

- **Team Mode**: Multiple contributors on same document
- **Cloud Sync**: Real-time backup and sharing
- **Web Dashboard**: Remote monitoring and management
- **Review System**: Comments and approval workflows

#### Template Library

- Academic lab reports (TP)
- Internship/Co-op reports
- DevOps runbooks
- QA test case documentation
- Software user manuals
- API documentation guides

---

## 🛠️ Technical Stack

### Frontend Architecture

**Primary Choice: Electron + React**

```
Electron Shell
  ├─► React 18+ (UI Framework)
  ├─► TypeScript (Type Safety)
  ├─► TailwindCSS (Styling)
  ├─► Shadcn/UI (Component Library)
  ├─► Framer Motion (Animations)
  └─► Zustand (State Management)
```

**Key Libraries:**

- `electron-overlay-window`: Floating HUD implementation
- `electron-store`: Persistent settings storage
- `screenshot-desktop`: Cross-platform screen capture
- `robotjs`: Automation and hotkey management

**Why Electron?**

- Native desktop APIs
- Cross-platform (Windows, Mac, Linux)
- Rich ecosystem
- Easy screenshot integration
- WebView-based UI flexibility

---

### Backend Services

**Option 1: FastAPI (Python)**

```python
# Advantages
- Native python-docx integration
- Easy LaTeX templating with Jinja2
- PyPDF2 for PDF parsing
- Simple AI/LLM integration
- Fast async performance
```

**Option 2: Node.js + Express**

```javascript
// Advantages
- JavaScript everywhere
- docx library for Word generation
- Easy Electron IPC communication
- npm ecosystem
```

**Recommended Hybrid Approach:**

- Electron frontend ↔ FastAPI backend (REST/WebSocket)
- Best of both worlds: UI responsiveness + document processing power

---

### AI/LLM Integration

**Primary: OpenAI API**

- GPT-4 Turbo for complex parsing
- GPT-4o-mini for fast, cost-effective analysis
- Vision API for screenshot validation

**Alternative: Local Models**

- Llama 3.1 70B via Ollama
- Privacy-focused deployments
- No API costs for high-volume users

**LLM Prompt Architecture:**

```json
{
  "system": "Expert technical documentation analyzer",
  "task": "Extract structured screenshot requirements",
  "output_format": {
    "steps": [
      {
        "id": 1,
        "description": "Login to application",
        "needs_screenshot": true,
        "caption": "Figure 1 — Application login interface",
        "crop_hint": "center window",
        "expected_elements": ["username field", "password field", "login button"]
      }
    ]
  }
}
```

---

### Document Processing

#### Word (.docx) Generation

```python
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

def generate_report(figures, template_path=None):
    doc = Document(template_path) if template_path else Document()
    
    # Add title
    doc.add_heading('Technical Report', 0)
    
    # Insert figures
    for idx, fig in enumerate(figures, 1):
        doc.add_heading(f'Step {idx}: {fig["description"]}', 2)
        doc.add_picture(fig["path"], width=Inches(6))
        
        # Add caption
        caption = doc.add_paragraph()
        caption.add_run(f'Figure {idx}: {fig["caption"]}').italic = True
        caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        doc.add_paragraph()  # Spacing
    
    doc.save('report.docx')
```

#### LaTeX (.tex) Generation

```python
from jinja2 import Template

LATEX_TEMPLATE = r"""
\documentclass[12pt,a4paper]{article}
\usepackage{graphicx}
\usepackage{float}
\usepackage{caption}

\title{ {{- title -}} }
\author{ {{- author -}} }
\date{\today}

\begin{document}
\maketitle
\tableofcontents
\listoffigures
\newpage

{% for section in sections %}
\section{ {{- section.title -}} }
{{ section.content }}

{% for fig in section.figures %}
\begin{figure}[H]
    \centering
    \includegraphics[width=0.85\textwidth]{ {{- fig.path -}} }
    \caption{ {{- fig.caption -}} }
    \label{fig:{{ fig.id }}}
\end{figure}
{% endfor %}
{% endfor %}

\end{document}
"""

def generate_latex(data):
    template = Template(LATEX_TEMPLATE)
    output = template.render(**data)
    
    with open('report.tex', 'w') as f:
        f.write(output)
    
    # Optional: Auto-compile
    os.system('pdflatex report.tex')
```

#### Existing Document Update

```python
def update_existing_docx(doc_path, screenshots):
    doc = Document(doc_path)
    
    for para in doc.paragraphs:
        # Find placeholders
        if '{{FIGURE_' in para.text:
            fig_id = extract_figure_id(para.text)
            
            if fig_id in screenshots:
                # Clear placeholder
                para.clear()
                
                # Insert image
                run = para.add_run()
                run.add_picture(
                    screenshots[fig_id]['path'],
                    width=Inches(6)
                )
                
                # Add caption below
                caption_para = para.insert_paragraph_before()
                caption_para.add_run(
                    f"Figure {fig_id}: {screenshots[fig_id]['caption']}"
                ).italic = True
    
    doc.save('updated_report.docx')
```

---

## 🪟 Floating HUD Implementation

### Design Principles

- **Non-Intrusive**: Semi-transparent, small footprint
- **Always Accessible**: Stays on top, but dismissible
- **Context-Aware**: Shows relevant step information
- **Visually Appealing**: Glass-morphic, modern design

### Technical Implementation (Electron)

```javascript
const { BrowserWindow } = require('electron');

function createOverlay() {
  const overlay = new BrowserWindow({
    width: 400,
    height: 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true
    }
  });
  
  // Glass effect + modern design
  overlay.setIgnoreMouseEvents(false);
  overlay.loadFile('overlay.html');
  
  return overlay;
}
```

### UI Components

```jsx
// React Component
const FloatingHUD = ({ currentStep, totalSteps, onCapture, onNext }) => {
  return (
    <div className="backdrop-blur-xl bg-gray-900/80 rounded-2xl p-6 shadow-2xl border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">
          Step {currentStep} of {totalSteps}
        </span>
        <button onClick={onNext} className="text-blue-400 hover:text-blue-300">
          Skip →
        </button>
      </div>
      
      <h3 className="text-white text-lg font-semibold mb-2">
        {stepTitle}
      </h3>
      
      <p className="text-gray-300 text-sm mb-4">
        {stepDescription}
      </p>
      
      <div className="flex gap-2">
        <button 
          onClick={onCapture}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-medium transition-colors"
        >
          📸 Capture (Ctrl+Shift+S)
        </button>
      </div>
      
      <div className="mt-3 flex gap-2">
        <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Ctrl</kbd>
        <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Shift</kbd>
        <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">S</kbd>
      </div>
    </div>
  );
};
```

---

## 📸 Screenshot System

### Capture Modes

|Mode|Description|Use Case|
|---|---|---|
|**Full Screen**|Entire display|Dashboard views, full applications|
|**Active Window**|Focused application window|Specific software, dialog boxes|
|**Region Select**|User-drawn rectangle|UI components, specific sections|
|**Smart Crop**|AI-detected relevant area|Automatic focus on important elements|

### Hotkey Configuration

```javascript
const { globalShortcut } = require('electron');

// Register shortcuts
globalShortcut.register('CommandOrControl+Shift+S', () => {
  captureFullScreen();
});

globalShortcut.register('CommandOrControl+Shift+W', () => {
  captureActiveWindow();
});

globalShortcut.register('CommandOrControl+Shift+R', () => {
  startRegionSelect();
});
```

### Image Processing Pipeline

```
Capture → Format Conversion → Optimization → Metadata Addition → Storage
   │            │                  │               │                │
   │            │                  │               │                └─► Local + Cloud
   │            │                  │               └─► Caption, Step#, Timestamp
   │            │                  └─► Compress, Resize, Crop
   │            └─► PNG/JPG Selection
   └─► Raw Screen Buffer
```

---

## 🎨 User Interface Design

### Main Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  AutoReport Assistant                    [−] [□] [×]         │
├─────────────────────────────────────────────────────────────┤
│  📄 New Project  |  📂 Open Existing  |  ⚙️ Settings        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Drop your instruction file here                      │  │
│  │  or click to browse                                   │  │
│  │                                                        │  │
│  │  Supported: .pdf .docx .txt .tex                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Recent Projects:                                             │
│  • Lab Report #3 - Database Design (2 hours ago)             │
│  • Internship Report - Week 4 (Yesterday)                    │
│  • DevOps Pipeline Setup (3 days ago)                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Task Review Screen

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back    Review Screenshot Requirements    Start Capture → │
├─────────────────────────────────────────────────────────────┤
│  ✓ 8 steps identified  |  🖼️ 6 screenshots required          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ☑️ 1. Login to application                                  │
│     📸 Figure 1: Login interface                             │
│     [Edit] [Skip]                                            │
│                                                               │
│  ☑️ 2. Navigate to dashboard                                 │
│     📸 Figure 2: Main dashboard view                         │
│     [Edit] [Skip]                                            │
│                                                               │
│  ☐ 3. Configure settings                                     │
│     📸 Figure 3: Settings panel                              │
│     [Edit] [Skip]                                            │
│                                                               │
│  [+ Add Custom Step]                                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security & Privacy

### Data Handling

- **Local-First**: All screenshots stored locally by default
- **Encryption**: Optional AES-256 encryption for sensitive projects
- **Automatic Blur**: AI detection of passwords, API keys, emails
- **No Cloud by Default**: Cloud sync is opt-in only

### API Key Management

```javascript
// Secure storage using electron-store with encryption
const Store = require('electron-store');

const store = new Store({
  encryptionKey: 'user-specific-key',
  name: 'secure-config'
});

// Store API keys securely
store.set('openai.apiKey', apiKey);
```

---

## 🚀 Deployment & Distribution

### Build Configuration

```json
{
  "build": {
    "appId": "com.autoreport.assistant",
    "productName": "AutoReport Assistant",
    "directories": {
      "output": "dist"
    },
    "files": [
      "build/**/*",
      "node_modules/**/*"
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "assets/icon.icns"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "assets/icon.png"
    }
  }
}
```

### Auto-Update System

```javascript
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version is available. Download now?'
  });
});
```

---

## 📊 Future Roadmap

### Phase 1: MVP (Months 1-3)

- ✅ Core document parsing
- ✅ Screenshot capture system
- ✅ Basic Word/LaTeX export
- ✅ Floating HUD

### Phase 2: Enhancement (Months 4-6)

- 🔄 Existing document update
- 🔄 AI auto-cropping
- 🔄 Template library
- 🔄 Cloud sync

### Phase 3: Enterprise (Months 7-12)

- 📋 Team collaboration
- 📋 Web dashboard
- 📋 API access
- 📋 White-label options

### Phase 4: Ecosystem (Year 2+)

- 🌟 VS Code extension
- 🌟 Browser extension
- 🌟 Mobile companion app
- 🌟 Marketplace for templates

---

## 🎯 Success Metrics

- **Time Saved**: 70%+ reduction in documentation time
- **User Satisfaction**: 4.5+ star rating
- **Adoption Rate**: 10,000+ active users (Year 1)
- **Document Quality**: 95%+ correctly formatted outputs

---



