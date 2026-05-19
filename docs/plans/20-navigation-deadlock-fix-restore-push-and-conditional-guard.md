# 20 — Navigation Deadlock Fix: Restore Push & Conditional Guard

## Source
`docs/gemini-archive/manual/gemini_manual-11-app-collection-saved-run-enhance-03.md`

## Problem
Plan 19's fix (replacing all `router.push` with `router.replace`) created a **worse** bug — a dead-end screen lock:

1. **"No Active Run" Screen Lock** — `router.replace('/flight-deck')` wiped the homepage from the stack. When `activeRun` was cleared during an exit, the flight deck rendered its fallback "No active run" view. Because `e.preventDefault()` was unconditional, the hardware back button was blocked, trapping the user on a dead screen.

2. **"Save/Abandon" Deadlock** — With no home screen underneath, `router.replace('/')` had no valid history chain to navigate to, causing a lockup or crash.

## Root Cause
`router.replace` on forward navigation destroys the history stack. Without a home layer underneath the flight deck, there's nothing to fall back to when state clears.

## Solution
- **Restore `router.push('/flight-deck')`** — keep home alive underneath
- **Conditionalize `e.preventDefault()`** — only block native back when `activeRun` exists; when it's null (already saved/abandoned/completed), let the screen unmount natively

---

## Files to Modify

| File | Change | Why |
|------|--------|-----|
| `app/index.tsx` | Revert `router.replace('/flight-deck')` → `router.push('/flight-deck')` in all 3 locations | Restore home underneath flight deck so there's always a clean fallback |
| `app/flight-deck.tsx` | Move `e.preventDefault()` inside the `activeRun` null check | Allow native navigation when run is already cleared |

---

## Task 1: Restore `router.push` in `app/index.tsx`

Revert all three forward-launch locations back to `push`. This is the **opposite** of what plan 19 did.

### Before (broken — from plan 19)
```tsx
router.replace('/flight-deck');  // ❌ Wipes home from stack
```

### After (fixed)
```tsx
// All three launch locations in app/index.tsx:

// 1. Standard collection row tap
const handleLaunchCollection = (id: string) => {
  compileAndStartRun(id, false);
  router.push('/flight-deck');  // ✅ Keeps home alive underneath
};

// 2. Template row tap
const handleLaunchTemplate = (id: string) => {
  compileAndStartRun(id, true);
  router.push('/flight-deck');  // ✅ Keeps home alive underneath
};

// 3. Saved run "Resume" button
{state.savedRuns.map((sr) => (
  <Pressable
    onPress={() => {
      resumeSavedRun(sr.id);
      router.push('/flight-deck');  // ✅ Keeps home alive underneath
    }}
  >
```

---

## Task 2: Conditionalize Back-Guard in `app/flight-deck.tsx`

`e.preventDefault()` must NOT run when `activeRun` is null. The state check must come first.

### Before (broken — from plan 19)
```tsx
const unsubscribe = navigation.addListener('beforeRemove', (e) => {
  if (!state.activeRun) return;
  e.preventDefault();  // ❌ Runs on EVERY back gesture, even when run is already cleared
  // ...
});
```

### After (fixed)
```tsx
const unsubscribe = navigation.addListener('beforeRemove', (e) => {
  // 1. If no active run is processing, let the screen unmount natively
  if (!state.activeRun) {
    return;  // ✅ No preventDefault — allows natural navigation
  }

  // 2. Active run exists — block native animation to handle our state
  e.preventDefault();

  if (isFromSaved) {
    updateSavedRun();
    router.replace('/');
  } else {
    setExitModalVisible(true);
  }
});
```

### Complete Fixed Back-Guard useEffect

```tsx
useEffect(() => {
  // Android hardware back
  const onHardwareBack = () => {
    // No active run — allow normal back behavior
    if (!state.activeRun) return false;
    // Active run exists — intercept
    if (isFromSaved) {
      updateSavedRun();
      router.replace('/');
      return true;
    }
    setExitModalVisible(true);
    return true;
  };

  const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);

  // iOS swipe-back + header back
  const unsub = navigation.addListener('beforeRemove', (e) => {
    // CRITICAL: If no active run, skip preventDefault and let it unmount
    if (!state.activeRun) {
      return;
    }

    // Active run exists — block native back to handle our state
    e.preventDefault();

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
}, [state.activeRun, isFromSaved, navigation, updateSavedRun]);
```

---

## Task 3: Clean Exit Navigation Handlers in `app/flight-deck.tsx`

Each exit handler must: **(1) update/clear state FIRST**, then **(2) navigate**. Since home is preserved underneath via `router.push`, `router.replace('/')` or `router.back()` both work for returning to the dashboard.

### Sample Code: All Exit Handlers

```tsx
// Save for Later
const handleSaveAndExit = () => {
  // 1. State first — push to savedRuns, clear activeRun
  saveCurrentRunForLater(saveName.trim() || `Run ${new Date().toLocaleDateString()}`);
  // 2. UI cleanup
  setExitModalVisible(false);
  setSaveName('');
  setShowSaveInput(false);
  // 3. Navigate — home is alive underneath, so replace or back both work
  router.back();
};

// Abandon Run
const handleAbandon = () => {
  // 1. Clear state
  clearActiveRun();
  // 2. UI cleanup
  setExitModalVisible(false);
  setShowSaveInput(false);
  setSaveName('');
  // 3. Navigate back to the preserved home screen
  router.back();
};

// Complete Run & Reset
const handleComplete = () => {
  // 1. Log metrics, clear activeRun
  completeRun();
  // 2. Navigate back to the preserved home screen
  router.back();
};
```

> Note: Since `router.push('/flight-deck')` preserves home underneath, `router.back()` is the simplest and safest way to return. It pops the flight deck off the stack, revealing the original home screen. No `replace` needed.

---

## Navigation Flow After All Fixes

```
Forward launch:
  Stack: [Home] → push → [Home, Flight Deck]
  Home is alive underneath ✅

Save/Abandon/Complete exit:
  1. State cleared first (activeRun = null)
  2. router.back() pops flight deck
  Stack: [Home] — original instance, not a duplicate ✅

Back gesture with active run:
  1. e.preventDefault() blocks native animation
  2. Show exit modal (fresh run) or silent save (saved run)
  3. State cleared → router.back() → clean home ✅

Back gesture with NO active run:
  1. e.preventDefault() NOT called
  2. Native back fires normally → pops flight deck
  3. Lands on original home ✅

Hardware back from home:
  1. No flight deck in stack
  2. Normal app minimize/exit behavior ✅
```

---

## Verification

1. `npx expo start --clear` — clear Metro cache
2. **Launch collection** → verify flight deck renders with home underneath
3. **Save for later** → enter name → save → verify you land on the original home, NOT a duplicate
4. **Resume saved run** → press back → verify silent save + clean return to home
5. **Abandon run** → verify clean return to home, no dead-end screen
6. **Complete all steps** → tap "Complete Run & Reset" → verify clean return to home
7. **From home → press hardware back** → app should minimize/exit, NOT loop to flight deck
8. **No active run state** → if flight deck shows "No active run" → press back → should navigate to home (not locked)
