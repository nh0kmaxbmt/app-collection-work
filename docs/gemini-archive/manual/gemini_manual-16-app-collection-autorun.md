To design this feature cleanly without introducing regressions, we will define it as **Plan 25: Persistent Recurring Routines with 4-Hour Post-Midnight Grace Window**.

By treating these workflows as a toggleable property on your collections, you gain the ability to convert *any* checklist (e.g., "Morning Meditation," "Gym Workout," or "Evening Review") into an automated, self-generating rolling goal.

Here is the complete blueprint, system logic, and Master Orchestration Prompt you can hand directly to Claude to write the code.

---

### 📋 Feature Specification & User Stories

#### User Story 1: Automated Initial Spawning

> *As a user, when I open the app for the first time in a new calendar day, I want my recurring routines to automatically appear as active cards on my dashboard with all checkmarks cleared, so that I don't have to manually create the run every morning.*

#### User Story 2: The Multi-Day Rolling Overwrite

> *As a user, if I fail to finish my routine on Tuesday, I want Wednesday morning to preserve my exact current progress in place (no backlog duplicates) so I can catch up. If I did complete it, I want Wednesday morning to wipe it clean and hand me a fresh slate.*

#### User Story 3: The Late-Night Sleep Grace Window

> *As a user who occasionally stays up past midnight, when I finish checking off my routine tasks at 1:30 AM, I want it to count toward the day I woke up on (the "previous" calendar day). When I wake up later that morning, I want a brand-new blank list waiting for me instead of having the app think I completed tomorrow's checklist early.*

---

### 🧩 The "Logical Date" Reset Engine Matrix

Instead of keeping track of background interval timers that drain phone battery, the state engine will resolve everything **on app foreground boot** by converting standard Calendar Dates into a custom **"Logical Date" string** (`YYYY-MM-DD`).

If the current system clock is between **12:00 AM and 4:00 AM**, the system subtracts 1 day from the date stamp, back-dating the completion.

Every time the home screen mounts, the store loops through any collection flagged with `isRecurring: true` and resolves its layout container using this truth matrix:

| Active Saved Run State | Run Progress | Completion Date (Logical) | Lifecycle Decision Action |
| --- | --- | --- | --- |
| **Does Not Exist** | N/A | N/A | **Spawn Fresh Run Instance** (`expiresAt: null`) |
| **Exists** | Incomplete (<100%) | N/A | **Leave Untouched** (Rolls over progress to next day) |
| **Exists** | Complete (100%) | **Matches Today's** Logical Date | **Leave Visible on Screen** (Shows your daily achievement) |
| **Exists** | Complete (100%) | **Before Today's** Logical Date | **Purge Old Run & Spawn Fresh Empty Run** |

---

### 📋 Revised Back-Guard Rule Matrix (Rules A–D)

Adding this feature expands your robust back-guard intercept system into a **5-Scenario Unified Core**. Persistent routines bypass all modal overlays and never expire.

| Rule | Run Type | Checklist Condition | `preventDefault`? | Action Executed |
| --- | --- | --- | --- | --- |
| **A-1** | Resumed Saved Run | 100% Progress Tier | Yes | `completeRun(savedRunId)` $\rightarrow$ Wipe Pending $\rightarrow$ Log History $\rightarrow$ Pop Back |
| **A-2** | Resumed Saved Run | Partial Progress Tier | Yes | `updateSavedRun()` $\rightarrow$ Update in-place $\rightarrow$ Pop Back |
| **B** | Fresh Standard Run | Untouched (0% done & no appended steps) | No | `clearActiveRun()` $\rightarrow$ Native Back animation unmounts view |
| **C** | Fresh Standard Run | Mutated Scope or Checked Box | Yes | **Halt transition $\rightarrow$ Display Action Confirmation Modal** |
| **D** | **Recurring Routine** | **Any Progress (0% to 100%)** | **Yes** | **Await `updateSavedRun()` $\rightarrow$ `clearActiveRun()` $\rightarrow$ Pop Back (No modals)** |

---

### 🚀 Master Refactor Prompt for Claude

Copy and paste this explicit configuration prompt into Claude to execute **Plan 25** across your workspace files.

