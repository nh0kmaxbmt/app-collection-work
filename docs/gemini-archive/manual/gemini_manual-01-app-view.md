Here is your comprehensive blueprints and execution plan for the MVP. It is designed around the **"Command Palette & Flight Deck"** concept we discussed—optimized for speed, linear execution, and zero friction, completely avoiding the bloat of standard todo apps.

---

## Part 1: MVP Feature Scope & User Stories

### Core Feature Scope

1. **The Launcher (Command Palette):** A single search input that prioritizes matching templates. It implements basic weighted probability (e.g., pinning "Gym" if the last 3 runs occurred around the current time).
2. **The Flight Deck (Active Run UI):** A dedicated view that instantiates a template into an active "Run." It displays steps sequentially, enforcing linear execution (Step 2 is locked until Step 1 is done).
3. **Branching Selector:** The ability for a template's first step to be a choice (e.g., "Leg Day" vs "Core Day") that dynamically injects specific subtasks.
4. **The Clean Reset:** A one-tap completion mechanism that logs metrics (timestamp, duration) to a history store and purges the active run state, resetting the app to a clean slate.

### User Stories

* **As a user**, I want to open the app and instantly focus on a search bar so I can type `gym` and hit Enter to launch my checklist in under 2 seconds.
* **As a user**, I want the app to look at the current time and suggest my "Gym Prep" checklist automatically if I usually do it at this hour.
* **As a user**, I want to select "Leg Day" at the start of my gym run so that I only see items relevant to legs, keeping my checklist minimal.
* **As a user**, I want upcoming steps to be visually locked or hidden until I complete the current prerequisite step, preventing me from skipping items in a rush.
* **As a user**, I want a clean reset button at the end of the run that saves my run history but leaves the master template completely untouched for next time.

---

## Part 2: Project Folder Structure

This structure uses a **modular, domain-driven layout** using TypeScript. It enforces a strict separation between core business logic (State/Types), UI components, and the Templates engine.

```text
📁 flightmanual-mvp/
│
├── 📁 public/
│   └── 📄 manifest.json          # PWA configuration for mobile installation
│
├── 📁 src/
│   ├── 📁 core/                  # Core domain logic, state, and storage
│   │   ├── 📄 types.ts           # Type definitions (Template, Instance, Run)
│   │   ├── 📄 store.ts           # LocalStorage state management engine
│   │   └── 📄 engine.ts          # Logic for branching & time-weighted sorting
│   │
│   ├── 📁 components/            # Atomic, reusable UI components
│   │   ├── 📄 CommandPalette.tsx # Search & launch interface
│   │   ├── 📄 FlightDeck.tsx     # Active linear execution view
│   │   ├── 📄 StepItem.tsx       # Individual step renderer (with gates/locks)
│   │   └── 📄 ProgressBar.tsx    # Visual feedback for the current run
│   │
│   ├── 📄 App.tsx                # Main layout and view state router
│   ├── 📄 index.css              # Global Tailwind configuration
│   └── 📄 main.tsx               # Application entry point
│
├── 📄 README.md                  # Project overview and setup instructions
├── 📄 TEMPLATES_SPEC.md          # JSON schema documentation for creating templates
├── 📄 tailwind.config.js
└── 📄 tsconfig.json

```

---

## Part 3: File-by-File Prompts for Claude / GLM

Use these exact prompts when generating the codebase. They enforce clean architecture, strict TypeScript types, and decouple UI from business logic.

### 1. Domain Types Engine (`src/core/types.ts`)

```text
Context: I am building a lightweight process execution app called "FlightManual". It runs templates as active ephemeral instances.
Task: Write a strictly-typed TypeScript file for 'src/core/types.ts'.
Requirements:
- Define a 'Step' interface: id (string), text (string), isCompleted (boolean), isLocked (boolean), dependsOnStepId (string, optional).
- Define a 'BranchCondition' interface: allows a step to contain multiple choices. Each choice maps to an array of conditional 'Step' objects.
- Define a 'Template' interface: id (string), name (string), tags (string[]), baseSteps: Step[], branchingStep?: { question: string; options: { [key: string]: Step[] } }.
- Define a 'RunInstance' interface: id (string), templateId (string), startedAt (number), currentSteps: Step[], isFinished (boolean).
- Define a 'RunLog' interface: templateId (string), timestamp (number), durationMs (number).
- No external libraries. Export all types clearly.

```

### 2. State Management Engine (`src/core/store.ts`)

