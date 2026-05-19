# 24 — Structural Scope Mutation Delta Tracking

## Source
`docs/gemini-archive/manual/gemini_manual-15-app-collection-return-enhance.md`

## Problem
The current `isUntouched` check (from plan 21) only evaluates checkbox completion:

```typescript
const isUntouched = activeRun.currentSteps.filter(s => s.isCompleted).length === 0;
```

If a user opens a fresh collection, appends a custom step via "+ Add Step", but checks zero boxes, `isUntouched` is still `true`. Rule B fires, the screen exits silently, and the appended step is permanently lost.

## Solution
Expand `isUntouched` to detect **both** progress mutations (checked boxes) **and** structural scope mutations (appended/deleted steps). Compare the current step count against the master collection's baseline step count.

A run is ONLY truly untouched if:
- Zero items are completed (progress mutation check)
- AND no steps were appended or removed (structural scope check)

---

## Files to Modify

| File | Change | Why |
|------|--------|-----|
| `src/core/types.ts` | Add `collectionId` field to `RunInstance` | Enables looking up the master collection for baseline comparison |
| `src/core/store.ts` | Set `collectionId` when compiling a run | Populates the new field |
| `app/flight-deck.tsx` | Replace `isUntouched` with dual-condition check | Catches structural scope mutations |

---

## Task 1: Add `collectionId` to RunInstance (`src/core/types.ts`)

### Updated Interface

```typescript
export interface RunInstance {
  id: string;
  collectionId?: string;       // NEW: References the primary collection that launched this run
  savedRunId?: string;
  startedAt: number;
  currentSteps: CompiledStep[];
  isFinished: boolean;
}
```

> Note: `collectionId` is optional because multi-collection compiled runs (templates) don't have a single source. For single-collection launches, it tracks the primary collection.

---

## Task 2: Set `collectionId` on Compile (`src/core/store.ts`)

### In `compileAndStartRun`

```typescript
const compileAndStartRun = useCallback(
  (id: string, isTemplate: boolean) => {
    let collectionIds: string[] = [];
    let primaryCollectionId: string | undefined;

    if (isTemplate) {
      const template = state.templates.find((t) => t.id === id);
      if (!template) return;
      collectionIds = template.templateIds;
    } else {
      collectionIds = [id];
      primaryCollectionId = id; // Track single-collection source
    }

    // ... existing compile logic ...

    dispatch({
      type: 'START_RUN',
      payload: {
        id: `run_${Date.now()}`,
        collectionId: primaryCollectionId,  // NEW
        startedAt: Date.now(),
        currentSteps: compiledSteps,
        isFinished: false,
      },
    });
  },
  [state.collections, state.templates],
);
```

---

## Task 3: Consolidated Mutation Delta Check (`app/flight-deck.tsx`)

### Before (broken — only checks completion)

```typescript
const isUntouched = state.activeRun.currentSteps.filter((s) => s.isCompleted).length === 0;
```

### After (fixed — checks completion AND structural scope)

```typescript
// Look up the master baseline collection template
const masterCollection = state.activeRun?.collectionId
  ? state.collections.find((c) => c.id === state.activeRun!.collectionId)
  : null;
const baselineStepCount = masterCollection ? masterCollection.steps.length : 0;

const completedStepsCount = state.activeRun?.currentSteps.filter((s) => s.isCompleted).length ?? 0;
const currentStepsCount = state.activeRun?.currentSteps.length ?? 0;

// Untouched ONLY if nothing is completed AND no tasks were appended or removed
const isUntouched = completedStepsCount === 0 && currentStepsCount === baselineStepCount;
```

### What This Catches

| Scenario | Completed | Step Count | `isUntouched` | Rule |
|----------|-----------|------------|---------------|------|
| Accidental tap, nothing changed | 0 | 5 (matches baseline 5) | `true` | B — silent exit |
| Checked 1 box | 1 | 5 | `false` | C — modal |
| Appended 1 custom step, nothing checked | 0 | 6 (baseline was 5) | `false` | C — modal |
| Removed a step, nothing checked | 0 | 4 (baseline was 5) | `false` | C — modal |
| Appended + completed some | 3 | 7 | `false` | C — modal |

### Updated Back-Guard with Dual-Condition Check

```tsx
useEffect(() => {
  const onHardwareBack = () => {
    if (!state.activeRun) return false;

    // Structural scope mutation delta check
    const masterCollection = state.activeRun.collectionId
      ? state.collections.find((c) => c.id === state.activeRun!.collectionId)
      : null;
    const baselineStepCount = masterCollection ? masterCollection.steps.length : 0;
    const completedCount = state.activeRun.currentSteps.filter((s) => s.isCompleted).length;
    const currentCount = state.activeRun.currentSteps.length;
    const isUntouched = completedCount === 0 && currentCount === baselineStepCount;
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

    // RULE B: Fresh + truly untouched (no progress AND no scope changes)
    if (isUntouched) {
      clearActiveRun();
      return false; // Let native back fire
    }

    // RULE C: Fresh + mutated (progress or scope)
    setExitModalVisible(true);
    return true;
  };

  const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);

  const unsub = navigation.addListener('beforeRemove', async (e) => {
    if (!state.activeRun) return;

    // Structural scope mutation delta check
    const masterCollection = state.activeRun.collectionId
      ? state.collections.find((c) => c.id === state.activeRun!.collectionId)
      : null;
    const baselineStepCount = masterCollection ? masterCollection.steps.length : 0;
    const completedCount = state.activeRun.currentSteps.filter((s) => s.isCompleted).length;
    const currentCount = state.activeRun.currentSteps.length;
    const isUntouched = completedCount === 0 && currentCount === baselineStepCount;
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

    // RULE B: Fresh + truly untouched
    if (isUntouched) {
      clearActiveRun();
      return; // Don't preventDefault — let native back fire
    }

    // RULE C: Fresh + mutated (progress OR scope)
    e.preventDefault();
    setExitModalVisible(true);
  });

  return () => {
    backSub.remove();
    unsub();
  };
}, [state.activeRun, isFromSaved, navigation, completeRun, updateSavedRun, clearActiveRun, state.collections]);
```

---

## Verification

1. `npx expo start --clear`

2. **Accidental Tap (Zero Changes)**: Open a collection → check nothing, append nothing → press back → exits silently with no popup

3. **Structural Mutation (Appended Step)**: Open the same collection → check zero boxes → tap "+ Add Step" to add a custom task → press back → the Save/Abandon modal appears, protecting the appended step

4. **Progress Mutation (Checked Box)**: Open collection → check one box → press back → modal appears (existing behavior, still works)

5. **Both Mutations**: Open collection → append a step AND check a box → press back → modal appears

6. **Resumed Run with Appended Steps**: Resume a saved run → append a custom step → press back → updates in-place (the appended step is preserved in the saved run)