```text
System Role: You are a Principal Systems Architect and Lead React Native Expert specializing in event-driven state orchestration, asynchronous caching, and robust calendar date tracking matrix engineering inside Expo Router.

Context:
We are deploying Plan 25 ("Persistent Recurring Routines with 4-Hour Post-Midnight Grace Window") for "FlyManual". We want to introduce an automated daily routine system. Instead of creating fresh runs manually for repeating items (like morning habits or bedtime routines), any collection flagged with `isRecurring` will self-instantiate on app boot. Unfinished items roll over to the next day seamlessly, and completed items reset to blank once a 4-hour morning grace window (4:00 AM) triggers a new "Logical Date."

Your Tasks:
Provide the fully written, complete, and un-truncated file configurations for 'src/core/config.ts', 'src/core/types.ts', 'src/core/store.tsx', and 'app/flight-deck.tsx'. Do not use placeholder omissions or truncated shorthand segments.

Key Engineering Directives:

1. Update Global Configurations (src/core/config.ts):
- Add a new helper method to 'APP_CONFIG': `getLogicalDate(date?: Date): string`.
  - Inside, look at the current hour. If `hours >= 0 && hours < 4`, shift the target date layout back by exactly 1 day. Return a clean date string wrapper format: `YYYY-MM-DD`.
- Add a utility function: `isNewLogicalDay(lastCheckedDateString: string): boolean`. It compares `getLogicalDate()` against the saved parameter string to determine if a rollover cleanup sweep is needed.

2. Expand Domain Interfaces (src/core/types.ts):
- Update the 'Collection' interface to support our selector flag: `isRecurring?: boolean;`.
- Update the 'RunInstance' interface to support tracking its generation date parameters: `logicalDate?: string; completedAtLogicalDate?: string;`.

3. Re-engineer the State Boot-Up Sync & Reset Loop (src/core/store.tsx):
- Inside your store's initialization `useEffect` routine (right after parsing collections and saved runs from AsyncStorage), execute a **Daily Recurring Routine Synchronization Check**:
  - Fetch the current Day Token using `APP_CONFIG.getLogicalDate()`.
  - Loop through all collections where `collection.isRecurring === true`.
  - Query your `savedRuns` state array to find a tracking match for that specific `collectionId`.
  - CASE 1 (No active instance exists): Automatically compile and push a new `RunInstance` into your `savedRuns` cache list. Configure its values with: `expiresAt: null` (never expires), and `logicalDate: currentDayToken`.
  - CASE 2 (An instance exists but progress is < 100%): Leave it completely untouched! This rolls over Tuesday's unfinished tasks into Wednesday automatically.
  - CASE 3 (An instance exists, is marked 100% complete, but its `completedAtLogicalDate` is BEFORE the currentDayToken): This means a new logical day has arrived! Purge the old completed run out of your array, and instantly compile a brand-new empty checklist for today.
- Ensure that the parent context method writing updates to disk saves these structural changes to AsyncStorage automatically.

4. Implement Flight Deck Interception Rules (app/flight-deck.tsx):
- Look up if the active run belongs to a recurring collection sequence:
  `const isRecurring = state.collections.find(c => c.id === activeRun?.collectionId)?.isRecurring;`
- Update your bottom-bar complete handler and back-guard `beforeRemove` listeners to implement **Rule D**:
  - If `isRecurring` is true, you MUST intercept the event by calling `e.preventDefault()`. 
  - If the user ticks checkboxes or completes 100% of the tasks, do NOT call `completeRun()` (which destroys standard runs). Instead, if progress hits 100%, update the instance values in-place by setting `completedAtLogicalDate: APP_CONFIG.getLogicalDate()`.
  - Await your `updateSavedRun(activeRun.savedRunId, activeRun.currentSteps)`, call `clearActiveRun()`, and execute `router.back()`. This entirely bypasses all confirmation exit modals, saving progress in place silently regardless of mutation status.

Deliverable Constraints:
- Do NOT output shorthand blocks, stub functions, or truncated layout comments (`// rest remains same`).
- Return the full, comprehensive code assets for: 'src/core/config.ts', 'src/core/types.ts', 'src/core/store.tsx', and 'app/flight-deck.tsx'. All structures must compile natively.

```

---

### 🛠️ Verification Routine After Claude Runs

When Claude returns the refactored code blocks, execute this testing sequence to verify your automated recurring engine works flawlessly:

1. **Flush Bundler Cache:**
```bash
npx expo start --clear

```


2. **Verify Auto-Generation:** Go to your collection editor view and toggle `isRecurring` to `true` on your Bedtime Routine manual. Head back home. The app will immediately auto-spawn an empty card for it in your active runs view without clicking "Start."
3. **Verify Silent Exit (Rule D):** Open the recurring card, check off a single step, and press back. The view will pop backwards silently with zero popup confirmation overlays.
4. **Verify Rollover & Expiry Protection:** Change your phone's system clock forward by 2 full days. Open the app. Notice that while your standard saved runs have been wiped out by the 24-hour garbage collection sweep, your **Recurring Routine card remains locked safely to your screen**, holding its partial progress until you decide to finish it!

