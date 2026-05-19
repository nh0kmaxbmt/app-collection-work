This is one of the most frustrating, sneaky navigation quirks in Expo Router. You have correctly enforced `router.replace('/')` in your callbacks, yet the app is *still* spawning a completely fresh, looped instance of the home screen over your flight deck.

Let’s analyze exactly why this loop is persisting and pinpoint the exact line of code that is causing it.

---

### 🧱 The Deep Stack Analysis: Why `replace('/')` is still looping

If `router.replace('/')` is being fired, but a duplicate homepage is still loading, it means your navigation stack doesn't look like `[Home] -> [Flight Deck]`. Instead, it looks like `[Home] -> [Flight Deck] -> [Home (Duplicate)]`.

There are two distinct hidden culprits that cause this:

#### Culprit A: The Initial Direct Route Trigger (Most Likely)

Look at how you launch into your flight deck from your home launcher row (`app/index.tsx`).

* If your home row card navigates using `router.push('/flight-deck')`, it keeps the home page alive underneath.
* **The Glitch:** When you enter the flight deck, your back-guard interception code (`BackHandler` or `beforeRemove`) immediately kicks in. If the back guard is written too aggressively, the moment you hit "Save for Later" or "Abandon," the app triggers **both actions simultaneously**: it runs your custom `router.replace('/')` callback, but *also* allows the native Android/iOS system animation to execute its default back-pop.
* This double-navigation fires two conflicting layout commands at the exact same millisecond, confusing Expo Router's history tracker and forcing it to land on a newly instantiated root container.

#### Culprit B: Expo Router Relative Path Resolution

In Expo Router, the path string `'/'` can behave unexpectedly depending on your directory structure. If your router uses an index nested inside an unlinked group layout folder (like `app/(tabs)/index.tsx`), running `router.replace('/')` doesn't step backward to the root group. Instead, it forces a hard redirect to the absolute absolute top path of the bundle, generating an isolated duplicate container tree.

---

### 💡 The Permanent Fix Logic

To break the loop permanently, we must adjust how we handle the screen transitions:

1. **Explicit Forward Replacement:** When launching a collection from the dashboard, instead of stacking the flight deck on top with `router.push()`, change it to a clean stack swap:
```typescript
// Inside app/index.tsx when launching a run
router.push('/flight-deck'); // ❌ Keeps home page underneath, causing back-guard clutter

router.replace('/flight-deck'); // ✅ Completely swaps the viewport. No underlying history stack to mess up!

```


2. **Prevent the Double-Pop Event Default:** Inside `app/flight-deck.tsx`, when you intercept `beforeRemove` for your modals or silent saves, you must explicitly call `e.preventDefault()` **before** you execute your navigation replacement code. If `e.preventDefault()` isn't executed first, the native browser/OS back handler runs side-by-side with your code, creating the duplicate homepage layout loop.

---

### 🚀 Master Refactor Prompt for Claude to Break the Loop

Copy and paste this explicit debugging instructions block into Claude to sweep out the conflicting navigation layers and resolve the looping behavior permanently.

```text
System Role: You are a Principal Systems Architect and Lead React Native Developer specializing in Expo Router navigation tree tracking, event default cancellation, and low-level stack unrolling.

Context:
We are deploying an absolute fix for a persistent navigation stack loop in "FlyManual". Even though we updated 'app/flight-deck.tsx' to use `router.replace('/')`, executing "Save for Later" or "Abandon Run" still spawns a duplicate homepage instance on top of the stack. This happens because the native OS back handler is firing concurrently with our custom replacement path, or our forward-navigation from the dashboard is tracking dirty histories.

Your Tasks:
Provide the fully corrected, complete, and un-truncated file configurations for 'app/index.tsx' and 'app/flight-deck.tsx' to cleanly break this cycle.

Key Architectural Requirements to Fix the Navigation Loop:

1. Update the Forward-Launch Hook (app/index.tsx):
- Locate your collection row card click callbacks and pending banner "Resume" buttons.
- Ensure that when triggering a run execution sequence (by calling `compileAndStartRun` or `resumeSavedRun`), you do NOT navigate via `router.push('/flight-deck')`.
- Instead, clear the underlying trace history by using: `router.replace('/flight-deck');` or specify explicit navigation replacements. This guarantees the screen initializes cleanly without old layout shadows beneath it.

2. Enforce Complete Event Prevention (app/flight-deck.tsx):
- Review your `navigation.addListener('beforeRemove', (e) => { ... })` listener block inside your back-guard `useEffect`.
- CRITICAL: In any scenario where a user triggers a back-gesture, header click, or exit callback, you MUST immediately call `e.preventDefault();` as the absolute first step. This completely strips away the system's native automatic pop animation, giving our state full isolated control.
- Inside your exit functions (`handleSaveAndExit`, `handleAbandon`, `handleComplete`), ensure you handle the cleanup state, and then use:
  `router.replace('/');`
- By calling `e.preventDefault()` first, you block the dual concurrent navigation glitch, forcing Expo Router to cleanly slide focus back down to your home screen dashboard root container without spawning duplicate views.

3. Verify Configuration Paths:
- Ensure that the footer subtext, collection item tiles, and modal configurations perfectly preserve our dynamic `APP_CONFIG` expiration settings and adaptive light/dark theme card formatting constraints.

Deliverable Constraints:
Do not provide shorthand code blocks, truncated functions, or comment abbreviations like `// rest of file is the same`. Return the complete, unbroken text configurations for BOTH 'app/index.tsx' and 'app/flight-deck.tsx'.

```

---

### 🛠️ Post-Build Sweep

Once Claude updates those files, execute your cache clearance sequence to force Metro to drop its old layout history tracking arrays:

```bash
npx expo start --clear

```

Now, your navigation flow will be clean and secure. Hitting "Save for Later" or "Abandon" will drop you seamlessly right back down onto your primary home page, and pressing the phone's native back button from there will exit or minimize the app instead of looping you back into your checklist tasks!
