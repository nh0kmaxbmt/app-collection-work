# 22 — Async Race Fix & In-Place Save Handlers

## Source
`docs/gemini-archive/manual/gemini_manual-13-app-collection-saved-run-enhance-05.md`

## Problem 1: Back-Press Ghosting (Stale Data on Dashboard)
Plan 21's Rule A skips `e.preventDefault()` for resumed runs. This creates a race condition: `router.back()` unmounts the flight deck **before** the async `updateSavedRun()` + AsyncStorage write completes. The home screen re-renders with stale, unchanged data.

## Problem 2: Save Button Creates Duplicates
When a resumed run uses the modal's "Save Progress" button, it calls `saveCurrentRunForLater(name)` — which always creates a **new** entry with a fresh ID. The original saved run stays untouched, and a modified duplicate appears beside it.

## Solution
1. **Rule A must call `preventDefault`** — halt the native animation, await the storage write, then manually trigger `router.back()`
2. **Save button must branch** — resumed runs update in-place (no naming modal), fresh runs get the naming flow

---

## Files to Modify

| File | Change | Why |
|------|--------|-----|
| `app/flight-deck.tsx` | Rule A: add `preventDefault` + await sequence. Save button: conditional branch | Fixes async race and duplicate creation |
| `src/core/store.ts` | Verify `UPDATE_SAVED_RUN` reducer + immediate AsyncStorage write | Ensures physical storage persistence |

---

## Task 1: Fix Rule A Synchronization Race (`app/flight-deck.tsx`)

### Before (broken — from plan 21)
```tsx
// RULE A: Existing saved run — silent update and exit
if (isFromSaved) {
  updateSavedRun();   // Async — may not finish before unmount
  clearActiveRun();   // Runs immediately, doesn't wait
  return;             // No preventDefault — native back fires instantly
}
```

### After (fixed)
```tsx
// RULE A: Existing saved run — halt native, await write, then navigate
if (isFromSaved) {
  e.preventDefault();                // Halt native unmount
  await updateSavedRun();            // Await AsyncStorage write
  clearActiveRun();                  // Clear runtime scratchpad
  router.back();                     // Manually trigger navigation
  return;
}
```

### Complete Fixed Back-Guard useEffect

```tsx
useEffect(() => {
  const onHardwareBack = () => {
    if (!state.activeRun) return false;

    const isUntouched = state.activeRun.currentSteps.filter((s) => s.isCompleted).length === 0;

    // RULE A: Resumed saved run — await update, then exit
    if (isFromSaved) {
      (async () => {
        await updateSavedRun();
        clearActiveRun();
        router.back();
      })();
      return true; // Consumed — don't let native fire
    }

    // RULE B: Fresh run, untouched — silent exit
    if (isUntouched) {
      clearActiveRun();
      return false; // Let native back fire
    }

    // RULE C: Fresh run, dirty — show modal
    setExitModalVisible(true);
    return true;
  };

  const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);

  // iOS swipe-back + header back
  const unsub = navigation.addListener('beforeRemove', async (e) => {
    if (!state.activeRun) return;

    const isUntouched = state.activeRun.currentSteps.filter((s) => s.isCompleted).length === 0;

    // RULE A: Resumed saved run — halt, await, navigate
    if (isFromSaved) {
      e.preventDefault();
      await updateSavedRun();
      clearActiveRun();
      router.back();
      return;
    }

    // RULE B: Fresh run, untouched — silent exit
    if (isUntouched) {
      clearActiveRun();
      // Don't preventDefault — let native back fire naturally
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

---

## Task 2: Unify Terminal Save Action (`app/flight-deck.tsx`)

The save button must branch based on whether the run is resumed or fresh.

### Before (broken)
```tsx
// Always creates a new entry — even for resumed runs
const handleSaveAndExit = () => {
  saveCurrentRunForLater(saveName.trim() || `Run ${new Date().toLocaleDateString()}`);
  router.back();
};
```

### After (fixed)
```tsx
const handleSaveAndExit = async () => {
  if (isFromSaved) {
    // CASE A: Resumed run — update in-place, no naming needed
    await updateSavedRun();
    clearActiveRun();
    setExitModalVisible(false);
    setShowSaveInput(false);
    setSaveName('');
    router.back();
  } else {
    // CASE B: Fresh run — create new saved entry with custom name
    saveCurrentRunForLater(saveName.trim() || `Run ${new Date().toLocaleDateString()}`);
    setExitModalVisible(false);
    setShowSaveInput(false);
    setSaveName('');
    router.back();
  }
};
```

### Modal UI Conditional

```tsx
<Modal visible={exitModalVisible} animationType="fade" transparent>
  <View className="flex-1 items-center justify-center bg-black/60 px-6">
    <View className="w-full rounded-2xl bg-gray-900 p-6">
      <Text className="mb-2 text-xl font-bold text-white">
        {isFromSaved ? 'Save Changes?' : 'Leave Flight?'}
      </Text>
      <Text className="mb-6 text-sm text-gray-400">
        {isFromSaved
          ? 'Your progress will be updated.'
          : 'You have an active run in progress.'}
      </Text>

      {/* Fresh run: show naming input flow */}
      {!isFromSaved && !showSaveInput && (
        <Pressable
          onPress={() => setShowSaveInput(true)}
          className="mb-3 items-center rounded-xl bg-blue-600 py-3 active:bg-blue-700"
        >
          <Text className="text-sm font-bold text-white">Save Progress for Later</Text>
        </Pressable>
      )}

      {!isFromSaved && showSaveInput && (
        <View className="mb-3">
          <TextInput
            className="mb-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white"
            placeholder="Give it a name..."
            placeholderTextColor="#6b7280"
            value={saveName}
            onChangeText={setSaveName}
            autoFocus
          />
          <Pressable
            onPress={handleSaveAndExit}
            className="items-center rounded-xl bg-blue-600 py-3 active:bg-blue-700"
          >
            <Text className="text-sm font-bold text-white">Save & Exit</Text>
          </Pressable>
        </View>
      )}

      {/* Resumed run: direct save button, no naming */}
      {isFromSaved && (
        <Pressable
          onPress={handleSaveAndExit}
          className="mb-3 items-center rounded-xl bg-blue-600 py-3 active:bg-blue-700"
        >
          <Text className="text-sm font-bold text-white">Save & Exit</Text>
        </Pressable>
      )}

      {/* Abandon */}
      <Pressable
        onPress={() => {
          clearActiveRun();
          setExitModalVisible(false);
          setShowSaveInput(false);
          setSaveName('');
          router.back();
        }}
        className="mb-3 items-center rounded-xl border border-red-500/30 bg-gray-800 py-3 active:bg-gray-700"
      >
        <Text className="text-sm font-semibold text-red-400">Abandon Run</Text>
      </Pressable>

      {/* Cancel */}
      <Pressable
        onPress={() => {
          setExitModalVisible(false);
          setShowSaveInput(false);
          setSaveName('');
        }}
        className="items-center rounded-xl bg-gray-800 py-3 active:bg-gray-700"
      >
        <Text className="text-sm font-semibold text-gray-400">Cancel</Text>
      </Pressable>
    </View>
  </View>
