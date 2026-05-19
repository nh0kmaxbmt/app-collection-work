System Role: You are a Principal Systems Architect and Lead React Native Engineer. You specialize in low-level hardware event interception, Expo Router navigation guards, and defensive state caching structures.

Context:
We are upgrading the active execution runtime environment ('app/flight-deck.tsx') of "FlyManual" V8.3. We want to intercept native Android hardware back actions, iOS swipe-back navigation gestures, and navigation header back button clicks. Instead of dropping active checklist states on exit, the app must either execute silent autosaves for already suspended runs or present a structured confirmation modal for fresh runs.

Your Tasks:
Provide the fully rewritten, complete, and un-truncated file configuration for 'app/flight-deck.tsx'. Do not use placeholder omissions or ellipsis truncations.

Key Engineering Directives for the Interception System:

1. Integrate Hardware and Navigation Back Guards (app/flight-deck.tsx):
- Import 'BackHandler' from 'react-native' and 'useNavigation' from 'expo-router'.
- Inside a dedicated 'useEffect' block, hook into the native hardware 'hardwareBackPress' event listener matrix.
- Also use `navigation.addListener('beforeRemove', (e) => { ... })` to capture any gesture or header clicks before the screen unmounts.

2. Implement Back Action Conditional Handling Matrix:
- Define whether the active execution sequence is an existing suspended instance (e.g., matching a `runId` check or an `isFromSavedList` state flag).
- Condition 1: If it IS an existing saved run instance:
  - When a back-press triggers, intercept it, call your store method to silently update and save the current modified step array state directly into that specific ID position inside the global `savedRuns` state array, then execute `router.replace('/')` with no modal friction.
- Condition 2: If it IS NOT an existing saved run instance:
  - Intercept the event, call `e.preventDefault()`, and open an explicit custom modal overlay dialog directly on the Flight Deck view layout.

3. Complete the New Flight Deck Exit Modal Overlay UI:
- Build a beautiful, adaptive modal container that renders if a fresh run back-action is intercepted.
- Provide 3 distinct interactive control paths:
  - Option 1 (Save Progress): Opens a nested text input row asking for a quick custom identification name. Upon submission, it calls `saveCurrentRunForLater(customName)` to push the instance to the `savedRuns` array and navigates to the dashboard using `router.replace('/')`.
  - Option 2 (Abandon Run): Clears out the current running step data structures instantly, ignores saving, and executes `router.replace('/')` cleanly.
  - Option 3 (Cancel / Stay): Simply closes the modal overlay, allowing the user to continue checking off tasks smoothly.

4. Preserve Step Viewports and Empty State Validation:
- Maintain your dual-viewport layouts ("🔥 NOW ACTIVE" vs "⏳ NEXT UP").
- Ensure the main action footer panel still checks if remaining uncompleted tasks equal 0 to dynamically disable the primary save system interface components.

Deliverable Constraints:
Provide the absolute complete text contents for 'app/flight-deck.tsx'. All hooks, hardware lifecycle event wrappers, modal configurations, and navigation parameters must be fully typed, completed, and production-ready. Do not use shorthand summaries or code ellipses.
