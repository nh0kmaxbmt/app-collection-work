Let’s step back, align our coordinates, and patch these gaps cleanly. Your real-world usage has exposed a storage race condition and a major user experience gap between what the preloaded data can do vs. what your custom form can build.

Here is the complete review, the diagnostic breakdown of your issues, and the engineering blueprint for the new **Branch Creator** feature.

---

### 1. Feature Review & Agreed Scope

To keep the vision pristine, here is the exact feature matrix we have established and agreed to build for this MVP:

* **The Command Palette (Dashboard):** A minimalist launcher where the search input automatically captures keyboard focus. It bypasses hierarchical note storage completely.
* **Time-Weighted Scoring Engine:** A background utility that scores and pins templates to the top of your dashboard if their historical log timestamps match the current time of day.
* **The Flight Deck (Execution View):** A distraction-free layout enforcing linear integrity (Step $N$ is physically locked and dimmed until Step $N-1$ is checked).
* **The Clean Reset:** A one-tap final step that writes metadata (elapsed duration) to history logs and purges the active state to ensure the template resets fresh for next time.
* **Dynamic Multi-Select Matrix (V3):** Reversible runtime toggling. Checking multiple focus options (like "Legs" + "Core") appends their respective subtasks dynamically. Unchecking them filters them out instantly without breaking baseline progress.
* **The Template Architect:** A custom form layout where you can generate new, permanent routines out of your head.

---

### 2. Diagnosis: Why Custom Collections Disappear on Reload

The reason your data vanishes when Expo hot-reloads or cold-starts is a **seeding overwrite bug** inside your state hydration logic (`src/core/store.ts`).

**What is happening:** When the React context initializes, the code is likely looking at an empty state or checking a faulty variable, causing it to run the seed script and **overwrite** the local AsyncStorage array with the default Gym mock data *every single time* the JavaScript bundle reloads.

**The Fix:** The hydration loop must run a strict structural check. It must execute `AsyncStorage.getItem('flightmanual::templates')`. If that key returns a non-null string, it must `JSON.parse` it directly into the state and **halt**. It should only run the fallback seed function if the key returns absolute `null`.

---

### 3. UI Fixes for `create-template.tsx`

To fix the invisible/transparent button styling issue while aligning with a clean, high-contrast developer-utility aesthetic, replace your button Tailwind classes with solid, tactile colors:

* **Change the `[+ Add Step]` button style from transparent to a clear dark blue layout variant:**
* *Old NativeWind Class:* `bg-transparent border border-gray-700`
* *New NativeWind Class:* `bg-blue-600 active:bg-blue-700 dark:bg-blue-900 dark:active:bg-blue-800 px-4 py-3 rounded-xl flex items-center justify-center`
* *The Result:* Gives the component a visible, solid touch surface on mobile screens while cleanly differentiating it from the background.



---

### 4. New Feature Design: The "Branch Creator" in Template Builder

Right now, you can add a simple flat list of steps, but you have no way to create the dynamic choices (like choosing "Legs" vs "Core") that make the Gym template powerful. We need to introduce the **Branch Builder Component** to the creation workflow.

#### Feature Breakdown

1. **The Optional Branch Section:** Below the base steps section, add a section titled `[+ Add Dynamic Focus Branch]`.
2. **The Question Frame:** A text input capturing the conditional trigger question (e.g., *"What tools do I need today?"* or *"What focus group are we destroying?"*).
3. **The Option Matrix:** A dynamic list builder where you can declare option keys (e.g., Option A: `legs`, Option B: `core`).
4. **Nested Subtask Lists:** Underneath each option key, a separate miniature step input array allows you to type out the specific steps corresponding *only* to that choice.

#### User Story

> **As a user creating a custom "Coding Project Setup" collection**, I want to add a branching choice for "Frontend" and "Backend" inside the template builder, so that when I run the checklist later, I can toggle on either layer (or both) depending on what part of the architecture I am building that day.

#### Technical Mapping (Under the Hood)

When saving, the app takes these nested inputs and packages them into the unified JSON spec:

* It populates the template's `branchingStep.question`.
* It builds a key-value object under `branchingStep.options` containing your subtask arrays.
* It automatically tags each subtask with a matching `branchSource` flag so the multi-select matrix can append and remove them cleanly at runtime.

---

### 5. Revised Claude/GLM Execution Prompt

Use this prompt next to cleanly refactor the store persistence layer, fix the button styling bug, and add the full Branch Creator feature to your building interface:

```text
System Role: You are a Principal Systems Architect and Senior React Native Engineer specializing in Expo Router, NativeWind, and AsyncStorage.

Tasks to Execute:

1. Fix AsyncStorage Persistence Bug (src/core/store.ts):
- Locate the initialization/hydration engine code. 
- Ensure that when the app boots, it strictly reads 'flightmanual::templates' from AsyncStorage. If data exists, populate the local state with it. ONLY seed the default 'Gym Session Prep' template if the returned value from storage is completely null or missing.
- Double-check that 'saveCustomTemplate' correctly updates the React state AND stringifies the updated array back to 'flightmanual::templates' storage key immediately.

2. Refactor UI Button Styling (app/create-template.tsx):
- Locate the text button component for '[+ Add Step]'.
- Change its styling from transparent/black to a highly visible, solid dark blue touch state layout using NativeWind classes: 'bg-blue-600 active:bg-blue-700 dark:bg-indigo-950 dark:active:bg-indigo-900 border border-blue-500/30 px-4 py-3 rounded-xl'. Ensure the text inside is bold and crisp.

3. Implement the "Branch Creator" Engine Feature (app/create-template.tsx & src/core/store.ts):
- Modify the template creation screen schema interface to support building conditional workflows.
- Add a new sectional toggle: 'Add Conditional Branch Options'.
- When activated, expose a text input field for 'Branch Question' (e.g., "What focus group today?").
- Implement a dynamic array builder for Option Blocks. Each Option block has an 'Option Name' text input (e.g., "legs") and an independent sub-array list of steps.
- Update your form submit handler: When packaging the payload, append this object structure cleanly into the template schema as the 'branchingStep' property, auto-tagging sub-tasks with their corresponding 'branchSource' key under the hood.

Deliverable Constraints:
Provide the full, un-truncated file replacements for 'src/core/store.ts' and 'app/create-template.tsx'. Do not use placeholder omissions or skip layout trees. Ensure all components are built cleanly using proper React Native primitives.

```
