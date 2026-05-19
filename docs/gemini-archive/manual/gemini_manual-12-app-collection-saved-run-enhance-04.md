You have successfully eliminated the dangerous navigation loop deadlock! Now we are fine-tuning the exact *state criteria* for when a run counts as "modified" versus "untouched," and ensuring existing saved instances handle repeated background syncs correctly.

Let's break down exactly why you are losing your saved run data during that resume loop and how to structure the conditional logic to resolve your two new tasks.

---

### 🧱 Structural State Analysis

#### Task 1: Losing the Saved Run on Resume 🔄

* **Why it's happening:** Look closely at Claude's summary for `beforeRemove`:
```tsx
if (isFromSavedRun) {
  updateSavedRun(activeRun.savedRunId, activeRun.currentSteps);
  clearActiveRun(); // ❌ Here is the bug!
  router.back();
}

```


When you call `clearActiveRun()`, your global store reducer resets the execution state. If your context store logic resets the `activeRun` variable but accidentally clears or overlooks shifting that data cleanly back into your `savedRuns` array state layout block, the instance gets completely orphaned or dropped from memory on the subsequent screen mount.
* **The Fix:** When an existing saved run is backed out of, `updateSavedRun` must write the latest step checks securely to disk (`AsyncStorage`), and then `clearActiveRun()` should only clear the *temporary runtime scratchpad* without dropping the permanent entry tracker out of your main `savedRuns` storage array loop.

#### Task 2: The "Untouched" Early Exit Rule 🚪

* **Why it's happening:** Right now, the back-guard gate inside `app/flight-deck.tsx` checks a binary flag: `if (!activeRun) return;`. Because a collection initializes its structural active array the exact millisecond you tap it from the home screen, an active run technically *always* exists, even if you haven't checked off a single box yet! This forces the app to show the annoying "Save or Abandon" modal even if you just opened it by mistake and want to close it.
* **The Fix (The Mutation Delta Check):** We need to define what makes a session "dirty" (mutated) vs "clean" (untouched).
* A fresh run is **untouched** if `completedStepsCount === 0`.
* If a user opens a brand new collection, views it, checks off *zero* boxes, and presses back, we change our gate to bypass the modal entirely, trigger a silent `clearActiveRun()`, and run `router.back()`. It drops them home cleanly with no prompts.
* If they checked even *one* item, it counts as dirty, and the modal safely intercepts them.



---

### 🚀 Master Refactor Prompt for Claude

Copy and paste this explicit instructions block directly into Claude to implement the state tracking protections and early-exit logic:

```text
System Role: You are a Principal Systems Architect and Lead React Native Developer specializing in transactional state preservation, data mutation checks, and highly adaptive Expo Router navigation flow controls.

Context:
We are deploying stability updates for "FlyManual" V8.5. We need to fix a bug where resuming a pending saved run and pressing back causes the run to be deleted or lost from the dashboard, and implement an early-exit rule so that completely untouched checklist screens can be closed instantly without prompting the exit modal.

Your Tasks:
Provide the fully written, complete, and un-truncated file configurations for 'src/core/store.tsx' and 'app/flight-deck.tsx'. Do not use placeholder omissions or truncated shorthand segments.

Key Engineering Directives:

1. Secure Resumed Run Persistence (src/core/store.tsx):
- Review your `updateSavedRun(id, updatedSteps)` and `clearActiveRun()` context operations.
- Ensure that `updateSavedRun` searches the `savedRuns` storage array state, updates the target item's steps layout string immutably, and immediately commits those changes to AsyncStorage (`flightmanual::saved_runs`).
- Verify that calling `clearActiveRun()` only resets the temporary runtime scratchpad context container and does NOT filter out or clear that instance's entry from the primary persistent `savedRuns` state array database.

2. Implement the "Untouched Run" Early-Exit Rule (app/flight-deck.tsx):
- Inside your `beforeRemove` listener tracking hook, write a calculation tracking user progress checks:
  `const isUntouched = activeRun.currentSteps.filter(s => s.isCompleted).length === 0;`
- Modify your conditional interception gate logic to execute these precise rules:
  
  - RULE A: If it is an existing saved run instance (`isFromSavedRun` is true):
    - Call `updateSavedRun(activeRun.savedRunId, activeRun.currentSteps)` to silently commit latest checkbox updates, call `clearActiveRun()`, and immediately allow `router.back();` to execute without showing any modals.
  
  - RULE B: If it is a fresh run execution AND it is completely untouched (`isUntouched` is true):
    - Do NOT call `e.preventDefault()`. Do NOT show the confirmation modal. Simply invoke `clearActiveRun()` silently to clean memory, and let the system execute `router.back();` natively to drop the user back home immediately.
  
  - RULE C: If it is a fresh run and it HAS been modified/mutated (`isUntouched` is false):
    - Intercept cleanly: Call `e.preventDefault()`, and pop up your structured custom Action Confirmation Modal ("Save Progress" / "Abandon Run" / "Cancel").

3. Verify Complete Terminal Handlers (app/flight-deck.tsx):
- Ensure `handleExitAbandon()` completely clears out the temporary runtime active memory and drops back home using `router.back()`.
- Ensure all Tailwind/NativeWind class layout frames, dynamic config expiration values (`APP_CONFIG`), and safe area context constraints are preserved intact.

Deliverable Constraints:
Provide the absolute complete text contents for BOTH 'src/core/store.tsx' and 'app/flight-deck.tsx'. Do not truncate loops, compress state declarations, or leave unfinished nested hooks behind. Code must compile natively.

```

---

### 🛠️ Verification Routine

Once Claude handles the clean-slate file updates, run your workspace refresh sequence:

1. **Clear cache parameters:**
```bash
npx expo start --clear

```


2. **Test Flow 1 (Early Exit):** Tap a collection from home to launch the Flight Deck. Check off absolutely nothing, and hit your back button. **It will instantly drop you right back home with zero popups!**
3. **Test Flow 2 (Dirty Modal):** Launch that same collection, click just *one* step checkbox, and hit back. **The protective "Save or Abandon" modal will rise up safely.**
4. **Test Flow 3 (Resume Caching):** Save that run as a pending item, go to your dashboard, and click **Resume**. Uncheck or check an item, then click back. **The screen will exit silently, and your pending card will remain securely locked to the top of your dashboard list with updated progress tallies!**
