export interface ProjectTemplate {
  id: string
  name: string
  description: string
  steps: { title: string; description: string }[]
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'lab-report',
    name: 'Lab Report',
    description: 'Academic lab / TP documentation',
    steps: [
      { title: 'Objective', description: 'Capture the assignment objective or problem statement.' },
      { title: 'Environment setup', description: 'Show the tools and environment used.' },
      { title: 'Procedure', description: 'Document each action performed.' },
      { title: 'Results', description: 'Capture the output or results.' },
      { title: 'Conclusion', description: 'Summarize findings.' },
    ],
  },
  {
    id: 'bug-repro',
    name: 'Bug Reproduction',
    description: 'Step-by-step bug reproduction guide',
    steps: [
      { title: 'Initial state', description: 'Capture the starting state before the bug.' },
      { title: 'Reproduction steps', description: 'Show the actions that trigger the bug.' },
      { title: 'Error / unexpected behavior', description: 'Capture the error or unexpected result.' },
      { title: 'Expected behavior', description: 'Describe what should have happened.' },
    ],
  },
  {
    id: 'runbook',
    name: 'Runbook / Setup',
    description: 'IT / DevOps setup procedure',
    steps: [
      { title: 'Prerequisites', description: 'Capture required tools and access.' },
      { title: 'Installation', description: 'Document installation steps.' },
      { title: 'Configuration', description: 'Show configuration screens.' },
      { title: 'Verification', description: 'Capture the working result.' },
    ],
  },
  {
    id: 'tutorial',
    name: 'Tutorial / How-to',
    description: 'A teaching guide',
    steps: [
      { title: 'Introduction', description: 'Show the starting point.' },
      { title: 'Step 1', description: 'First action.' },
      { title: 'Step 2', description: 'Second action.' },
      { title: 'Final result', description: 'Show the completed outcome.' },
    ],
  },
]
