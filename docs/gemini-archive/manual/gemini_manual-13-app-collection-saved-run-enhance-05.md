This behavior highlights a foundational state conflict inside your core data layer.

### 🔍 Deep Root-Cause Analysis

Here is why your saved runs are either failing to update on a simple back-press or creating accidental duplicates when you use the save button:

1. **The Back-Press Ghosting Bug (Fails to Update):** Look closely at how Claude implemented **Rule A** in the back-guard handler:
```text
RULE A - Resumed Saved Runs:
- No e.preventDefault() call
- Silent autosave via updateSavedRun()
- Clears state and allows native exit

```


If you call `updateSavedRun()` and `clearActiveRun()` *without* calling `e.preventDefault()`, a critical asynchronous timing race occurs. Because writing to `AsyncStorage` and updating React Context states are asynchronous microtasks, the native navigation pop animation (`router.back()`) completes and unmounts the screen **before** the state actually finishes updating. When the homepage re-renders, it reads the old, unchanged storage file!
2. **The Save Button Duplication Bug (Creates a Copy):**
When you resume a saved run, your terminal footer or modal button is likely still pointing to your original fresh-run creator method: `saveCurrentRunForLater(name)`.
* `saveCurrentRunForLater` doesn't know this run already exists—it blindly generates a brand-new unique ID and pushes a new object into your list.
* This is why the old snapshot stays untouched, while a modified copy pops up next to it.



---

### 💡 The Production Solution Architecture

To fix both of these bugs permanently and ensure a seamless, professional experience, the app must treat a **Resumed Run** strictly as an **In-Place Update (Mutation)** rather than a creation event.

1. **Rule A Needs `preventDefault` & Synchronization Control:**
To make sure a silent back-press updates your home screen instantly, we must switch Rule A to call `e.preventDefault()` first. This halts the screen transition. We then explicitly await the state update before letting the navigation trigger fire:
```typescript
// Intercept back actions for resumed runs
e.preventDefault();
await updateSavedRun(activeRun.savedRunId, activeRun.currentSteps);
clearActiveRun();
router.back(); // Triggers ONLY after the database is 100% written

```


2. **Smart Terminal Save Handlers:**
Inside `app/flight-deck.tsx`, the primary save button can no longer blindly call `saveCurrentRunForLater()`. It must execute a conditional branch:
* **If it's a fresh run:** Show the input modal -> name it -> run `saveCurrentRunForLater()`.
* **If it's a resumed run:** Skip the naming input entirely. Update the existing item using `updateSavedRun()`, clear the runtime memory, and head back home.



---

### 🚀 Master Refactor Prompt for Claude to Fix the Persistence Engine

Copy and paste this explicit debugging instructions block into Claude to align your back guards and terminal buttons with a unified, overwrite-in-place workflow:

```text
System Role: You are a Principal Systems Architect and Lead React Native Developer specializing in asynchronous state synchronization, database thread resolution, and optimizing user interactions inside Expo Router.

Context:
We are deploying an absolute fix for two major state persistence regressions in "FlyManual" V8.6. Currently, when backing out of a resumed run, the home screen displays stale data because the navigation pop animation outruns our asynchronous database writes. Furthermore, using the standard terminal save button on a resumed session creates an unwanted duplicate instead of updating the existing item in place.

Your Tasks:
Provide the fully rewritten, complete, and un-truncated file configurations for 'app/flight-deck.tsx' and 'src/core/store.tsx' to completely stabilize our update-in-place mechanics.

Key Engineering Directives:

1. Repair Rule A Synchronization Race (app/flight-deck.tsx):
- Refactor the `beforeRemove` event listener inside your back-guard `useEffect` hook.
- For Resumed Saved Runs (Rule A), you MUST explicitly call `e.preventDefault();` as the first statement to halt the native unmounting animation.
- Convert your execution tracking block inside this handler to step through a synchronous sequence or clear promise chaining:
  1. Call `updateSavedRun(activeRun.savedRunId, activeRun.currentSteps)`.
  2. Call `clearActiveRun()`.
  3. Execute `router.back()`.
- By calling `preventDefault()` first and executing the update, you ensure that the dashboard reads completely fresh data when the home view mounts.

2. Unify Terminal Save Action Buttons (app/flight-deck.tsx):
- Locate your main footer save button callback (e.g., `handleSaveForLaterConfirm` or `handleExitSaveProgress`).
- Implement a clear conditional branch depending on whether the current run is a resumed instance (`isFromSavedRun` or a valid `savedRunId` exists):
  - CASE A (Is Resumed Saved Run): Bypass any text input layout modals or naming prompt alerts entirely. Instantly invoke `updateSavedRun(activeRun.savedRunId, activeRun.currentSteps)`, call `clearActiveRun()`, and execute `router.back()`. This updates the existing record cleanly in place.
  - CASE B (Is Fresh Run): Preserve the existing flow. Open the overlay prompt requesting a custom tracking name, and call `saveCurrentRunForLater(customName)` on submit.

3. Secure the Core State Mutators (src/core/store.tsx):
- Review your `UPDATE_SAVED_RUN` reducer operation. Ensure it correctly maps through the `savedRuns` state array, matches the target ID, and overwrites ONLY its inner steps status array immutably without duplicating elements.
- Verify that `updateSavedRun` forces an immediate `AsyncStorage.setItem('flightmanual::saved_runs', ...)` write block before returning to guarantee physical storage persistence.

Deliverable Constraints:
Do not provide shorthand code blocks, truncated snippets, or partial layout loops (`// rest remains same`). Return the absolute complete, unbroken text configurations for BOTH 'app/flight-deck.tsx' and 'src/core/store.tsx'. All components must be type-safe and ready to compile cleanly.

```

---

### 🛠️ Verification Routine

Once Claude outputs the clean codebase configuration scripts, run your standard environment reset:

1. **Wipe navigation memory tracks:**
```bash
npx expo start --clear

```


2. **Verify Back-Press AutoSave:** Resume any saved run, check off a single item, and press your phone's native back button. **The view will pop home smoothly, and your home dashboard card will instantly refresh to reflect the newly completed step fraction counters.**
3. **Verify Button Overwrite-In-Place:** Resume that same pending item, open the options menu, and click your manual Save button. **The view will close instantly without asking for a name, and your dashboard list will retain exactly one pristine updated record with zero duplicate blocks!**
