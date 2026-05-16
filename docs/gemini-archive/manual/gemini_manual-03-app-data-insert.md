Those are two critical insights that completely shift this app from a hardcoded demo into a real, adaptable utility.

Pivoting the branching logic from a strict single-choice "gate" to a **Dynamic Multi-Select Matrix** prevents the app from locking up if you change your mind. Furthermore, adding an in-app **Template Builder** addresses the missing data-adding capability so you can use it for things outside of the gym.

Here is the fully upgraded **V3 MVP Specification, Feature Breakdown, and Implementation Plan** designed to handle multi-select execution and user-generated data.

---

## Part 1: V3 MVP Feature Breakdown

### 1. Dynamic Multi-Select Matrix (Enhanced Branching Engine)

Instead of forcing a single choice that permanently injects steps, the branching step now acts as a multi-select array toggle.

* **The Logic:** You can select **neither, one, or multiple** focus groups (e.g., both "Legs" and "Core").
* **Reversible Rendering:** If you check "Legs," its tasks append to the list. If you uncheck "Legs," those tasks are cleanly filtered out of the active session instantly without breaking your progress on the baseline steps.

### 2. The Built-in Template Architect (Data Insertion Layer)

To move past hardcoded mock data, the app gets a dedicated creation screen.

* **Template Form:** A clean UI to define a new collection title and descriptive tags.
* **Dynamic Step Factory:** An interactive list builder where you can hit `(+) Add Step` to write out your sequential checklist text, automatically chaining dependencies (`Step N` depends on `Step N-1`).

---

## Part 2: Updated User Stories

* **As a user**, I want to select both "Legs" and "Core" at the start of my gym session so that I can see my entire integrated routine in one unified checklist.
* **As a user**, I want to uncheck an option if my plans change, and have its associated conditional tasks vanish from my screen without resetting my baseline progress.
* **As a user**, I want a floating action button on the home dashboard that opens a creation form so I can add completely custom collections (like "Grocery Packing" or "Work Deployment") directly inside the app.
* **As a user**, I want to type out steps for my custom collections sequentially, knowing the app will automatically handle locking the next step until the previous one is checked.

---

## Part 3: V3 Data Schema Upgrades

To support dynamic task removal and user-generated templates, our TypeScript interfaces require a few upgrades:

```text
// Changes to src/core/types.ts

export interface Step {
  id: string;
  text: string;
  isCompleted: boolean;
  isLocked: boolean;
  dependsOnStepId?: string;
  branchSource?: string; // NEW: Tracks which option injected this task (e.g., 'legs')
}

export interface RunInstance {
  id: string;
  templateId: string;
  startedAt: number;
  currentSteps: Step[];
  selectedBranches: string[]; // UPDATED: Changed from string to string[] to allow multi-select
  isFinished: boolean;
}

```

---

## Part 4: Updated Project Folder Structure

We add a new screen view (`app/create-template.tsx`) inside the Expo Router directory to handle the collection builder.

```text
📁 flightmanual-mvp/
│
├── 📁 src/
│   ├── 📁 core/                  
│   │   ├── 📄 types.ts           # V3 Schemas (selectedBranches: string[], branchSource)
│   │   ├── 📄 store.ts           # Persists dynamic templates & handles toggle injection/purging
│   │   └── 📄 engine.ts          
│   │
│   └── 📁 components/            
│       ├── 📄 CommandPalette.tsx 
│       ├── 📄 FlightDeck.tsx     # Upgraded to handle multi-select branch UI
│       └── 📄 StepItem.tsx       
│
└── 📁 app/
    ├── 📄 index.tsx              # Landing Dashboard with an "Add New" FAB Button
    ├── 📄 flight-deck.tsx        
    └── 📄 create-template.tsx    # NEW: Form to input name, tags, and step arrays

```

---

## Part 5: Revised Code Generation Prompts for Claude / GLM

Feed these updated prompts to your AI models to apply the dynamic multi-select engine and creator features cleanly.

### 1. The V3 Core Context Store (`src/core/store.ts`)

```text
Context: React Native Context State engine for FlightManual using AsyncStorage.
Task: Write 'src/core/store.ts' using TypeScript.
Requirements:
- Manage local state for 'templates', 'activeRun', and 'historyLogs'. Seed with 'Gym Session Prep' if empty.
- Add an explicit function: 'saveCustomTemplate(name: string, tags: string[], stepTexts: string[])'. This function must take user input, map the stepTexts into an array of 'Step' objects, auto-assign sequential 'dependsOnStepId' strings so they are linearly gated, prepend a unique ID, push it to 'templates' state, and save to AsyncStorage.
- Rewrite 'toggleBranchOption(optionKey: string, branchSteps: Step[])':
  1. Check if optionKey already exists in activeRun.selectedBranches.
  2. If it does NOT exist: Add optionKey to selectedBranches. Append the branchSteps to activeRun.currentSteps. Ensure each appended step has 'branchSource: optionKey' set. Fix their 'dependsOnStepId' to map to the last base step.
  3. If it DOES exist: Remove optionKey from selectedBranches. Filter out and delete any steps from activeRun.currentSteps where 'branchSource === optionKey'.
- Ensure state updates trigger clean re-renders. Write fully production-ready code.

```

### 2. The Multi-Select Flight Deck UI (`app/flight-deck.tsx`)

```text
Context: Expo Router execution view using NativeWind and useFlightManual context.
Task: Write 'app/flight-deck.tsx'.
Requirements:
- Check if activeRun has branching step configuration.
- Render the branching options as a multi-select layout using clear, high-contrast toggle chips or checkable cards instead of a rigid single-option gate.
- Tapping an option must check/uncheck it. When tapped, invoke 'toggleBranchOption(key, steps)' from the store. This must instantly animate the injection or removal of tasks on screen.
- Render the current active list dynamically. The rest of the execution flow remains strictly linear—downstream steps stay visually locked until their prerequisite parent step is checked off.
- Render the bottom completion drawer once all currently visible tasks in the array evaluate to 'isCompleted === true'.

```

### 3. The New Template Builder Interface (`app/create-template.tsx`)

```text
Context: New creation form screen for FlightManual using NativeWind.
Task: Write 'app/create-template.tsx'.
Requirements:
- Build a clean form with text inputs for 'Template Name' and comma-separated 'Tags'.
- Create a dynamic dynamic step builder state array. Render an un-ordered list of current steps with a text input for each.
- Provide an '[+ Add Step]' button that appends a blank string to your inputs tracking array.
- Provide a save button. Clicking it verifies inputs are non-empty, triggers 'saveCustomTemplate(name, tags, steps)', clears the form state, and uses 'router.back()' to return to the search dashboard.
- Style with a minimalist dark layout matching a developer-tool utility aesthetic.

```

Using this v3 architecture, you can now tap a floating button on your home dashboard, type in a custom process, and immediately search and execute it using multi-select options.
