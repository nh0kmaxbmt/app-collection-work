# 18 — Centralized Config, Dynamic Expiry & Navigation Stack Fix

## Source
`docs/gemini-archive/manual/gemini_manual-09-app-collection-saved-run-enhance-01.md`

## Problem Statement
Two production bugs discovered during real-world testing:

1. **Duplicate Homepage (Navigation Stack Bloat)** — After saving/abandoning a run, `router.push('/')` pushes a new home screen on top of the flight deck instead of returning to the existing root. Pressing back then reveals the old flight deck underneath, creating a recursive loop.
2. **Hardcoded Expiry** — The 24-hour expiration threshold (`24 * 60 * 60 * 1000`) is a magic number embedded in store logic. Testing garbage collection requires physically waiting a full day.

## Solution
1. New `src/core/config.ts` — centralized app configuration with test/production mode toggle
2. Update `src/core/store.ts` — use dynamic expiry from config, add boot-time garbage collection sweep
3. Update `app/flight-deck.tsx` — enforce `router.replace('/')` in all exit paths

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/core/config.ts` | **CREATE** | Centralized app configuration with expiry durations and test mode toggle |
| `src/core/store.ts` | **MODIFY** | Import config, replace hardcoded expiry, add GC sweep on hydration |
| `app/flight-deck.tsx` | **MODIFY** | Replace all `router.push('/')` with `router.replace('/')` in exit callbacks |

---

## Task 1: Create `src/core/config.ts`

```typescript
// src/core/config.ts
// Centralized application configuration.
// Toggle IS_TEST_MODE to verify garbage collection in dev.

