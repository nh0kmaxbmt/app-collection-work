This is a brilliant product insight! You’ve identified the difference between a user who just opened a checklist to glance at it (**untouched baseline**) versus a user who modified the structural scope of the collection mid-flight (**mutated scope**).

If a user modifies a collection by appending a brand-new custom task, they have invested effort into customizing this specific execution instance. If they press back and the screen exits silently, that custom-appended step is permanently lost, which causes unexpected data loss.

---

### 🔍 Root-Cause & State Analysis

1. **Why it fails to pop up right now:**
Our current Plan 21/22 `isUntouched` formula looks purely at checklist item execution:
```typescript
const isUntouched = activeRun?.currentSteps.filter(s => s.isCompleted).length === 0;

```


If a user launches a fresh collection (e.g., with 5 baseline steps) and immediately clicks "+ Add Step" to append a 6th custom row but doesn't check any checkboxes yet, `isCompleted` is still `0` for all tasks. The app flags the run as `isUntouched === true`, invokes **Rule B**, and exits silently—permanently deleting their appended step.
2. **The "Dirty Scope" Formula Solution:**
To fix this, a session counts as modified if **either** of these conditions are met:
* Condition A (Progress Mutation): The user checked off one or more step boxes.
* Condition B (Scope Mutation): The current step count array size is different from the baseline collection template size they launched from.



---

### 💡 The Production Solution Architecture

We will implement **Plan 24 ("Structural Scope Mutation Delta Tracking")**.

Inside `app/flight-deck.tsx`, we locate the matching static collection template from our context data to compare lengths, or we track the baseline length when the run launches.

A clean way to achieve this without complex lookups is to leverage the fact that when a run initializes, `activeRun.currentSteps` is cloned from the collection. We can check if the current steps length is greater than the baseline collection's step length:

```typescript
// Look up the master collection template from the context store
const masterCollection = state.collections.find(c => c.id === activeRun?.collectionId);
const baselineStepCount = masterCollection ? masterCollection.steps.length : 0;

// A run is ONLY truly untouched if zero items are completed AND no steps were appended
const completedCount = activeRun?.currentSteps.filter(s => s.isCompleted).length || 0;
const currentCount = activeRun?.currentSteps.length || 0;

const isUntouched = completedCount === 0 && currentCount === baselineStepCount;

```

If `isUntouched` is `false` because `currentCount > baselineStepCount` (steps appended), the app will bypass the silent exit and route into **Rule C**, triggering the confirmation modal to ask if they want to save or abandon their customized session.

---

### 🚀 Master Refactor Prompt for Claude to Implement Plan 24

Copy and paste this explicit instructions block into Claude to deploy the structural scope mutation tracking:

```text
System Role: You are a Principal Systems Architect and Lead React Native Developer specializing in behavioral mutation tracking, relational delta checks, and bulletproof user interaction constraints inside Expo Router.

Context:
We are implementing Plan 24 ("Structural Scope Mutation Delta Tracking") for "FlyManual". Currently, our 'isUntouched' calculation only evaluates whether a checkbox has been ticked (`isCompleted`). If a user opens a fresh collection and appends a new custom step row but leaves it unchecked, the app incorrectly flags it as untouched, triggering a silent exit on back-press and discarding their appended step data. We need to catch structural scope modifications.

Your Tasks:
Provide the fully updated, complete, and un-truncated file configuration for 'app/flight-deck.tsx' to support both progress and structural scope mutation checking. Do not use placeholder omissions or truncated shorthand segments.

Key Engineering Directives:

1. Create a Consolidated Mutation Delta Check (app/flight-deck.tsx):
- Inside the main component body, look up the master baseline template reference matching the active run using your global state collections context:
  `const masterCollection = state.collections.find(c => c.id === activeRun?.collectionId);`
  `const baselineStepCount = masterCollection ? masterCollection.steps.length : 0;`
- Construct a comprehensive `isUntouched` boolean logic equation evaluating both checklist progress and structural scope shifts:
  ```tsx
  const completedStepsCount = activeRun?.currentSteps.filter(s => s.isCompleted).length || 0;
  const currentStepsCount = activeRun?.currentSteps.length || 0;

  // Untouched ONLY if nothing is completed AND no tasks have been appended or deleted
  const isUntouched = completedStepsCount === 0 && currentStepsCount === baselineStepCount;

```

2. Align the 4-Rule Back-Guard Lifecycle Matrix:

* Verify that your `beforeRemove` event listener inside the back-guard `useEffect` accurately processes the new conditional limits:
* RULE A-1 (Resumed & 100% Completed): Calls `completeRun(savedRunId)`, clears state, and executes `router.back()`.
* RULE A-2 (Resumed & Partially Completed): Calls `updateSavedRun(savedRunId, steps)`, clears state, and executes `router.back()`.
* RULE B (Fresh & Truly Untouched): Skips `e.preventDefault()`, calls `clearActiveRun()`, and executes native `router.back()` silently. This maintains zero friction for accidental taps.
* RULE C (Fresh & Mutated/Dirty): If `isUntouched` evaluates to `false` (either due to completed checkboxes OR appended step rows), it MUST call `e.preventDefault()` as the absolute first step and project the custom Action Confirmation Modal overlay.



3. Verify Integrity of Components and Handlers:

* Ensure that if the modal's "Save Progress" action triggers, it captures the appended steps correctly within the generated `savedRuns` database instance array.
* Retain all safe area insets, adaptive light/dark typography blocks, and dynamic `APP_CONFIG` expiration settings.

Deliverable Constraints:
Do not provide shorthand fragments, partial snippets, or short-form layout omissions (`// rest of file is unchanged`). Return the absolute complete, unbroken text configuration for 'app/flight-deck.tsx'. The file must compile cleanly and be fully type-safe.

```

---

### 🛠️ Verification Routine After Generation
Once Claude writes the new validation layout into your file, run your workspace clearing pipeline:

1. **Flush Metro's compilation track:**
   ```bash
   npx expo start --clear

```

2. **Test Flow 1 (Accidental Tap - Zero Changes):** Tap any collection to open the flight deck. Check nothing, append nothing, and hit back. **The screen exits natively and silently with no pop-up friction.**
3. **Test Flow 2 (Structural Mutation - Appended Step):** Open the collection again. Check zero boxes, but tap your "+ Add Step" interaction button to add a new task row. Now, press your back button. **The app will recognize the structural scope delta, intercept the back gesture safely, and display the protective "Save Progress / Abandon Run" modal, protecting your custom appended workflow!**
