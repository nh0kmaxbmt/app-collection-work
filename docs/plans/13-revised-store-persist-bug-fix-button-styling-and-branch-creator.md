# 13 — Revised Execution Prompt: Store Persistence Fix, Button Styling & Branch Creator

## Source
`docs/gemini-archive/component/gemini-13-Revised Claude GLM Execution Prompt.txt`
Diagnostic context: `docs/gemini-archive/manual/gemini_manual-04-app-data-insert-enhance-01.md`

## Feature Description
A combined fix-and-feature pass addressing three issues discovered during real-world usage:
1. **Storage race condition** — custom templates vanish on reload because the seed function overwrites AsyncStorage on every boot
2. **Invisible button** — the `[+ Add Step]` button is transparent against the dark background
3. **Branch Creator** — the template builder cannot create conditional workflows (the branching logic that makes the Gym template powerful)

## Task 1: Fix AsyncStorage Persistence Bug (`src/core/store.ts`)

### Problem
When the React context initializes, the hydration logic likely checks an empty state variable instead of the AsyncStorage return value, causing the seed script to **overwrite** stored data on every JS bundle reload.

### Fix
- Hydration must run a strict structural check on the AsyncStorage return value
- If `AsyncStorage.getItem('flightmanual::templates')` returns a non-null string → `JSON.parse` it into state and **halt**
- Only run the seed fallback if the key returns absolute `null`
- Verify `saveCustomTemplate` updates React state **and** stringifies back to storage immediately

### Sample Code: Hydration Fix

```typescript
// src/core/store.ts — Fixed hydration logic

useEffect(() => {
  (async () => {
    try {
      const [tplJson, runJson, logsJson] = await Promise.all([
        AsyncStorage.getItem(KEYS.templates),
        AsyncStorage.getItem(KEYS.activeRun),
        AsyncStorage.getItem(KEYS.runLogs),
      ]);

      // STRICT CHECK: only seed if storage key returns absolute null
      // A valid empty array "[]" is truthy JSON and must NOT trigger seeding
      const templates = tplJson !== null
        ? JSON.parse(tplJson)
        : SEED_TEMPLATES;
      const activeRun = runJson !== null
        ? JSON.parse(runJson)
        : null;
      const historyLogs = logsJson !== null
        ? JSON.parse(logsJson)
        : SEED_LOGS;

      dispatch({
        type: 'HYDRATE',
        payload: { templates, activeRun, historyLogs },
      });
    } catch (e) {
      console.error('[FlightManual] Hydration failed:', e);
      dispatch({
        type: 'HYDRATE',
        payload: { templates: SEED_TEMPLATES, activeRun: null, historyLogs: SEED_LOGS },
      });
    }
  })();
}, []);
```

### Sample Code: saveCustomTemplate Persist Fix

```typescript
// Ensure saveCustomTemplate writes to storage immediately
const saveCustomTemplate = useCallback(async (name: string, tags: string[], stepTexts: string[]) => {
  const id = `tpl_${Date.now()}`;
  const baseSteps: Step[] = stepTexts.map((text, i) => ({
    id: `step_${id}_${i}`,
    text,
    isCompleted: false,
    isLocked: i !== 0,
    dependsOnStepId: i > 0 ? `step_${id}_${i - 1}` : undefined,
  }));
  const template: Template = { id, name, tags, baseSteps };
  dispatch({ type: 'SAVE_TEMPLATE', payload: template });

  // Immediate storage write (don't wait for useEffect persist)
  try {
    const current = await AsyncStorage.getItem(KEYS.templates);
    const existing: Template[] = current ? JSON.parse(current) : [];
    const updated = [...existing, template];
    await AsyncStorage.setItem(KEYS.templates, JSON.stringify(updated));
  } catch (e) {
    console.error('[FlightManual] saveCustomTemplate persist failed:', e);
  }
}, []);
```

---

## Task 2: Refactor UI Button Styling (`app/create-template.tsx`)

### Problem
The `[+ Add Step]` button uses transparent/border-only styling that's invisible against the dark background.

### Fix
Replace with solid, high-contrast dark blue touch state.

### Sample Code