```text
Context: Modern SPA with local persistence using TypeScript.
Task: Write 'src/core/store.ts' to manage state using React Context or a clean native vanilla store with subscribers (like a minimal custom store or Zustand if preferred, but prioritize zero-dependency custom hook if possible).
Requirements:
- Persist data to LocalStorage: templates, activeRun (RunInstance | null), and historyLogs (RunLog[]).
- Provide functions:
  1. loadTemplates(): loads mock data (include a comprehensive 'Gym Session' template with branch options for 'Legs' and 'Core').
  2. startRun(templateId): instantiates a template into activeRun, sets startedAt timestamp.
  3. toggleStep(stepId): marks a step complete. Crucial: Evaluate dependencies; when a step is completed, unlock the next linear step.
  4. selectBranch(optionKey): injects conditional steps into currentSteps based on user selection.
  5. completeRun(): calculates duration, appends to historyLogs, clears activeRun state to null (the clean reset).
- Write highly maintainable code with clear error boundaries.

```

### 3. Logic Engine (`src/core/engine.ts`)

```text
Context: Logic layer for calculating time-weighted suggestions.
Task: Write 'src/core/engine.ts'.
Requirements:
- Write a pure function 'getWeightedTemplates(templates: Template[], logs: RunLog[]): Template[]'.
- Logic: Analyze the historyLogs. Look at the last 5-10 logs. Compare the current hour (e.g., 5 PM) with the timestamps of past logs. If a template has been run frequently within a +/- 2-hour window of the current time, score it higher.
- Return the list of templates sorted by this score so the user gets intelligent suggestions on their dashboard based on their current routine habits.

```

### 4. UI: Command Palette (`src/components/CommandPalette.tsx`)

```text
Context: Tailwind CSS + React + TypeScript.
Task: Write the 'CommandPalette.tsx' component.
Requirements:
- Render a clean, minimalist full-width search input that automatically autofocuses on mount.
- Display a list of suggested templates filtered by search text.
- If search input is empty, display the templates sorted by the time-weighted engine.
- Layout must resemble macOS Spotlight or Raycast: clean borders, crisp typography, subtle keyboard-friendly UI cues.
- Clicking a template or hitting Enter triggers 'startRun(templateId)'.

```

### 5. UI: Flight Deck View (`src/components/FlightDeck.tsx` & `StepItem.tsx`)

```text
Context: The core execution environment UI.
Task: Write 'FlightDeck.tsx' and 'StepItem.tsx' as cohesive Tailwind-styled components.
Requirements:
- If 'activeRun' has a branching option unchosen, render a clean, distraction-free radio/button selector for the branch options (e.g., "Select Routine: Legs / Core").
- Render steps sequentially. Locked steps must look dimmed, blurred, or unclickable.
- Active steps must be large, high-contrast touch targets optimized for mobile use. 
- Use subtle animations or clear state transitions when a step is checked off and the next step unlocks.
- Display a fixed bottom bar containing a 'ProgressBar' and a prominent 'Complete Run / Reset' button that triggers 'completeRun()' once all steps are checked.

```

---

## Part 4: Core Project Documentation Files

Create these two files in your root directory to guide your development structure and handle configuration management.

### 📄 `README.md`

```markdown
# FlightManual MVP 🚀

A high-speed, lightweight process execution engine built to eliminate friction and cognitive load for recurring daily routines. Unlike project management apps (Jira) or text notes, FlightManual runs dynamic, linear instances of templates that reset completely upon completion.

## Core Pillars
1. **Search-First Interaction:** Instantly launch any routine from a global search command line.
2. **Linear Integrity:** Steps are sequentially gated. You cannot skip ahead or eyeball future tasks out of order.
3. **The Clean Reset:** Active execution states are ephemeral. Once finished, stats are logged and the UI is wiped pristine.

## Tech Stack Target
- Frontend: React (TypeScript)
- Styling: Tailwind CSS
- Persistence: LocalStorage / IndexedDB

## Getting Started
1. Run `npm install`
2. Run `npm run dev` to boot the application.
3. Use the global shortcut or autofocus search input to find the pre-loaded `Gym Session` template.

```

### 📄 `TEMPLATES_SPEC.md`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "FlightManualTemplate",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "baseSteps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "text": { "type": "string" },
          "isCompleted": { "type": "boolean" },
          "isLocked": { "type": "boolean" },
          "dependsOnStepId": { "type": "string" }
        },
        "required": ["id", "text", "isCompleted", "isLocked"]
      }
    },
    "branchingStep": {
      "type": "object",
      "properties": {
        "question": { "type": "string" },
        "options": {
          "type": "object",
          "additionalProperties": {
            "type": "array",
            "items": { "$ref": "#/properties/baseSteps/items" }
          }
        }
      },
      "required": ["question", "options"]
    }
  },
  "required": ["id", "name", "baseSteps"]
}

```
