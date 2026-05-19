# 23 — Conditional Saved Run Deletion on Checklist Completion

## Source
`docs/gemini-archive/manual/gemini_manual-14-app-collection-saved-run-enhance-06.md`

## Problem
When a resumed saved run is completed (100% steps checked), it remains stuck as a zombie card on the dashboard. Two exit paths fail to clean it up:

1. **Rule A (back-press)** — blindly calls `updateSavedRun()` even when all steps are done. It saves a "pending" entry with 100% progress instead of finalizing it.
2. **`handleComplete()` button** — calls `completeRun()` to log history, but doesn't pass the `savedRunId` to scrub the pending entry from `savedRuns`.

## Solution
- Rule A checks `isFullyCompleted` before deciding: complete & scrub vs. update in-place
- `completeRun` accepts optional `savedRunId` parameter and removes that entry from `savedRuns` + AsyncStorage
- `handleComplete` passes `activeRun.savedRunId` to `completeRun`

---

## Files to Modify

| File | Change | Why |
|------|--------|-----|
| `src/core/store.ts` | `completeRun` accepts `savedRunId?`, scrubs from `savedRuns` + immediate AsyncStorage write | Removes zombie cards when resumed runs finish |
| `app/flight-deck.tsx` | Rule A: branch on `isFullyCompleted`. `handleComplete`: pass `savedRunId` | Both exit paths handle completion correctly |

---

## Task 1: Re-engineer `completeRun` (`src/core/store.ts`)

### Updated Action Signature

```typescript
// Context interface
completeRun: (savedRunId?: string) => Promise<void>;

// Reducer action
| { type: 'COMPLETE_RUN'; payload: { log: RunLog; savedRunId?: string } }
```

### Updated Reducer Case

```typescript
case 'COMPLETE_RUN': {
  const { log, savedRunId } = action.payload;

  // Filter out the completed saved run if it came from the pending registry
  const updatedSavedRuns = savedRunId
    ? state.savedRuns.filter((sr) => sr.id !== savedRunId)
    : state.savedRuns;

  return {
    ...state,
    activeRun: null,
    historyLogs: [...state.historyLogs, log],
    savedRuns: updatedSavedRuns,
  };
}
```

### Updated Action Function

```typescript
const completeRun = useCallback(async (savedRunId?: string) => {
  if (!state.activeRun) return;

  const log: RunLog = {
    collectionId: state.activeRun.currentSteps[0]?.parentTemplateName ?? 'unknown',
    timestamp: Date.now(),
    durationMs: Date.now() - state.activeRun.startedAt,
  };

  dispatch({ type: 'COMPLETE_RUN', payload: { log, savedRunId } });

  // Immediate AsyncStorage commit for both logs and saved runs
  try {
    // Update run logs
    const logsRaw = await AsyncStorage.getItem(KEYS.runLogs);
    const existingLogs: RunLog[] = logsRaw ? JSON.parse(logsRaw) : [];
    await AsyncStorage.setItem(KEYS.runLogs, JSON.stringify([...existingLogs, log]));

    // If savedRunId provided, scrub it from saved runs
    if (savedRunId) {
      const savedRaw = await AsyncStorage.getItem(KEYS.savedRuns);
      const savedRuns: SavedRun[] = savedRaw ? JSON.parse(savedRaw) : [];
      const cleaned = savedRuns.filter((sr) => sr.id !== savedRunId);
      await AsyncStorage.setItem(KEYS.savedRuns, JSON.stringify(cleaned));
    }
  } catch (e) {
    console.error('[FlightManual] completeRun persist failed:', e);
  }
}, [state.activeRun]);
```

---

## Task 2: Adapt Flight Deck Back-Guard (`app/flight-deck.tsx`)

### Add `isFullyCompleted` Evaluator

```typescript
// Inside component body, after activeRun null check
const isFullyCompleted = state.activeRun
  ? state.activeRun.currentSteps.filter((s) => !s.isCompleted).length === 0
  : false;
```

### Updated Rule A in Back-Guard