export const APP_CONFIG = {
  // Set to true to use short expiry times for testing GC sweeps
  IS_TEST_MODE: __DEV__ && false,

  EXPIRY_TIMES: {
    PRODUCTION: 24 * 60 * 60 * 1000, // 24 hours in ms
    TESTING: 30 * 1000,              // 30 seconds in ms
  },

  getExpiryDuration(): number {
    return this.IS_TEST_MODE
      ? this.EXPIRY_TIMES.TESTING
      : this.EXPIRY_TIMES.PRODUCTION;
  },
};
```

### How to Test
1. Set `IS_TEST_MODE: __DEV__ && true` (or just `true`)
2. Run `npx expo start --clear`
3. Save a run, wait 30 seconds, reload the app
4. The saved run card vanishes as the GC sweep triggers
5. Set back to `false` for daily use

---

## Task 2: Update `src/core/store.ts`

### Changes Required
1. Import `APP_CONFIG` from `./config`
2. Update `SavedRun` interface to include `expiresAt: number`
3. Replace hardcoded expiry in `saveCurrentRunForLater` with `APP_CONFIG.getExpiryDuration()`
4. Add garbage collection sweep in hydration `useEffect`

### Sample Code: Updated SavedRun Interface

```typescript
// Updated interface — add expiresAt
export interface SavedRun {
  id: string;
  customName: string;
  runInstance: RunInstance;
  savedAt: number;
  expiresAt: number; // NEW: dynamic expiry timestamp
}
```

### Sample Code: Updated saveCurrentRunForLater

```typescript
// In reducer — SAVE_RUN_FOR_LATER case
case 'SAVE_RUN_FOR_LATER': {
  if (!state.activeRun) return state;
  const saved: SavedRun = {
    id: `saved_${Date.now()}`,
    customName: action.payload.customName,
    runInstance: { ...state.activeRun },
    savedAt: Date.now(),
    expiresAt: Date.now() + APP_CONFIG.getExpiryDuration(), // Dynamic expiry
  };
  return {
    ...state,
    activeRun: null,
    savedRuns: [...state.savedRuns, saved],
  };
}
```

### Sample Code: Garbage Collection Sweep on Boot

```typescript
// In hydration useEffect — after loading savedRuns from storage
useEffect(() => {
  (async () => {
    try {
      const [colJson, tplJson, runJson, logsJson, savedJson] = await Promise.all([
        AsyncStorage.getItem(KEYS.collections),
        AsyncStorage.getItem(KEYS.templates),
        AsyncStorage.getItem(KEYS.activeRun),
        AsyncStorage.getItem(KEYS.runLogs),
        AsyncStorage.getItem(KEYS.savedRuns),
      ]);

      let savedRuns: SavedRun[] = savedJson ? JSON.parse(savedJson) : [];

      // Garbage collection: sweep expired saved runs on boot
      const now = Date.now();
      const beforeGC = savedRuns.length;
      savedRuns = savedRuns.filter((sr) => sr.expiresAt > now);
      const swept = beforeGC - savedRuns.length;

      if (swept > 0) {
        console.log(
          `[FlightManual] GC: Removed ${swept} expired saved run(s). ` +
          `${savedRuns.length} active saved run(s) remaining.`
        );
        // Persist the cleaned array immediately
        await AsyncStorage.setItem(KEYS.savedRuns, JSON.stringify(savedRuns));
      }

      dispatch({
        type: 'HYDRATE',
        payload: {
          collections: colJson !== null ? JSON.parse(colJson) : SEED_COLLECTIONS,
          templates: tplJson !== null ? JSON.parse(tplJson) : [],
          activeRun: runJson !== null ? JSON.parse(runJson) : null,
          historyLogs: logsJson !== null ? JSON.parse(logsJson) : SEED_LOGS,
          savedRuns,
        },
      });
    } catch (e) {
      console.error('[FlightManual] Hydration failed:', e);
      dispatch({
        type: 'HYDRATE',
        payload: {
          collections: SEED_COLLECTIONS,
          templates: [],
          activeRun: null,
          historyLogs: SEED_LOGS,
          savedRuns: [],
        },
      });
    }
  })();
}, []);
```

### Sample Code: Inline GC on Resume

```typescript
// Also sweep when resuming a saved run — check expiry before loading
const resumeSavedRun = useCallback((savedRunId: string) => {
  const saved = state.savedRuns.find((sr) => sr.id === savedRunId);
  if (!saved) return;

  // Check if expired
  if (saved.expiresAt <= Date.now()) {
    // Expired — remove it
    dispatch({ type: 'DELETE_SAVED_RUN', payload: savedRunId });
    return;
  }

  dispatch({ type: 'LOAD_SAVED_RUN', payload: savedRunId });
}, [state.savedRuns]);
```

---

## Task 3: Fix Navigation in `app/flight-deck.tsx`

### Rule
**BAN** all `router.push('/')` and `router.navigate('/')` in exit callbacks. **ONLY** use `router.replace('/')`.

### Affected Callbacks (search for each and fix)

| Callback | Current (broken) | Fixed |
|----------|-----------------|-------|
| Save for Later → Save & Exit | `router.push('/')` | `router.replace('/')` |
| Exit Modal → Abandon Run | `router.push('/')` | `router.replace('/')` |
| Back guard → saved run autosave | `router.replace('/')` (already correct from plan 17) | no change |
| Complete Run & Reset | `router.back()` | `router.replace('/')` |
| Standard finish flow | `router.back()` | `router.replace('/')` |

### Sample Code: All Exit Paths Using replace

```tsx
// 1. Save for Later — after saving
const handleSaveAndExit = () => {
  saveCurrentRunForLater(saveName.trim() || `Run ${new Date().toLocaleDateString()}`);
  setExitModalVisible(false);
  setSaveName('');
  setShowSaveInput(false);
  router.replace('/'); // NOT router.push('/')
};

// 2. Abandon Run
const handleAbandon = () => {
  clearActiveRun();
  setExitModalVisible(false);
  setShowSaveInput(false);
  setSaveName('');
  router.replace('/'); // NOT router.push('/')
};

// 3. Back guard — saved run autosave
const handleBackPress = () => {
  if (!state.activeRun) return false;
  if (isFromSaved) {
    updateSavedRun();
    router.replace('/'); // Already correct
    return true;
  }
  setExitModalVisible(true);
  return true;
};

// 4. Complete Run & Reset (bottom bar)
const handleComplete = () => {
  completeRun();
  router.replace('/'); // NOT router.back()
};
```

---

## Verification

1. **Navigation fix**: Start a run → save for later → verify no duplicate home screen in stack → press back → should NOT return to flight deck
2. **Config test mode**: Set `IS_TEST_MODE: true` → save a run → wait 30 seconds → reload app → verify saved run is gone and console shows GC sweep count
3. **Config production mode**: Set `IS_TEST_MODE: false` → save a run → verify it persists after reload → check `expiresAt` is 24h from now
4. **GC sweep**: Boot app with stale saved runs in storage → verify console log reports sweep count → verify storage is cleaned
