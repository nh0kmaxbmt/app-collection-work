Both of these problems stem from a single logical omission in the completion handling workflow. The application successfully shifts from creating copies to modifying saved runs in-place (Plan 22), but the final exit gateway (`handleComplete`) hasn't been adapted to check if the finished run originated from the saved runs registry.

When a session transitions from a **Pending/Saved** state into a **Finished/Archived** status, the data engine must execute an explicit transactional handoff: it needs to commit the run metrics to your history charts, clear the active workspace scratchpad, and completely scrub that specific ID entry out of the `savedRuns` storage array.

---

### 🧱 Root-Cause Analysis

#### Problem 1 & 2: The Orphaned Complete State

* **Why it's happening:** When you check off the very last step in a resumed saved run, you have two ways to exit: backing out via the native back handler (Rule A) or hitting the primary "Complete Run & Reset" action button at the bottom of the flight deck.
* Right now, **Rule A** blindly calls `updateSavedRun()` and returns home. It doesn't check if the checklist is completely done. It simply saves a pending instance with 100% of its steps checked.
* Similarly, **handleComplete()** triggers the global `completeRun()` state routine to log your execution history, but it entirely forgets to notify the store to clear that specific ID from the `savedRuns` database array. This leaves the completed run sitting as a zombie card on your dashboard layout indefinitely.

---

### 💡 The Production Solution Architecture

To align this engine with professional utility standards, the app needs to process the completion state conditionally inside both Rule A and the terminal completion handler:

1. **Auto-Promote Rule A to Completion on 100% Progress:**
Inside your back-guard `useEffect` listener block, Rule A should check if the session is fully completed before deciding to update it as a pending run:
```typescript
const isFullyCompleted = activeRun.currentSteps.filter(s => !s.isCompleted).length === 0;

if (isFromSavedRun) {
  e.preventDefault();
  if (isFullyCompleted) {
    // If the user checked everything and hit back, process it as a real completion!
    await completeRun(activeRun.savedRunId);
  } else {
    // Otherwise, save it in-place as a pending state
    await updateSavedRun(activeRun.savedRunId, activeRun.currentSteps);
  }
  clearActiveRun();
  router.back();
}

```


2. **Equip `completeRun` with an Eraser Hook:**
Your global data context reducer method (`completeRun`) needs to accept an optional parameter string: `savedRunId?: string`. When fired, it will push the session history log to your analytics array as usual, but if a `savedRunId` is passed, it will immutably strip that element out of your `savedRuns` database array and instantly write the clean, shorter collection list to `AsyncStorage`.

---

### 🚀 Master Refactor Prompt for Claude to Fix the Completion Lifecycles

Copy and paste this explicit architectural blueprint into Claude to handle the terminal execution cleanup states cleanly without placeholder code omissions:

```text
System Role: You are a Principal Systems Architect and Lead React Native Expert specializing in transactional state lifecycles, data array synchronization, and defensive local storage caching with Expo Router.

Context:
We are implementing Plan 23 ("Conditional Saved Run Deletion on Checklist Completion") for "FlyManual". Currently, when a user completes 100% of the tasks inside a resumed saved run and exits (either via a back-press or clicking the 'Complete Run & Reset' button), the application fails to scrub the item from the pending registry. The completed instance remains stuck as a zombie card on the dashboard instead of being moved to history and deleted from active memory.

Your Tasks:
Provide the fully rewritten, complete, and un-truncated file configurations for 'src/core/types.ts', 'src/core/store.tsx', and 'app/flight-deck.tsx' to completely resolve this collection completion defect.

Key Technical Specifications:

1. Update Types and Method Signatures (src/core/types.ts):
- Update the central state context action type definition for `completeRun` to accept an optional parameter string tracking the source container:
  `completeRun: (savedRunId?: string) => Promise<void>;`

2. Re-engineer the Completion Engine and Storage Reducers (src/core/store.tsx):
- Update your global context action handler for `completeRun(savedRunId)`.
- Inside this action routine, when updating states, ensure it captures the current session logs and pushes them to history.
- CRITICAL: If a valid `savedRunId` string is provided as an argument, execute a clean filter sweep across your primary `savedRuns` state array layout to immutably remove that matching element ID block.
- Immediately follow this state modification with an explicit `AsyncStorage.setItem('flightmanual::saved_runs', JSON.stringify(updatedSavedRuns))` write block to guarantee the physical storage registry drops the completed item instantly.

3. Adapt Flight Deck Completion Interceptors (app/flight-deck.tsx):
- Define a strict progress state evaluator string directly within your main component body workspace:
  `const isFullyCompleted = activeRun?.currentSteps.filter(s => !s.isCompleted).length === 0;`
- Refactor the `beforeRemove` event listener block (Rule A) inside your back-guard `useEffect`:
  - If `isFromSavedRun` is true, call `e.preventDefault();` to halt unmounting.
  - Add a sub-conditional branch:
    - CASE 1 (Is Fully Completed): Await `completeRun(activeRun.savedRunId)`. This automatically logs history, wipes the temporary execution variables, and clears the pending tracker out of the database.
    - CASE 2 (Is Partially Done): Await `updateSavedRun(activeRun.savedRunId, activeRun.currentSteps)`. This updates your in-place checkboxes normally.
  - Complete the sequence by invoking `clearActiveRun();` and `router.back();`.

4. Update Terminal Button Action Hooks (app/flight-deck.tsx):
- Locate your core bottom bar primary click handler: `handleComplete()`.
- Rewrite this callback function block to explicitly evaluate your active run constraints and pass the parameter down to the engine:
  ```tsx
  const handleComplete = async () => {
    if (!activeRun) return;
    await completeRun(activeRun.savedRunId); // Passes the ID to safely erase the pending record on finish
    clearActiveRun();
    router.back();
  };

```

Deliverable Constraints:
Do not provide shorthand snippets, partial module snippets, or comment abbreviations like `// rest of hook logic remains unchanged`. Return the absolute complete, unbroken text configurations for: 'src/core/types.ts', 'src/core/store.tsx', and 'app/flight-deck.tsx'. Every single file must be type-safe and ready to run.

```

---

### 🛠️ Production Verification Protocol
Once Claude completes the deployment of the updated state logic:

1. **Flush the System Architecture Cache:**
   ```bash
   npx expo start --clear

```

2. **Test Flow 1 (Manual Finish Button):** Create a pending run, return home, and click **Resume**. Toggle all remaining checkboxes until progress hits 100%, and click the bottom **Complete Run & Reset** action button. **The flight deck will drop away, and you will arrive back home to find your pending list perfectly clean and your zombie card completely gone!**
3. **Test Flow 2 (Back-Press Auto-Complete):** Resume another partial saved run. Toggle all checkboxes to complete it, and click your phone's native hardware back button instead. **The back-guard will recognize the 100% progress tier, silently finalize the session logs, clear it out of your pending database, and land you on a clean, empty home view instantly.**