```tsx
// OLD (invisible on dark background)
<Pressable
  onPress={addStep}
  className="mt-2 items-center rounded-lg border border-dashed border-gray-700 py-3"
>
  <Text className="text-sm font-semibold text-gray-500">+ Add Step</Text>
</Pressable>

// NEW (solid, visible, tactile)
<Pressable
  onPress={addStep}
  className="mt-3 items-center rounded-xl border border-blue-500/30 bg-blue-600 px-4 py-3 active:bg-blue-700 dark:bg-indigo-950 dark:active:bg-indigo-900"
>
  <Text className="text-sm font-bold text-white">+ Add Step</Text>
</Pressable>
```

---

## Task 3: Implement the "Branch Creator" Engine (`app/create-template.tsx` & `src/core/store.ts`)

### Feature Description
Extends the template builder to support creating conditional branch workflows. Users can define a branching question, option keys, and nested subtask lists per option. On save, these get packaged into the template's `branchingStep` property with auto-tagged `branchSource` flags.

### Requirements
1. Add a section toggle: **[+ Add Dynamic Focus Branch]**
2. When activated, expose:
   - A **Branch Question** text input (e.g., "What focus group today?")
   - An **Option Matrix** — dynamic list builder for option blocks
   - Each option block has: an **Option Name** input + an independent sub-array of step inputs
3. Add/remove options dynamically
4. Add/remove steps within each option
5. On form submit: package everything into `branchingStep` with auto-tagged `branchSource`

### Updated Form State Shape

```typescript
// New state for branch builder
interface BranchOption {
  name: string;        // e.g. "legs"
  steps: string[];     // e.g. ["Squat shoes", "Knee sleeves"]
}

const [hasBranch, setHasBranch] = useState(false);
const [branchQuestion, setBranchQuestion] = useState('');
const [branchOptions, setBranchOptions] = useState<BranchOption[]>([{ name: '', steps: [''] }]);
```

### Sample Code: Branch Builder UI Section (`app/create-template.tsx`)

```tsx
{/* Branch Creator Section */}
<View className="mb-6 mt-2">
  <Pressable
    onPress={() => setHasBranch(!hasBranch)}
    className="flex-row items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3"
  >
    <Text className="text-sm font-bold text-blue-400">
      {hasBranch ? '✓ Branch Options Enabled' : '+ Add Conditional Branch Options'}
    </Text>
  </Pressable>

  {hasBranch && (
    <View className="mt-4">
      {/* Branch Question */}
      <Text className="mb-2 text-sm font-medium text-gray-400">Branch Question</Text>
      <TextInput
        className="mb-4 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
        placeholder="e.g. What focus group today?"
        placeholderTextColor="#6b7280"
        value={branchQuestion}
        onChangeText={setBranchQuestion}
      />

      {/* Option blocks */}
      {branchOptions.map((option, optIdx) => (
        <View key={optIdx} className="mb-4 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <View className="mb-3 flex-row items-center gap-2">
            <TextInput
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              placeholder="Option name (e.g. legs)"
              placeholderTextColor="#6b7280"
              value={option.name}
              onChangeText={(t) => {
                const next = [...branchOptions];
                next[optIdx] = { ...next[optIdx], name: t };
                setBranchOptions(next);
              }}
            />
            {branchOptions.length > 1 && (
              <Pressable
                onPress={() => setBranchOptions((prev) => prev.filter((_, i) => i !== optIdx))}
                className="px-2 py-2"
              >
                <Text className="text-sm text-red-500">Remove</Text>
              </Pressable>
            )}
          </View>

          {/* Subtask list for this option */}
          {option.steps.map((stepText, stepIdx) => (
            <View key={stepIdx} className="mb-2 flex-row items-center gap-2 pl-2">
              <Text className="w-4 text-xs text-gray-600">{stepIdx + 1}.</Text>
              <TextInput
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                placeholder={`Step ${stepIdx + 1}`}
                placeholderTextColor="#6b7280"
                value={stepText}
                onChangeText={(t) => {
                  const next = [...branchOptions];
                  const steps = [...next[optIdx].steps];
                  steps[stepIdx] = t;
                  next[optIdx] = { ...next[optIdx], steps };
                  setBranchOptions(next);
                }}
              />
              {option.steps.length > 1 && (
                <Pressable
                  onPress={() => {
                    const next = [...branchOptions];
                    const steps = next[optIdx].steps.filter((_, i) => i !== stepIdx);
                    next[optIdx] = { ...next[optIdx], steps };
                    setBranchOptions(next);
                  }}
                  className="px-1 py-2"
                >
                  <Text className="text-xs text-red-500">X</Text>
                </Pressable>
              )}
            </View>
          ))}
          <Pressable
            onPress={() => {
              const next = [...branchOptions];
              next[optIdx] = { ...next[optIdx], steps: [...next[optIdx].steps, ''] };
              setBranchOptions(next);
            }}
            className="mt-1 items-center rounded-lg border border-blue-500/30 bg-blue-600/80 px-3 py-2 active:bg-blue-700"
          >
            <Text className="text-xs font-bold text-white">+ Add Sub-Step</Text>
          </Pressable>
        </View>
      ))}

      {/* Add another option block */}
      <Pressable
        onPress={() => setBranchOptions((prev) => [...prev, { name: '', steps: [''] }])}
        className="items-center rounded-xl border border-dashed border-gray-700 py-3"
      >
        <Text className="text-sm font-semibold text-gray-500">+ Add Another Option</Text>
      </Pressable>
    </View>
  )}
</View>
```

