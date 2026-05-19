It is completely understandable to find this frustrating. When a navigation bug like this gets worse or leads to a completely locked screen with un-clickable buttons, it means the navigation history stack has been entirely stripped out or out-of-sync with the global React context state.

Let's look at why replacing `router.push` with `router.replace` created this dead-end screen, and how to fix it cleanly.

---

### 🔍 Root Cause Analysis

1. **The "No Active Run" Screen Lock:** By switching the forward launch in `app/index.tsx` from `router.push('/flight-deck')` to `router.replace('/flight-deck')`, the homepage was wiped out from the history stack. The moment the flight deck mounts, it is the *only* screen alive. If the global state (`activeRun`) is cleared a millisecond too early during an exit command, the file immediately renders its fallback view: `"No active run / Go Home"`. Because `e.preventDefault()` is running unconditionally at the top of the file, it traps you on that fallback view, blocking the hardware back button and making navigation impossible.
2. **The "Save Run / Abandon Run" Deadlock:** Because the home screen is no longer sitting underneath the flight deck, running `router.replace('/')` tells Expo Router to find a root path that doesn't exist in its current linear history chain. Instead of gracefully sliding back, it breaks or locks up.

---

### 💡 The Solution Blueprint

To make sure saving or abandoning a run brings you back to a single, working homepage, we must alter the design pattern to follow how Expo Router handles modal stacks:

* **Restore `router.push('/flight-deck')` on Home:** Keep the homepage alive underneath. This is critical so there is always a clean home layer to step backward into.
* **Fix the Event Listener Block:** Inside `app/flight-deck.tsx`, `e.preventDefault()` must **not** run on the absolute first line unconditionally. If `activeRun` is null (meaning the run has successfully completed, been abandoned, or already saved), we must skip the prevention entirely and let the app navigate away cleanly.

---

### 🚀 Master Refactor Prompt for Claude

Copy and paste this explicit instructions block into Claude to restore smooth, non-locking navigation back to your dashboard workspace:

```text
System Role: You are a Principal Systems Architect and Lead React Native Engineer specializing in Expo Router navigation stacks, low-level event lifecycle coordination, and bulletproof user interface state recovery.

Context:
We are fixing a critical screen deadlock on the Flight Deck ('app/flight-deck.tsx') and Home Dashboard ('app/index.tsx'). Replacing the navigation stack completely with 'router.replace' stripped out our root history layers, trapping users on a dead fallback "No active run" screen with broken buttons. We are restoring our background stack matching standard mobile navigation design rules.

Your Tasks:
Provide the fully updated, complete, and un-truncated file configurations for 'app/index.tsx' and 'app/flight-deck.tsx'. Do not use placeholder omissions or truncated shorthand segments.

Key Engineering Directives:

1. Restore History Stack Layering (app/index.tsx):
- Change all forward navigation routing triggers from `router.replace('/flight-deck')` back to:
  `router.push('/flight-deck');`
- Apply this fix to all three activation entry points (Standard collection row tap, Checklist template row tap, and Pending saved run "Resume" button). This ensures the dashboard home layout always remains alive underneath the checklist runtime workspace.

2. Conditionalize the Back-Guard Interceptor (app/flight-deck.tsx):
- Remove the unconditional `e.preventDefault()` from the top of your `beforeRemove` listener block.
- Instead, perform a state clearance check first. If `!state.activeRun` or if the run has already been flagged as finished/saved/abandoned, immediately return without calling preventDefault. This ensures that when an action completes, the system unblocks navigation and allows the view to exit seamlessly.
- Rewrite the `beforeRemove` event listener precisely like this:
  ```tsx
  const unsubscribe = navigation.addListener('beforeRemove', (e) => {
    // 1. If no active run is processing, let the screen unmount natively!
    if (!state.activeRun) {
      return; 
    }

    // 2. If an active run exists, block the native animation to handle our states
    e.preventDefault();

    if (isFromSaved) {
      updateSavedRun(state.activeRun.id, state.activeRun.steps);
      router.replace('/');
    } else {
      setExitModalVisible(true);
    }
  });

```

3. Clean Exit Navigation Handlers (app/flight-deck.tsx):

* Ensure that inside `handleSaveAndExit()`, `handleAbandon()`, and `handleComplete()`, you explicitly update or clear your global context state variables FIRST, and then execute your transition back to the dashboard layout.
* Use `router.replace('/')` or `router.navigate('/')` within these success blocks, knowing that because the root layout is preserved by our `router.push` setup, the application will drop cleanly and predictably back onto the home page every single time.

Deliverable Constraints:
Provide the absolute complete text contents for BOTH 'app/index.tsx' and 'app/flight-deck.tsx'. No code shortcuts, placeholder comments, or truncated helper hooks. Every line must be solid, clean, and ready to compile.

```

---

### 🛠️ Execution Pipeline
Once Claude updates your project tree:
1. Clear your bundler cache completely to force Metro to rebuild the navigation stack boundaries:
   ```bash
   npx expo start --clear

```

2. Test your app actions again. Saving a run, abandoning a run, or finishing a collection will instantly drop you right back onto your main home menu with no recursive loops and zero frozen screens.
