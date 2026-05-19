# 19 — Navigation Loop Fix: Forward Launch & Event Prevention

## Source
`docs/gemini-archive/manual/gemini_manual-10-app-collection-saved-run-enhance-02.md`

## Problem
Even after enforcing `router.replace('/')` in exit callbacks (plan 18), the app still spawns a duplicate homepage. Two hidden culprits cause this:

### Culprit A: Forward Launch Keeps Home Alive
When the dashboard launches a run using `router.push('/flight-deck')`, it keeps the home screen underneath in the stack. When the back-guard later fires `router.replace('/')`, the native OS back handler and the custom replace fire simultaneously, creating a double-navigation conflict that spawns a new home instance.

### Culprit B: Missing `e.preventDefault()` Before Custom Navigation
In the `beforeRemove` listener, if `e.preventDefault()` isn't called as the **absolute first step**, the native back animation executes concurrently with the custom `router.replace('/')`, causing the duplicate.

## Root Cause Visualization

```
BEFORE FIX (broken):
  Stack: [Home] → push → [Flight Deck]
  Back guard fires: native pop + router.replace('/') at the same time
  Result: [Home] → [Flight Deck] → [Home (DUPLICATE)]

AFTER FIX (clean):
  Stack: [Home] → replace → [Flight Deck]  (no home underneath)
  Back guard: e.preventDefault() first → router.replace('/') second
  Result: [Home] (single instance, clean)
```

---

## Files to Modify

| File | Change | Why |
|------|--------|-----|
| `app/index.tsx` | Change `router.push('/flight-deck')` → `router.replace('/flight-deck')` | Prevents stacking home under flight deck |
| `app/flight-deck.tsx` | Move `e.preventDefault()` to absolute first line in `beforeRemove` handler | Blocks concurrent native back animation |

---

## Task 1: Fix Forward Launch in `app/index.tsx`

Every place that navigates to the flight deck must use `replace` instead of `push`. Search for all occurrences of `router.push('/flight-deck')`.

### Before (broken)
```tsx
// Launching a collection
const handleLaunchCollection = (id: string) => {
  compileAndStartRun(id, false);
  router.push('/flight-deck');  // ❌ Keeps home underneath
};

// Launching a template
const handleLaunchTemplate = (id: string) => {
  compileAndStartRun(id, true);
  router.push('/flight-deck');  // ❌ Keeps home underneath
};

// Resuming a saved run
{state.savedRuns.map((sr) => (
  <Pressable
    onPress={() => {
      resumeSavedRun(sr.id);
      router.push('/flight-deck');  // ❌ Keeps home underneath
    }}
  >
```

### After (fixed)
```tsx
// Launching a collection
const handleLaunchCollection = (id: string) => {
  compileAndStartRun(id, false);
  router.replace('/flight-deck');  // ✅ Clean stack swap, no home underneath
};

// Launching a template
const handleLaunchTemplate = (id: string) => {
  compileAndStartRun(id, true);
  router.replace('/flight-deck');  // ✅ Clean stack swap
};

// Resuming a saved run
{state.savedRuns.map((sr) => (
  <Pressable
    onPress={() => {
      resumeSavedRun(sr.id);
      router.replace('/flight-deck');  // ✅ Clean stack swap
    }}
  >
```

### Full List of Changes in `app/index.tsx`
Search for every instance of `router.push` and replace:

| Location | Old | New |
|----------|-----|-----|
| Collection row press | `router.push('/flight-deck')` | `router.replace('/flight-deck')` |
| Template row press | `router.push('/flight-deck')` | `router.replace('/flight-deck')` |
| Saved run resume | `router.push('/flight-deck')` | `router.replace('/flight-deck')` |

---

## Task 2: Enforce `e.preventDefault()` First in `app/flight-deck.tsx`

The `beforeRemove` listener must call `e.preventDefault()` as its **absolute first statement** — before any state checks, before any navigation calls.

### Before (broken)
```tsx
const unsubscribe = navigation.addListener('beforeRemove', (e) => {
  if (!state.activeRun) return;          // ❌ Returns without preventing default
  if (isFromSaved) {
    updateSavedRun();
    router.replace('/');
    // ❌ e.preventDefault() never called — native back fires too
  } else {
    setExitModalVisible(true);
    // ❌ e.preventDefault() never called — native back fires too
  }
});
```

### After (fixed)
```tsx
const unsubscribe = navigation.addListener('beforeRemove', (e) => {
  // CRITICAL: Prevent native back animation FIRST, always
  // This must be the absolute first line before any conditional logic
  if (!state.activeRun) return; // No active run — allow normal navigation
  e.preventDefault();           // ✅ Strip native animation immediately

  if (isFromSaved) {
    // Silent autosave for resumed runs
    updateSavedRun();
    router.replace('/');
  } else {
    // Fresh run — show exit modal
    setExitModalVisible(true);
  }
});
```

### Complete Fixed Back-Guard useEffect

```tsx
useEffect(() => {
  const onHardwareBack = () => {
    if (!state.activeRun) return false; // Allow normal back
    if (isFromSaved) {
      updateSavedRun();
      router.replace('/');
      return true; // Consumed the event
    }
    setExitModalVisible(true);
    return true; // Consumed the event
  };

  // Android hardware back
  const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);

  // iOS swipe-back + header back
  const unsub = navigation.addListener('beforeRemove', (e) => {
    if (!state.activeRun) return; // Allow normal navigation
    e.preventDefault();           // Block native animation immediately

    if (isFromSaved) {
      updateSavedRun();
      router.replace('/');
    } else {
      setExitModalVisible(true);
    }
  });

  return () => {
    backSub.remove();
    unsub();
  };
}, [state.activeRun, isFromSaved, navigation]);
```

---

## Verification

1. **Clear Metro cache**: `npx expo start --clear`
2. **Test forward launch**: Tap a collection → verify stack is `[Flight Deck]` only (no home underneath)
3. **Test exit**: Start a run → press back → choose "Save for Later" → verify you land on a single home screen
4. **Test back-from-home**: From the home screen after saving → press hardware back → app should minimize/exit, NOT loop back into flight deck
5. **Test resume**: Resume a saved run → press back → should silently save and return to single home
6. **Test complete**: Finish all steps → tap "Complete Run & Reset" → should land on single home screen

### Expected Behavior After Fix
```
User taps collection row:
  [Home] → replace → [Flight Deck]

User presses back on flight deck:
  e.preventDefault() blocks native animation
  router.replace('/') fires cleanly
  [Home] — single instance, pressing back exits app
```