### Sample Code: Updated `saveCustomTemplate` to Accept Branches (`src/core/store.ts`)

```typescript
// Updated saveCustomTemplate signature and branch packaging
const saveCustomTemplate = useCallback(
  async (
    name: string,
    tags: string[],
    stepTexts: string[],
    branchingStep?: { question: string; options: Record<string, string[]> },
  ) => {
    const id = `tpl_${Date.now()}`;

    const baseSteps: Step[] = stepTexts.map((text, i) => ({
      id: `step_${id}_${i}`,
      text,
      isCompleted: false,
      isLocked: i !== 0,
      dependsOnStepId: i > 0 ? `step_${id}_${i - 1}` : undefined,
    }));

    // Build branchingStep if provided
    let branching: Template['branchingStep'];
    if (branchingStep) {
      const options: Record<string, Step[]> = {};
      for (const [key, texts] of Object.entries(branchingStep.options)) {
        const lastBaseId = baseSteps[baseSteps.length - 1]?.id;
        options[key] = texts.map((text, i) => ({
          id: `branch_${id}_${key}_${i}`,
          text,
          isCompleted: false,
          isLocked: true,
          dependsOnStepId: i === 0 ? lastBaseId : `branch_${id}_${key}_${i - 1}`,
          branchSource: key,
        }));
      }
      branching = { question: branchingStep.question, options };
    }

    const template: Template = { id, name, tags, baseSteps, branchingStep: branching };
    dispatch({ type: 'SAVE_TEMPLATE', payload: template });

    // Immediate persist
    try {
      const current = await AsyncStorage.getItem(KEYS.templates);
      const existing: Template[] = current ? JSON.parse(current) : [];
      await AsyncStorage.setItem(KEYS.templates, JSON.stringify([...existing, template]));
    } catch (e) {
      console.error('[FlightManual] saveCustomTemplate persist failed:', e);
    }
  },
  [],
);
```

### Sample Code: Updated Form Submit Handler (`app/create-template.tsx`)

```typescript
const handleSave = () => {
  const trimmedName = name.trim();
  const filledSteps = stepTexts.map((s) => s.trim()).filter((s) => s.length > 0);
  if (!trimmedName || filledSteps.length === 0) return;

  const tags = tagsInput
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  // Build branch payload if enabled
  let branchData: { question: string; options: Record<string, string[]> } | undefined;
  if (hasBranch && branchQuestion.trim()) {
    const options: Record<string, string[]> = {};
    for (const opt of branchOptions) {
      const optName = opt.name.trim().toLowerCase();
      const filledOptSteps = opt.steps.map((s) => s.trim()).filter((s) => s.length > 0);
      if (optName && filledOptSteps.length > 0) {
        options[optName] = filledOptSteps;
      }
    }
    if (Object.keys(options).length > 0) {
      branchData = { question: branchQuestion.trim(), options };
    }
  }

  saveCustomTemplate(trimmedName, tags, filledSteps, branchData);

  // Reset form
  setName('');
  setTagsInput('');
  setStepTexts(['']);
  setHasBranch(false);
  setBranchQuestion('');
  setBranchOptions([{ name: '', steps: [''] }]);

  router.back();
};
```
