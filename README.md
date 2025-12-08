# NullDraft

AI-powered desktop application that turns instructions into step-by-step screenshot documentation.

## Features

- 📄 Upload instruction documents (PDF, DOCX, TXT, TEX)
- 🔍 AI-parsed step-by-step requirements
- 📸 Guided screenshot capture workflow
- 🎨 Clean, modern UI with glass-morphism design
- 📤 Export to multiple formats (DOCX, LaTeX, Markdown, PDF)

## Tech Stack

- **Electron** - Desktop application framework
- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Shadcn/ui** - UI component library
- **React Router** - Navigation
- **Framer Motion** - Animations
- **Vite** - Build tool

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Project Structure

```
src/
├── main.ts              # Electron main process
├── preload.ts           # Electron preload script
├── main.tsx             # React entry point
├── App.tsx              # React Router setup
├── index.css            # Global styles
├── components/
│   ├── ui/              # Shadcn UI components
│   ├── FloatingHUD.tsx  # Floating capture overlay
│   ├── StepItem.tsx     # Step list item component
│   └── Sidebar.tsx      # Navigation sidebar
├── pages/
│   ├── Dashboard.tsx    # Main home screen
│   ├── Review.tsx       # Step review screen
│   ├── Capture.tsx      # Capture mode screen
│   ├── Export.tsx       # Export screen
│   └── Settings.tsx     # Settings page
└── lib/
    └── utils.ts         # Utility functions
```

## Development

This is a UI-only MVP implementation. All business logic, API calls, and file processing are placeholders and need to be implemented.

## License

MIT

# NullDraft
