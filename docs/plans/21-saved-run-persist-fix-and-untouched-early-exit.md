# 21 — Saved Run Persistence Fix & Untouched Early-Exit Rule

## Source
`docs/gemini-archive/manual/gemini_manual-12-app-collection-saved-run-enhance-04.md`

## Problem 1: Saved Run Lost on Resume-Back
When resuming a saved run and pressing back, the app calls `updateSavedRun()` followed by `clearActiveRun()`. If `clearActiveRun()` accidentally filters the entry out of the `savedRuns` array instead of only clearing the temporary runtime state, the saved run is permanently lost.

## Problem 2: Annoying Modal on Untouched Runs
A collection instantiates `activeRun` the millisecond you tap it. Even if you check zero boxes and immediately press back, the back-guard sees `activeRun` exists and shows the Save/Abandon modal. This is friction for accidental taps.

## Solution
1. **Fix `updateSavedRun`** — write to `savedRuns` array + AsyncStorage immutably, then `clearActiveRun` only resets the runtime scratchpad
2. **Add "Mutation Delta Check"** — a run is "untouched" if zero steps are completed. Untouched runs bypass the modal entirely

---

## Files to Modify

| File | Change | Why |
|------|--------|-----|
| `src/core/store.ts` | Fix `updateSavedRun` reducer + action to write to AsyncStorage | Prevents saved run data loss on resume-back |
| `app/flight-deck.tsx` | Add `isUntouched` check + 3-rule conditional gate | Untouched runs exit silently, dirty runs show modal |

---

## Task 1: Secure Resumed Run Persistence (`src/core/store.ts`)

### Bug
`updateSavedRun` updates the in-memory `savedRuns` array but the data gets lost when `clearActiveRun` fires immediately after, or when the component unmounts before the next persist cycle.

### Fix
`updateSavedRun` must:
1. Find the target in `savedRuns` by ID
2. Replace its `runInstance.currentSteps` immutably
3. Update its `savedAt` timestamp
4. **Immediately commit to AsyncStorage** — don't wait for the useEffect persist cycle

### Sample Code: Fixed Reducer Case

```typescript
// In reducer
case 'UPDATE_SAVED_RUN': {
  if (!state.activeRun) return state;
  const savedRunId = state.activeRun.savedRunId;
  if (!savedRunId) return state;

  const updatedRuns = state.savedRuns.map((sr) =>
    sr.id === savedRunId
      ? {
          ...sr,
          runInstance: {
            ...sr.runInstance,
            currentSteps: [...state.activeRun!.currentSteps],
          },
          savedAt: Date.now(),
        }
      : sr
  );

  return {
    ...state,
    savedRuns: updatedRuns,
    // Do NOT clear activeRun here — that's clearActiveRun's job
  };
}
```

### Sample Code: Fixed Action with Immediate Persist

```typescript
const updateSavedRun = useCallback(async () => {
  if (!state.activeRun?.savedRunId) return;

  // 1. Update in-memory state
  dispatch({ type: 'UPDATE_SAVED_RUN' });

  // 2. Immediately persist to AsyncStorage (don't wait for useEffect)
  try {
    const savedRunId = state.activeRun.savedRunId;
    const updatedSteps = state.activeRun.currentSteps;
    const current = await AsyncStorage.getItem(KEYS.savedRuns);
    const runs: SavedRun[] = current ? JSON.parse(current) : [];
    const updated = runs.map((sr) =>
      sr.id === savedRunId
        ? {
            ...sr,
            runInstance: { ...sr.runInstance, currentSteps: [...updatedSteps] },
            savedAt: Date.now(),
          }
        : sr
    );
    await AsyncStorage.setItem(KEYS.savedRuns, JSON.stringify(updated));
  } catch (e) {
    console.error('[FlightManual] updateSavedRun persist failed:', e);
  }
}, [state.activeRun]);
```

### Sample Code: `clearActiveRun` — Only Clears Runtime

```typescript
// In reducer — must NOT touch savedRuns array
case 'CLEAR_ACTIVE_RUN': {
  return {
    ...state,
    activeRun: null, // Only clears temporary runtime scratchpad
    // savedRuns is NOT modified here
  };
}
```

---

## Task 2: Untouched Early-Exit Rule (`app/flight-deck.tsx`)

### The Mutation Delta Check
```typescript
const isUntouched = state.activeRun.currentSteps.filter((s) => s.isCompleted).length === 0;
```

### Three-Rule Conditional Gate

| Rule | Condition | Behavior |
|------|-----------|----------|
| A | Saved run (`isFromSavedRun`) | Silently update + clear + back, no modal |
| B | Fresh run + untouched (`isUntouched`) | Silently clear + back, no modal, no `preventDefault` |
| C | Fresh run + dirty (`!isUntouched`) | `preventDefault` + show exit modal |

### Sample Code: Complete Fixed Back-Guard

```tsx
useEffect(() => {
  // Android hardware back
  const onHardwareBack = () => {
    if (!state.activeRun) return false;

    const isUntouched = state.activeRun.currentSteps.filter((s) => s.isCompleted).length === 0;

    // RULE A: Existing saved run — silent update and exit
    if (isFromSaved) {
      updateSavedRun();
      clearActiveRun();
      router.back();
      return true;
    }

    // RULE B: Fresh run, untouched — silent cleanup and exit
    if (isUntouched) {
      clearActiveRun();
      router.back();
      return true;
    }

    // RULE C: Fresh run, dirty — show modal
    setExitModalVisible(true);
    return true;
  };

  const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);

  // iOS swipe-back + header back
  const unsub = navigation.addListener('beforeRemove', (e) => {
    if (!state.activeRun) return;

    const isUntouched = state.activeRun.currentSteps.filter((s) => s.isCompleted).length === 0;

    // RULE A: Existing saved run — silent update and exit
    if (isFromSaved) {
      updateSavedRun();
      clearActiveRun();
      // Don't preventDefault — let native back fire
      return;
    }

    // RULE B: Fresh run, untouched — silent cleanup and exit
    if (isUntouched) {
      clearActiveRun();
      // Don't preventDefault — let native back fire
      return;
    }

    // RULE C: Fresh run, dirty — intercept and show modal
    e.preventDefault();
    setExitModalVisible(true);
  });

  return () => {
    backSub.remove();
    unsub();
  };
}, [state.activeRun, isFromSaved, navigation, updateSavedRun, clearActiveRun]);
```

### Why Rules A and B Don't Call `preventDefault`

For both saved runs (A) and untouched runs (B), we want the native back animation to execute naturally. We clear state first, then let the system handle navigation:

- `clearActiveRun()` sets `activeRun` to null
- By the time the screen unmounts, the state is clean
- The native back gesture completes smoothly without conflict

---

## Verification

1. `npx expo start --clear`

2. **Test Flow 1 (Early Exit — Untouched)**:
   - Tap a collection from home
   - Check off absolutely nothing
   - Press back
   - Result: instantly drops to home with zero popups

3. **Test Flow 2 (Dirty Modal)**:
   - Tap the same collection
   - Check exactly one step
   - Press back
   - Result: Save/Abandon modal appears

4. **Test Flow 3 (Resume Caching)**:
   - Save a run as pending (via the modal)
   - Go to dashboard — verify pending card is there
   - Tap Resume
   - Check or uncheck an item
   - Press back
   - Result: exits silently, pending card remains on dashboard with updated progress

5. **Test Flow 4 (Resume No Changes)**:
   - Resume a saved run
   - Check nothing new
   - Press back
   - Result: exits silently, saved run data intact
