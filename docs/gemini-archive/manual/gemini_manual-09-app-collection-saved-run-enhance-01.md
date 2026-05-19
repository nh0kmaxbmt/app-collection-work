Let’s analyze these two issues. Both point to classic architectural friction points when scaling an Expo Router app into a multi-instance state machine.

Here is the breakdown of why this behavior is happening and how we are going to fix it.

---

### 🧱 Architectural Analysis

#### 1. The Duplicate Homepage Issue (Navigation Stack Bloat)

* **What is happening:** When you save a run and navigate back, your code is likely using a push command (e.g., `router.push('/')` or `router.navigate('/')`). In Expo Router (and underlying React Navigation), `router.push('/')` doesn't always go back to your *original* home screen wrapper. Instead, it pushes a **brand-new instance** of the home screen right on top of your current flight deck. If you hit your hardware back button on that new home page, it will pop backward into your active flight deck again! This creates a recursive loop of duplicate screens.
* **The Fix:** We must explicitly use **`router.replace('/')`** or clear the history stack. `router.replace` completely obliterates the current navigation route history, unmounts the flight deck safely, and drops the user straight down onto the existing root home layout.

#### 2. Hardcoded Expiry Times vs. Dynamic Configurations

* **What is happening:** Right now, your 24-hour expiration threshold is a hardcoded magic number calculation (`24 * 60 * 60 * 1000`) living inside your global state file (`store.tsx`). This makes testing near impossible unless you physically sit around for a day or manually corrupt your system clock data files.
* **The Fix:** We will abstract this into a configuration constant dictionary or state parameter object. By defining an app-wide configuration block, you can easily switch your app from production mode (24 hours) to test mode (e.g., 30 seconds or 2 minutes) with a single string flag to verify your background garbage disposal script works flawlessly.

---

### 🛠️ The New Structural Configuration Model

To clean this up, your global config structure should look like this:

```typescript
// src/core/config.ts
export const APP_CONFIG = {
  // Toggle this to true when testing garbage collection!
  IS_TEST_MODE: __DEV__ && false, 
  
  EXPIRY_TIMES: {
    PRODUCTION: 24 * 60 * 60 * 1000, // 24 Hours in ms
    TESTING: 60 * 1000               // 1 Minute in ms for fast verification
  },

  getEffectiveExpiryTime() {
    return this.IS_TEST_MODE ? this.EXPIRY_TIMES.TESTING : this.EXPIRY_TIMES.PRODUCTION;
  }
};

```

---

### 🚀 Master Refactor Prompt for Claude

Copy and paste this explicit configuration prompt into Claude to wipe out the navigation stack duplications and deploy the dynamic config asset.

```text
System Role: You are a Principal Systems Architect and Lead React Native Engineer specializing in Expo Router navigation stacks, low-level garbage collection state management, and clear code configuration separation.

Context:
We are optimizing "FlyManual" V8.4. Currently, completing or saving a run pushes a duplicate instance of the homepage onto the navigation stack instead of safely returning to the pristine root home container. Additionally, we need to extract our hardcoded 24-hour expiration calculation into a dynamic configuration layer to allow for clean automated testing.

Your Tasks:
Provide the fully written, complete, and un-truncated file configurations for a brand new 'src/core/config.ts', and fully updated versions of 'src/core/store.tsx' and 'app/flight-deck.tsx'. Do not use placeholder omissions or truncated shorthand segments.

Key Technical Specifications:

1. Build a Centralized App Config File (src/core/config.ts):
- Create a pristine config module exporting an 'APP_CONFIG' object.
- Include a boolean flag: `IS_TEST_MODE` (can default to false or look at `__DEV__`).
- Include an object containing millisecond numbers:
  - `EXPIRY_TIME_PROD = 24 * 60 * 60 * 1000;` (24 Hours)
  - `EXPIRY_TIME_TEST = 30 * 1000;` (30 Seconds for rapid layout verification testing)
- Provide a helper function `getExpiryDuration()` that checks `IS_TEST_MODE` and returns the correct duration value instantly.

2. Update Data Store Core with Dynamic Lifespans (src/core/store.tsx):
- Import 'APP_CONFIG' from 'src/core/config.ts'.
- Locate `saveCurrentRunForLater(name)`. Instead of using a hardcoded math value for the calculation, modify the expiration assignment statement to dynamically use the configuration file:
  `expiresAt: Date.now() + APP_CONFIG.getExpiryDuration()`
- Verify your initialization garbage collection loop: Ensure the `useEffect` block reads this setup to drop expired items on boot safely, outputting a clear `console.log` stating how many items were swept out during initialization.

3. Fix Duplicate Home Screen Navigation Loop (app/flight-deck.tsx):
- Review all navigation exit callbacks inside the flight deck (specifically your Save for Later submission block, the Exit Modal's Abandon action, and the standard Finish/Reset routine).
- Enforce a strict ban on `router.push('/')` or `router.navigate('/')` within these terminal callbacks.
- Force all exit routines to execute **`router.replace('/')`** precisely alongside or directly after completing state modifications. This ensures the flight deck unmounts entirely and drops the navigation focus back down to your existing dashboard root view without stacking identical pages.

Deliverable Constraints:
Return the full, comprehensive code assets for: 'src/core/config.ts', 'src/core/store.tsx', and 'app/flight-deck.tsx'. Every file must be complete, beautifully typed, standalone, and ready to compile cleanly.

```

---

### 💡 Testing Your New System

Once Claude finishes writing these files, you can test your garbage collection loop instantly:

1. Open `src/core/config.ts` and switch `IS_TEST_MODE` to `true`.
2. Fire up your terminal clear command (`npx expo start --clear`).
3. Open a collection, hit back, name your saved run, and go home.
4. Wait 30 seconds, reload your app or click a button, and you will see your saved item card vanish right before your eyes as the background garbage collection sweep triggers successfully! Switch it back to `false` when you are ready to use it daily.
