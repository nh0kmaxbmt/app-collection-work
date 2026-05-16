Here is the fully enhanced, end-to-end engineering blueprint for **FlightManual MVP**. This plan expands your original view-centric design into a complete system architecture by integrating a robust local data persistence layer, concrete mock datasets, interactive state lifecycles, and updated AI implementation prompts.

---

## Part 1: Data Architecture & Storage Schema

To maintain an ultra-lightweight codebase without spinning up an external backend, the app relies on a structured local database layer (implemented via **Expo SQLite** or **AsyncStorage**).

### 1. Key-Value / Table Mappings

The data layer is split into three structural domains:

```text
┌────────────────────────────────────────────────────────┐
│                      LOCAL STORAGE                     │
└───────────────────────────┬────────────────────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  TEMPLATES   │    │  ACTIVE_RUN  │    │   RUN_LOGS   │
│ (Master data)│    │(Mutable state)    │ (History logs)
└──────────────┘    └──────────────┘    └──────────────┘

```

#### Table A: `templates` (Static Master Records)

* **Key:** `flightmanual::templates`
* **Structure:** An array of immutable system processes containing metadata, sequentially gated baseline steps, and potential branching nodes.

#### Table B: `active_run` (Volatile Single-Instance Session)

* **Key:** `flightmanual::active_run`
* **Structure:** A nullable singular object. When `null`, the app is idle. When populated, it locks the UI into execution mode, keeping track of exact execution progress and start time.

#### Table C: `run_logs` (Historical Metrics Append-Only Store)

* **Key:** `flightmanual::run_logs`
* **Structure:** An array of historical run summaries. Used directly by the logic engine to calculate time-weighted probabilities for your routine habits.

---

## Part 2: Concrete Seed & Mock Data Configuration

To ensure your code generation models (Claude/GLM) build functional logic immediately, use this complete data payload. It contains a multi-branch Gym workflow and historical logs mimicking a user who typically works out in the late afternoon.

### Master Templates Seed (`templates.json`)

```json
[
  {
    "id": "tpl_gym_prep",
    "name": "Gym Session Prep",
    "tags": ["fitness", "daily"],
    "baseSteps": [
      {
        "id": "step_1",
        "text": "Fill up 1.5L water bottle",
        "isCompleted": false,
        "isLocked": false
      },
      {
        "id": "step_2",
        "text": "Pack lifting belt and clean towel into gym bag",
        "isCompleted": false,
        "isLocked": true,
        "dependsOnStepId": "step_1"
      },
      {
        "id": "step_3",
        "text": "Verify wireless headphones are charged > 50%",
        "isCompleted": false,
        "isLocked": true,
        "dependsOnStepId": "step_2"
      }
    ],
    "branchingStep": {
      "question": "What focus group are we destroying today?",
      "options": {
        "legs": [
          {
            "id": "branch_leg_1",
            "text": "Pre-pack squat shoes and knee sleeves",
            "isCompleted": false,
            "isLocked": true,
            "dependsOnStepId": "step_3"
          },
          {
            "id": "branch_leg_2",
            "text": "Consume non-stimulant pre-workout pump formula",
            "isCompleted": false,
            "isLocked": true,
            "dependsOnStepId": "branch_leg_1"
          }
        ],
        "core": [
          {
            "id": "branch_core_1",
            "text": "Roll out yoga mat and grab resistance bands",
            "isCompleted": false,
            "isLocked": true,
            "dependsOnStepId": "step_3"
          },
          {
            "id": "branch_core_2",
            "text": "Take multi-vitamin dose with light carb snack",
            "isCompleted": false,
            "isLocked": true,
            "dependsOnStepId": "branch_core_1"
          }
        ]
      }
    }
  }
]

```

### Historical Performance Logs Seed (`run_logs.json`)

*Note: Timestamps represent Unix epoch milliseconds corresponding to past late afternoon runs (around 17:00 / 5:00 PM) to test the engine sorting scoring algorithms.*

```json
[
  { "templateId": "tpl_gym_prep", "timestamp": 1778950800000, "durationMs": 420000 },
  { "templateId": "tpl_gym_prep", "timestamp": 1779037200000, "durationMs": 380000 },
  { "templateId": "tpl_gym_prep", "timestamp": 1779123600000, "durationMs": 510000 },
  { "templateId": "tpl_work_setup", "timestamp": 1779094800000, "durationMs": 210000 }
]

```

---

## Part 3: Data Interaction Lifecycle & State Management

The core value of this application is its predictable state machine. Below is the precise interaction lifecycle detailing how the UI components mutate your local data store during execution.

