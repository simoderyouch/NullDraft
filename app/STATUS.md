# NullDraft Project Status

**Current Date:** 2026-01-19

## Overview
NullDraft is a screenshot-based documentation tool that allows users to define steps and capture screenshots for each step, organizing them into projects.

## Implemented Features

### 1. Project Management
- **Dashboard**: View recent projects with step counts and last modified times.
- **Create Project**: Start a new project with a clean interface.
- **Edit Project**: Modify existing projects, add/remove/reorder steps.
- **Persistence**: Projects are saved as JSON manifests in the user's data directory.

### 2. Step Workflow
- **Define Steps**: Add steps with titles and descriptions.
- **Reorder**: Drag-and-drop steps to change their order.
- **Capture Integration**: Steps are linked to the capture workflow.

### 3. Capture & Review
- **Review Page**:
    - View all steps before capturing.
    - **Visual Indicators**: Captured steps show a green checkmark and border.
    - **Thumbnails**: Hoverable/Clickable thumbnails of captured screenshots.
    - **Fullscreen Preview**: Click a thumbnail to view the full-size screenshot in a modal.
- **Capture Experience**:
    - HUD overlay guides through each step.
    - "Back to Review" button preserves project context.
    - Supports skipping steps.

### 4. Technical Details
- **Electron IPC**: Robust communication for file operations and window management.
- **Local File Access**: Configured to securely load local project images.
- **State Management**: Persists project state across different windows (Dashboard -> Edit -> Review -> Capture).

## Recent Updates
- Separated `CreateProject` (new) and `EditProject` (existing) workflows for better UX.
- Fixed image loading issues by configuring `webSecurity: false`.
- Improved navigation flow to ensure project data is preserved when moving back and forth between Review and Capture modes.