</Modal>
```

---

## Task 3: Secure Core State Mutators (`src/core/store.ts`)

### Reducer (immutable, no duplicates)

```typescript
case 'UPDATE_SAVED_RUN': {
  if (!state.activeRun) return state;
  const savedRunId = state.activeRun.savedRunId;
  if (!savedRunId) return state;

  const updatedRuns = state.savedRuns.map((sr) =>
    sr.id === savedRunId
      ? {
          ...sr,  // Preserves id, customName, expiresAt
          runInstance: {
            ...sr.runInstance,
            currentSteps: state.activeRun!.currentSteps.map((s) => ({ ...s })),
          },
          savedAt: Date.now(),
        }
      : sr
  );

  return { ...state, savedRuns: updatedRuns };
}
```

### Action (immediate AsyncStorage commit)

```typescript
const updateSavedRun = useCallback(async () => {
  if (!state.activeRun?.savedRunId) return;

  const savedRunId = state.activeRun.savedRunId;
  const currentSteps = state.activeRun.currentSteps.map((s) => ({ ...s }));

  // 1. Update React state
  dispatch({ type: 'UPDATE_SAVED_RUN' });

  // 2. Immediate AsyncStorage commit — don't rely on useEffect cycle
  try {
    const raw = await AsyncStorage.getItem(KEYS.savedRuns);
    const runs: SavedRun[] = raw ? JSON.parse(raw) : [];
    const updated = runs.map((sr) =>
      sr.id === savedRunId
        ? {
            ...sr,
            runInstance: { ...sr.runInstance, currentSteps },
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

---

## Complete Rule Summary (Plans 20–22)

| Rule | Condition | `preventDefault`? | Action |
|------|-----------|--------------------|--------|
| A | Resumed saved run | **Yes** (plan 22 fix) | Await `updateSavedRun()` → `clearActiveRun()` → `router.back()` |
| B | Fresh + untouched (0 completed) | No | `clearActiveRun()` → native back fires |
| C | Fresh + dirty (>0 completed) | Yes | Show exit modal |

| Save Button | Condition | Behavior |
|-------------|-----------|----------|
| CASE A | Resumed run | `updateSavedRun()` → clear → back (no naming modal) |
| CASE B | Fresh run | Name input modal → `saveCurrentRunForLater(name)` → back |

---

## Verification

1. `npx expo start --clear`

2. **Back-Press AutoSave**: Resume a saved run → check one item → press native back → dashboard card instantly shows updated step count

3. **Button Overwrite-In-Place**: Resume saved run → check items → open modal → tap Save → exits without naming prompt → exactly one updated record on dashboard, zero duplicates

4. **Fresh Untouched**: Tap new collection → check nothing → press back → instant exit, no modal

5. **Fresh Dirty**: Tap new collection → check one item → press back → modal appears with naming input