```tsx
// RULE A: Resumed saved run
if (isFromSaved) {
  e.preventDefault();

  if (isFullyCompleted) {
    // CASE 1: All steps done → finalize as completed, scrub from pending
    await completeRun(state.activeRun.savedRunId);
  } else {
    // CASE 2: Partially done → update in-place as pending
    await updateSavedRun();
  }

  clearActiveRun();
  router.back();
  return;
}
```

### Complete Fixed Back-Guard useEffect

```tsx
useEffect(() => {
  const onHardwareBack = () => {
    if (!state.activeRun) return false;

    const isUntouched = state.activeRun.currentSteps.filter((s) => s.isCompleted).length === 0;
    const isFullyCompleted = state.activeRun.currentSteps.filter((s) => !s.isCompleted).length === 0;

    // RULE A: Resumed saved run
    if (isFromSaved) {
      (async () => {
        if (isFullyCompleted) {
          await completeRun(state.activeRun!.savedRunId);
        } else {
          await updateSavedRun();
        }
        clearActiveRun();
        router.back();
      })();
      return true;
    }

    // RULE B: Fresh + untouched
    if (isUntouched) {
      clearActiveRun();
      return false;
    }

    // RULE C: Fresh + dirty
    setExitModalVisible(true);
    return true;
  };

  const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);

  const unsub = navigation.addListener('beforeRemove', async (e) => {
    if (!state.activeRun) return;

    const isUntouched = state.activeRun.currentSteps.filter((s) => s.isCompleted).length === 0;
    const isFullyCompleted = state.activeRun.currentSteps.filter((s) => !s.isCompleted).length === 0;

    // RULE A: Resumed saved run
    if (isFromSaved) {
      e.preventDefault();
      if (isFullyCompleted) {
        await completeRun(state.activeRun.savedRunId);
      } else {
        await updateSavedRun();
      }
      clearActiveRun();
      router.back();
      return;
    }

    // RULE B: Fresh + untouched
    if (isUntouched) {
      clearActiveRun();
      return;
    }

    // RULE C: Fresh + dirty
    e.preventDefault();
    setExitModalVisible(true);
  });

  return () => {
    backSub.remove();
    unsub();
  };
}, [state.activeRun, isFromSaved, navigation, completeRun, updateSavedRun, clearActiveRun]);
```

---

## Task 3: Update `handleComplete` Button (`app/flight-deck.tsx`)

### Before (broken)
```tsx
const handleComplete = () => {
  completeRun();            // ❌ Doesn't pass savedRunId — zombie card persists
  router.back();
};
```

### After (fixed)
```tsx
const handleComplete = async () => {
  if (!state.activeRun) return;
  // Pass savedRunId so completeRun scrubs it from the pending registry
  await completeRun(state.activeRun.savedRunId);
  clearActiveRun();
  router.back();
};
```

---

## Complete Rule Summary (Plans 20–23)

| Rule | Condition | `preventDefault`? | Action |
|------|-----------|--------------------|--------|
| A-1 | Resumed + 100% done | Yes | `completeRun(savedRunId)` → scrub from pending → log history → back |
| A-2 | Resumed + partially done | Yes | `updateSavedRun()` → update in-place → back |
| B | Fresh + untouched (0 completed) | No | `clearActiveRun()` → native back |
| C | Fresh + dirty (>0 completed) | Yes | Show exit modal |

| Button | Condition | Behavior |
|--------|-----------|----------|
| Complete Run & Reset | Any run | `completeRun(savedRunId?)` → log + scrub if resumed → back |
| Save & Exit | Resumed | `updateSavedRun()` → back (no naming) |
| Save & Exit | Fresh | `saveCurrentRunForLater(name)` → back (with naming) |

---

## Verification

1. `npx expo start --clear`

2. **Manual Finish Button**: Save a run → resume → complete all steps → tap "Complete Run & Reset" → zombie card gone from dashboard

3. **Back-Press Auto-Complete**: Resume a partial saved run → complete all remaining steps → press native back → zombie card gone, run logged to history

4. **Partial Back-Press**: Resume a saved run → check some (not all) steps → press back → card stays on dashboard with updated progress

5. **Fresh Complete**: Launch fresh collection → complete all steps → tap Complete → returns to dashboard, nothing stuck