| Phase | User Action | Data Layer Operations | UI Transformation State |
| --- | --- | --- | --- |
| **1. Boot** | Opens Application | Reads `flightmanual::templates` & `flightmanual::run_logs`. Passes values into `getWeightedTemplates()`. | Input focuses. Command Palette pins highest-scoring template to the top. |
| **2. Init** | Selects "Gym Session Prep" | Hydrates data, generates a unique `RunInstance`, sets `startedAt = Date.now()`, writes to `active_run` store. | App routes to Flight Deck View. Master Search layout slides out. |
| **3. Gate** | Encounters branching step | Checks `active_run.branchingStep`. Waits for variable assignment. | Gated list halts. Displays high-contrast choice cards: **[ Legs ]** or **[ Core ]**. |
| **4. Ingest** | Taps option: **[ Legs ]** | Appends selected branch array directly into `active_run.currentSteps`. Recalculates dependencies. | Target steps inject dynamically. Step 1 flashes active; downstream items dim. |
| **5. Mutate** | Checks off Step 1 | Finds step in `active_run`, sets `isCompleted = true`. Finds steps where `dependsOnStepId == 'step_1'`, sets `isLocked = false`. Writes back to storage. | NativeWind layout triggers an animation. Step 1 strikes through; Step 2 gracefully unlocks. |
| **6. Purge** | Taps "Complete Run" | Calculates `durationMs = Date.now() - startedAt`. Pushes new `RunLog` item into history array. **Sets `active_run = null**`. | UI wipes completely pristine. View flashes a success state and returns to an empty Command Palette. |

---

## Part 4: Upgraded Structural Prompts for AI Coding (Full E2E Data Integration)

When implementing your project files using Claude or your GLM agent, use these revised prompts. They require the explicit inclusion of the database initialization, schema rules, and sample data injection blocks detailed above.

### Prompt 1: The Core Type Definitions (`src/core/types.ts`)

```text
Context: Building an ephemeral, high-speed checklist application called FlightManual using React Native/Expo.
Task: Generate the complete 'src/core/types.ts' file.
Requirements:
- Define strict TypeScript types mapping exactly to the schema properties of:
  1. Step (id, text, isCompleted, isLocked, dependsOnStepId)
  2. BranchingStep (question, options: Record<string, Step[]>)
  3. Template (id, name, tags, baseSteps, branchingStep)
  4. RunInstance (id, templateId, startedAt, currentSteps, selectedBranch, isFinished)
  5. RunLog (templateId, timestamp, durationMs)
- Export all interfaces. Do not use shortcuts or any external libraries.

```

### Prompt 2: Core Context Store & Persistence Layer (`src/core/store.ts`)

```text
Context: React Native Context State management engine with asynchronous persistent storage for FlightManual.
Task: Write 'src/core/store.ts' using TypeScript and '@react-native-async-storage/async-storage'.
Requirements:
- Create a 'FlightManualProvider' and custom hook 'useFlightManual()'.
- Manage three local state variables initialized from AsyncStorage: 'templates', 'activeRun', and 'historyLogs'.
- Inside the initialization hook, check if storage is empty. If it is, seed the storage with the exact comprehensive 'Gym Session Prep' master template structure and the 'run_logs' dummy performance history provided in the blueprint documentation.
- Implement and expose the following concrete atomic functions:
  1. startRun(templateId: string): Instantiates a RunInstance object, records the start timestamp, updates activeRun state, and saves to storage.
  2. selectBranch(optionKey: string): Dynamic injector logic. Grabs conditional steps from the template's branching configuration and inserts them cleanly into activeRun.currentSteps directly after the prerequisite dependency check step.
  3. toggleStep(stepId: string): Mutates isCompleted state. Crucial logic: Scan currentSteps sequentially; if stepId is marked completed, immediately find dependent steps matching its ID and flip their isLocked flags to false.
  4. completeRun(): Captures execution delta duration, builds an append-only RunLog entry, pushes to historyLogs, clears activeRun back to null, and updates storage.
- Wrap all async mutations in try/catch blocks with defensive error log statements.

```

### Prompt 3: Time-Weighted Ranking Analytics (`src/core/engine.ts`)

```text
Context: Algorithmic utility calculation layer for habit matching.
Task: Write a highly performant utility file 'src/core/engine.ts' using TypeScript.
Requirements:
- Implement a pure function: 'getWeightedTemplates(templates: Template[], logs: RunLog[]): Template[]'.
- Scoring Logic:
  1. Get the current operational system hour (0-23).
  2. Filter history logs to examine entries for matching templates.
  3. Look at past execution timestamps. If an historical log falls within a +/- 2-hour window of the current system hour, apply a weighted score calculation step to that template template entry.
  4. Sort the master array output descending based on calculated historical match frequency scores.
- Ensure proper handling of fallback defaults if historyLogs array length is equal to zero.

```

### Prompt 4: Search Dashboard & Run-time Execution View UI Configuration

```text
Context: Expo Router layouts styled with NativeWind Tailwind utility layers.
Task: Build out 'app/index.tsx', 'app/flight-deck.tsx', and 'src/components/StepItem.tsx'.
Requirements:
- Map components to the Data Interaction Lifecycle. 
- 'app/index.tsx': Renders a full screen Raycast-style spotlight input box. Uses engine functions to list weighted choices when empty. Hitting entry calls startRun() and routes cleanly to flight-deck.
- 'app/flight-deck.tsx': Subscribes directly to activeRun state. If a choice step is present and unselected, populates full screen touch buttons calling selectBranch(). Renders sequential items via StepItem. Renders a fixed progress metrics bar at the bottom with a clear completion trigger.
- 'src/components/StepItem.tsx': Uses NativeWind styling. Disabled items must use custom opacity/blur classes. Active steps utilize large mobile tap tracking frames.

```
