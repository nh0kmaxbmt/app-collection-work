You have hit upon the exact design paradigm that solves the layout issue cleanly. By shifting the application from *chronological execution* (First Destination A, then Destination B) to **State Availability Tracking**, you have created a completely unique productivity mechanism.

Let's break down your design choices, look at how they solve the risks, map out the "Bookmark" engine, and look at how the item list dynamically restructures itself based on your logic.

---

### 1. Feature Breakdown: The V4 Architecture

#### Feature A: The `executionMode` Switch (Linear vs. Parallel)

Instead of forcing every checklist to behave the same way, each collection (or run configuration) can toggle between two modes:

1. **Linear Mode (Strict Order):** Enforces prerequisites. Only the first uncompleted step is unlocked.
2. **Parallel Mode (Separated Order):** All steps are visible and cross-off-able immediately. Great for grocery lists or packing, where it doesn't matter what item you put in the bag first.

#### Feature B: The "Routine Bookmark" Store

You shouldn't have to rebuild your day every morning by typing `Gym Base`, choosing `Legs`, and typing `Bookstore`.

* **The Solution:** When you assemble a perfect stack of collections for your day, a button labeled **"Save as Routine Bookmark"** appears.
* **How it works:** It saves a lightweight configuration file containing an array of target collection IDs and selected branch choices. Next time, it shows up on your home screen as a one-tap shortcut (e.g., "Saturday Errands").

#### Feature C: The "Smart Hybrid Viewport" (Bubbling Active Items)

When multiple collections are combined into a single run, the app uses a **Unified State Manager**. It visualizes your tasks separated by their parent collection headers, but its sorting adapts dynamically based on item availability:

```text
┌─────────────────────────────────────────────────────────┐
│              FLIGHT PLAN: SATURDAY ERRANDS              │
└─────────────────────────────────────────────────────────┘
                                                           
  🔥 NOW AVAILABLE (Bubbled to Top)                         
  ┌─────────────────────────────────────────────────────┐  
  │ 🏋️ GYM BASE PREP                                     │  
  │ [ ] Step 1: Fill up water bottle                    │  
  ├─────────────────────────────────────────────────────┤  
  │ 📚 BOOKSTORE EXTRAS                                 │  
  │ [ ] Step 1: Locate library card                     │  
  └─────────────────────────────────────────────────────┘  
                                                           
  ⏳ NEXT UP (Locked Downstream Steps)                     
  ┌─────────────────────────────────────────────────────┐  
  │ 🏋️ GYM BASE PREP                                     │  
  │ [🔒] Step 2: Pack clean towel                       │  
  ├─────────────────────────────────────────────────────┤  
  │ 📚 BOOKSTORE EXTRAS                                 │  
  │ [🔒] Step 2: Grab book bag                          │  
  └─────────────────────────────────────────────────────┘  

```

If **Gym Base** is set to Linear and **Bookstore** is set to Parallel:

* The app instantly bubbles the *first* item of Gym Base and *all* items of Bookstore to the top active zone.
* Future downstream linear items stay dimmed in a separate "Next Up" section underneath, cleanly separated by their respective collection tags.

---

### 2. Updated User Stories

* **As a user**, I want to toggle a collection to "Parallel Mode" when creating a packing list so I can throw items into my bag in any order without the app locking future steps.
* **As a user**, I want to combine my Gym Prep and Bookstore checklists, tap "Bookmark Routine," and name it "Gym + Reading Day" so I can instantly relaunch this compound setup next weekend.
* **As a user running a combined layout**, I want the app to pull the available first steps of all collections to the top of my viewport, while keeping them visually labeled by their parent collection, so I can see exactly what I can do *right now* across my whole day.

---

### 3. Structural Data Schema Upgrades (`src/core/types.ts`)

To allow multiple collections to be run together, ordered independently, and bookmarked as configurations, we define the schemas like this:

```typescript
// New Core Types for V4

export type ExecutionMode = 'linear' | 'parallel';

export interface Template {
  id: string;
  name: string;
  tags: string[];
  executionMode: ExecutionMode; // NEW: Controls step locking behavior
  baseSteps: Step[];
  branchingStep?: BranchingStep;
}

export interface RoutineBookmark {
  id: string;
  title: string;              // e.g., "Gym + Bookstore Run"
  templateIds: string[];      // Array of collections stacked together
  selectedBranches: {         // Predefined choices for branching subtasks
    [templateId: string]: string[]; 
  };
}

export interface RunInstance {
  id: string;
  bookmarkId?: string;        // Optional reference if launched from a bookmark
  startedAt: number;
  // Flattens all compiled steps into a cohesive tracking array
  currentSteps: (Step & { parentTemplateName: string; executionMode: ExecutionMode })[];
  isFinished: boolean;
}

```

---

### 4. Code Generation Prompt for Claude / GLM

Use this prompt to have your coding assistant build out this structural compilation engine and layout sorting logic.

```text
System Role: You are a Principal Systems Architect and Lead React Native Developer. You write pristine, production-ready, strictly-typed TypeScript utilizing Expo, NativeWind, and AsyncStorage.

Context:
We are upgrading "FlightManual" to V4. The app is evolving into a Composable Stack Architecture. Instead of running one isolated template, the execution engine compiles an array of combined Templates (or loads a RoutineBookmark configuration) into a singular active RunInstance. It handles per-template ExecutionModes ('linear' vs 'parallel') and sorts the UI via an Availability State Sorting Engine.

Your Tasks:

1. Update Types Layer (src/core/types.ts):
- Add 'executionMode: "linear" | "parallel"' to the Template interface.
- Create a 'RoutineBookmark' interface capturing id, title, templateIds array, and selectedBranches dictionary mappings.
- Update 'RunInstance' to maintain a unified cross-collection compilation step array tracking fields for 'parentTemplateName' and 'executionMode'.

2. Revamp Context Store Engine (src/core/store.ts):
- Manage an additional AsyncStorage persistent state collection for 'flightmanual::bookmarks'.
- Implement 'saveRoutineBookmark(title: string, templateIds: string[], selectedBranches: Record<string, string[]>)'.
- Implement 'compileAndStartRun(templateIds: string[], bookmarkBranches?: Record<string, string[]>)':
  1. Fetch all requested templates from local state.
  2. Map and flatten all base steps into the activeRun instance tracker.
  3. Pre-inject any chosen branch steps into the flattened array, tagging each item with its parentTemplateName and target executionMode parameters.
  4. Set 'isLocked' properties explicitly: If a parent collection is 'parallel', set all its steps' 'isLocked = false'. If it is 'linear', only set the first element's 'isLocked = false' and lock all subsequent dependent children blocks.

3. Implement the Availability State UI Layer (app/flight-deck.tsx):
- Build a custom rendering layout that processes the flattened active steps array.
- Group items visually by their 'parentTemplateName' header, but execute a dual-pass layout sort split into two distinct viewport wrappers:
  - Wrapper 1: "🔥 NOW ACTIVE" - Maps all items where 'isCompleted === false && isLocked === false'.
  - Wrapper 2: "⏳ NEXT UP" - Maps all items where 'isCompleted === false && isLocked === true'.
- Ensure checking an item in the Active area triggers immediate recalculation. If a linear step is cleared, find its next chronological parent sibling step within the compilation stream and move it from the Locked wrapper up into the Active viewport instantly.

Execution Constraints:
Provide the full, un-truncated file replacements for 'src/core/types.ts', 'src/core/store.ts', and 'app/flight-deck.tsx'. Do not use placeholder omissions or ellipsis shortcuts.

```

This composable approach solves the scalability problem. You can now build flat, highly modular lists, combine them arbitrarily based on where your day takes you, save that combination as a convenient bookmark, and view your day's tasks sorted solely by what you can physically execute *right now*.
