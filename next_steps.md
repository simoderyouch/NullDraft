# NullDraft - Implementation Roadmap & Next Steps

This document outlines the detailed steps required to move from the current skeleton to a functional Minimum Viable Product (MVP).

## 🚀 Phase 1: Core Functionality (The "Screenshot" Loop)

Before adding AI or complex backends, we need the app to successfully take and save a picture.

### 1.1 Implement Screenshot Logic in Electron
The `ipcMain.handle('capture-screenshot', ...)` in `app/src/main.ts` is currently empty.

**Steps:**
1.  **Install dependencies**:
    ```bash
    npm install screenshot-desktop
    ```
2.  **Update `main.ts`**:
    *   Import `screenshot-desktop`.
    *   Implement the handler to capture the screen.
    *   Save the image to a temporary or project execution folder.
    *   Return the file path to the renderer.

### 1.2 Connect HUD to Main Process
The HUD needs to trigger the screenshot and receive feedback.

**Steps:**
1.  **Frontend (HUD)**: Add a button in `app/src/App.tsx` (or your HUD component) that calls `window.electron.ipcRenderer.invoke('capture-screenshot')`.
2.  **Feedback**: Show a small "Flash" animation or "Saved" notification when the promise resolves.

---

## 🐍 Phase 2: Python Backend (The "Brain")

Your robust plan calls for Python (FastAPI) to handle AI and Document generation. We need to set this up alongside Electron.

### 2.1 Initialize Python Project
**Location**: Create a `backend/` folder in the root `NullDraft/` directory (sibling to `app/`).

**Steps:**
1.  Create `backend/requirements.txt`:
    *   `fastapi`
    *   `uvicorn`
    *   `python-docx`
    *   `openai`
    *   `python-multipart`
2.  Create virtual environment: `python -m venv venv`.
3.  Install: `pip install -r requirements.txt`.

### 2.2 Create Basic Server
Create `backend/server.py`:
*   Setup a simple FastAPI app.
*   Create a health check endpoint `GET /health`.
*   Run it on a specific port (e.g., `8000`).

### 2.3 Electron-Python Bridge
Electron needs to start the Python server when the app launches.

**Steps**:
1.  In `app/src/main.ts`, use Node's `child_process.spawn`.
2.  Spawn the python server on app ready.
3.  Kill the python process on `app.quit`.

---

## 🧠 Phase 3: AI & Instructions (The "Intelligence")

Now we make it smart. Transforming user text files into a "Plan".

### 3.1 Instruction Parsing Endpoint
**Backend**:
1.  Create `POST /analyze-instructions`.
2.  Accept a file or text content.
3.  **Integration**: Use `openai` library.
    *   Prompt: "You are a technical writer. Break this text into steps..."
    *   Return JSON: `[{ "id": 1, "text": "Login to app", "needs_screenshot": true }]`.

### 3.2 Frontend "New Project" Flow
**Frontend**:
1.  Create a "Drop Zone" for files in the new project screen.
2.  Send the file content to your local Python server (`localhost:8000/analyze-instructions`).
3.  **Store the result**: Save the returned JSON steps in the Electron app state (or a local `project.json` file).

---

## 📄 Phase 4: Document Generation (The "Output")

Finally, generate the Word doc.

### 4.1 Generation Endpoint
**Backend**:
1.  Create `POST /generate-report`.
2.  Input: JSON list of steps + File paths to the captured screenshots.
3.  **Logic**:
    *   Initialize `docx.Document`.
    *   Loop through steps.
    *   `doc.add_paragraph(step['text'])`.
    *   `doc.add_picture(screenshot_path)`.
    *   Save and return the path to the generated `.docx`.

### 4.2 Export Button
**Frontend**:
1.  Add "Export" button in the Dashboard.
2.  Call the Python endpoint.
3.  Open the folder containing the report.

---

## 🗓️ Immediate To-Do Checklist

- [ ] **[FE]** Install `screenshot-desktop` and implement `ipcMain` handler.
- [ ] **[BE]** Create `backend/` folder and `server.py` (Hello World).
- [ ] **[Glue]** Configure `main.ts` to spawn the Python server.
- [ ] **[FE]** Create a simple "Dashboard" UI to view the "Camera Feed" or Capture Button.
