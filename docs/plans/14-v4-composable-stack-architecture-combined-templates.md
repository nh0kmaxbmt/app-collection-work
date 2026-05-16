# 14 — V4 Composable Stack Architecture: Combined Templates

## Source
`docs/gemini-archive/component/gemini-14-combined Templates.txt`
Design context: `docs/gemini-archive/manual/gemini_manual-05-app-collection-linkage.md`

## Feature Description
FlightManual evolves from single-template execution to a **Composable Stack Architecture**. Multiple templates can be compiled into one active run. Each template declares its own `executionMode` (linear or parallel). A new `RoutineBookmark` system lets users save and relaunch compound configurations. The flight deck UI shifts to a **dual-viewport availability sorting engine** that separates available tasks from locked ones across all compiled templates.

## Three Major Capabilities

### A. ExecutionMode Switch (`linear` vs `parallel`)
- **Linear:** Only the first uncompleted step is unlocked (prerequisites enforced)
- **Parallel:** All steps are immediately available (grocery lists, packing, etc.)

### B. Routine Bookmark Store
- Save a compound configuration (multiple template IDs + pre-selected branches) as a named bookmark
- One-tap relaunch from the home dashboard (e.g., "Saturday Errands")

### C. Smart Hybrid Viewport (Availability State Sorting)
- Two visual zones: "NOW ACTIVE" (unlocked items) and "NEXT UP" (locked items)
- Items grouped under their parent template name headers within each zone
- Checking a linear step instantly recalculates and bubbles the next step into the active zone

## Adaptation Notes (Expo / React Native)
- New storage key: `flightmanual::bookmarks`
- `RunInstance.currentSteps` items are now augmented with `parentTemplateName` and `executionMode`
- `Step` interface gains `branchSource` (from V3, still applicable)
- Flight deck needs two `ScrollView` sections or a single `FlatList` with section headers
- Home dashboard needs UI to select multiple templates and launch a combined run, plus display bookmarks

---

## Task 1: Update Types Layer (`src/core/types.ts`)

### Sample Code

```typescript
// src/core/types.ts — V4 Composable Stack

export type ExecutionMode = 'linear' | 'parallel';

export interface Step {
  id: string;
  text: string;
  isCompleted: boolean;
  isLocked: boolean;
  dependsOnStepId?: string;
  branchSource?: string;
}

export interface BranchingStep {
  question: string;
  options: Record<string, Step[]>;
}

export interface Template {
  id: string;
  name: string;
  tags: string[];
  executionMode: ExecutionMode;
  baseSteps: Step[];
  branchingStep?: BranchingStep;
}

export interface RoutineBookmark {
  id: string;
  title: string;
  templateIds: string[];
  selectedBranches: {
    [templateId: string]: string[];
  };
}

// Augmented step type used in compiled runs
export type CompiledStep = Step & {
  parentTemplateName: string;
  executionMode: ExecutionMode;
};

export interface RunInstance {
  id: string;
  bookmarkId?: string;
  startedAt: number;
  currentSteps: CompiledStep[];
  isFinished: boolean;
}

export interface RunLog {
  templateId: string;
  timestamp: number;
  durationMs: number;
}
```

---

## Task 2: Revamp Context Store Engine (`src/core/store.ts`)

### Key Changes
- New `bookmarks` state + `flightmanual::bookmarks` storage key
- `compileAndStartRun(templateIds, bookmarkBranches?)` replaces single `startRun`
- `saveRoutineBookmark(title, templateIds, selectedBranches)`
- Lock logic respects `executionMode`: parallel = all unlocked, linear = only first unlocked

### Sample Code: New Actions & Reducer

```typescript
// ─── Additional state field ────────────────────────────────
interface FlightState {
  templates: Template[];
  activeRun: RunInstance | null;
  historyLogs: RunLog[];
  bookmarks: RoutineBookmark[];
  isLoading: boolean;
}

// ─── Additional actions ────────────────────────────────────
type Action =
  | { type: 'HYDRATE'; payload: { templates: Template[]; activeRun: RunInstance | null; historyLogs: RunLog[]; bookmarks: RoutineBookmark[] } }
  | { type: 'START_RUN'; payload: RunInstance }
  | { type: 'TOGGLE_STEP'; payload: string }
  | { type: 'COMPLETE_RUN'; payload: RunLog }
  | { type: 'SAVE_TEMPLATE'; payload: Template }
  | { type: 'SAVE_BOOKMARK'; payload: RoutineBookmark };
```

### Sample Code: compileAndStartRun

```typescript
const compileAndStartRun = useCallback(
  (templateIds: string[], bookmarkBranches?: Record<string, string[]>) => {
    const compiledSteps: CompiledStep[] = [];
    const seenIds = new Set<string>();

    for (const tplId of templateIds) {
      const template = state.templates.find((t) => t.id === tplId);
      if (!template) continue;

      const isParallel = template.executionMode === 'parallel';
      const branchKeys = bookmarkBranches?.[tplId] ?? [];

      // Clone and tag base steps
      const steps = cloneSteps(template.baseSteps).map((s, i) => {
        const id = seenIds.has(s.id) ? `${tplId}::${s.id}` : s.id;
        seenIds.add(id);
        return {
          ...s,
          id,
          isLocked: isParallel ? false : i !== 0,
          parentTemplateName: template.name,
          executionMode: template.executionMode,
        } as CompiledStep;
      });
      compiledSteps.push(...steps);

      // Inject pre-selected branch steps
      if (template.branchingStep) {
        for (const key of branchKeys) {
          const branchSteps = template.branchingStep.options[key];
          if (!branchSteps) continue;
          const lastStepId = steps[steps.length - 1]?.id;
          const injected = cloneSteps(branchSteps).map((s, i) => {
            const id = seenIds.has(s.id) ? `${tplId}::${s.id}` : s.id;
            seenIds.add(id);
            return {
              ...s,
              id,
              isLocked: isParallel ? false : true,
              dependsOnStepId: i === 0 ? lastStepId : undefined,
              branchSource: key,
              parentTemplateName: template.name,
              executionMode: template.executionMode,
            } as CompiledStep;
          });
          // For linear mode, unlock first branch step if last base step would be first
          if (!isParallel && injected.length > 0) {
            injected[0].isLocked = false;
          }
          compiledSteps.push(...injected);
        }
      }
    }

    const instance: RunInstance = {
      id: `run_${Date.now()}`,
      startedAt: Date.now(),
      currentSteps: compiledSteps,
      isFinished: false,
    };
    dispatch({ type: 'START_RUN', payload: instance });
  },
  [state.templates],
);
```

### Sample Code: saveRoutineBookmark

```typescript
const saveRoutineBookmark = useCallback(
  async (title: string, templateIds: string[], selectedBranches: Record<string, string[]>) => {
    const bookmark: RoutineBookmark = {
      id: `bm_${Date.now()}`,
      title,
      templateIds,
      selectedBranches,
    };
    dispatch({ type: 'SAVE_BOOKMARK', payload: bookmark });

    // Immediate persist
    try {
      const current = await AsyncStorage.getItem(KEYS.bookmarks);
      const existing: RoutineBookmark[] = current ? JSON.parse(current) : [];
      await AsyncStorage.setItem(KEYS.bookmarks, JSON.stringify([...existing, bookmark]));
    } catch (e) {
      console.error('[FlightManual] saveRoutineBookmark persist failed:', e);
    }
  },
  [],
);
```

### Sample Code: Hydration with Bookmarks

```typescript
// Updated hydration — add bookmarks key
useEffect(() => {
  (async () => {
    try {
      const [tplJson, runJson, logsJson, bmJson] = await Promise.all([
        AsyncStorage.getItem(KEYS.templates),
        AsyncStorage.getItem(KEYS.activeRun),
        AsyncStorage.getItem(KEYS.runLogs),
        AsyncStorage.getItem(KEYS.bookmarks),
      ]);
      dispatch({
        type: 'HYDRATE',
        payload: {
          templates: tplJson !== null ? JSON.parse(tplJson) : SEED_TEMPLATES,
          activeRun: runJson !== null ? JSON.parse(runJson) : null,
          historyLogs: logsJson !== null ? JSON.parse(logsJson) : SEED_LOGS,
          bookmarks: bmJson !== null ? JSON.parse(bmJson) : [],
        },
      });
    } catch (e) {
      console.error('[FlightManual] Hydration failed:', e);
      dispatch({
        type: 'HYDRATE',
        payload: { templates: SEED_TEMPLATES, activeRun: null, historyLogs: SEED_LOGS, bookmarks: [] },
      });
    }
  })();
}, []);
```

---

## Task 3: Availability State UI Layer (`app/flight-deck.tsx`)

### Dual-Viewport Layout Logic

```
┌──────────────────────────────────────┐
│     FLIGHT PLAN: SATURDAY ERRANDS    │
├──────────────────────────────────────┤
│  🔥 NOW ACTIVE                       │
│  ┌─ GYM BASE PREP ─────────────────┐ │
│  │ [ ] Fill up water bottle        │ │
│  ├─ BOOKSTORE EXTRAS ──────────────┤ │
│  │ [ ] Locate library card         │ │
│  │ [ ] Grab book bag  (parallel)   │ │
│  └─────────────────────────────────┘ │
│  ⏳ NEXT UP                          │
│  ┌─ GYM BASE PREP ─────────────────┐ │
│  │ [🔒] Pack clean towel           │ │
│  │ [🔒] Charge headphones          │ │
│  └─────────────────────────────────┘ │
├──────────────────────────────────────┤
│  ████████░░░░░░  Progress: 40%       │
│  [ Complete Run & Reset ]            │
└──────────────────────────────────────┘
```

### Sample Code: `app/flight-deck.tsx`

```tsx
// app/flight-deck.tsx — V4 Availability State Engine
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Layout } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import type { CompiledStep } from '../src/core/types';

export default function FlightDeck() {
  const { state, toggleStep, completeRun } = useFlightManual();
  const { activeRun } = state;

  if (!activeRun) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-950">
        <Text className="mb-4 text-gray-500">No active run</Text>
        <Pressable onPress={() => router.back()} className="rounded-lg bg-blue-600 px-6 py-3">
          <Text className="font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const steps = activeRun.currentSteps;
  const activeSteps = steps.filter((s) => !s.isCompleted && !s.isLocked);
  const lockedSteps = steps.filter((s) => !s.isCompleted && s.isLocked);
  const completedCount = steps.filter((s) => s.isCompleted).length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  // Group steps by parentTemplateName for visual headers
  const groupByName = (list: CompiledStep[]) => {
    const groups: { name: string; steps: CompiledStep[] }[] = [];
    for (const step of list) {
      const existing = groups.find((g) => g.name === step.parentTemplateName);
      if (existing) {
        existing.steps.push(step);
      } else {
        groups.push({ name: step.parentTemplateName, steps: [step] });
      }
    }
    return groups;
  };

  const activeGroups = groupByName(activeSteps);
  const lockedGroups = groupByName(lockedSteps);

  const handleComplete = () => {
    completeRun();
    router.back();
  };

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="border-b border-gray-800 px-4 py-4">
        <Text className="text-xl font-bold text-white">Flight Plan</Text>
        <Text className="mt-1 text-sm text-gray-500">
          {completedCount} / {totalCount} complete
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* NOW ACTIVE zone */}
        <View className="px-4 pt-4">
          <Text className="mb-3 text-sm font-bold tracking-wider text-orange-400">
            NOW ACTIVE
          </Text>
          {activeGroups.map((group) => (
            <View key={group.name} className="mb-4">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {group.name}
              </Text>
              {group.steps.map((step) => (
                <Animated.View key={step.id} layout={Layout.springify()}>
                  <Pressable
                    onPress={() => toggleStep(step.id)}
                    className="mb-2 flex-row items-center rounded-lg bg-gray-900 px-4 py-4"
                    style={{ minHeight: 56 }}
                  >
                    <View
                      className="mr-3 h-6 w-6 items-center justify-center rounded-full border-2"
                      style={{ borderColor: '#22c55e', backgroundColor: 'transparent' }}
                    />
                    <Text className="flex-1 text-base text-white">{step.text}</Text>
                    {step.executionMode === 'parallel' && (
                      <Text className="text-xs text-gray-600">parallel</Text>
                    )}
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          ))}
        </View>

        {/* NEXT UP zone */}
        {lockedGroups.length > 0 && (
          <View className="px-4 pt-2 pb-4">
            <Text className="mb-3 text-sm font-bold tracking-wider text-gray-600">
              NEXT UP
            </Text>
            {lockedGroups.map((group) => (
              <View key={group.name} className="mb-4">
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
                  {group.name}
                </Text>
                {group.steps.map((step) => (
                  <View
                    key={step.id}
                    className="mb-2 flex-row items-center rounded-lg bg-gray-900/50 px-4 py-3"
                    style={{ opacity: 0.4 }}
                  >
                    <View
                      className="mr-3 h-6 w-6 rounded-full border-2 border-gray-700"
                    />
                    <Text className="flex-1 text-sm text-gray-600">{step.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom bar */}
      <View className="border-t border-gray-800 bg-gray-950 px-4 pb-8 pt-4">
        <View className="mb-4 h-2 overflow-hidden rounded-full bg-gray-800">
          <Animated.View
            style={useAnimatedStyle(() => ({
              width: withTiming(`${progress * 100}%`),
              height: '100%',
              backgroundColor: activeRun.isFinished ? '#22c55e' : '#3b82f6',
              borderRadius: 9999,
            }))}
          />
        </View>
        <Pressable
          onPress={handleComplete}
          disabled={!activeRun.isFinished}
          className={`rounded-xl py-4 ${
            activeRun.isFinished ? 'bg-green-600 active:bg-green-700' : 'bg-gray-800'
          }`}
        >
          <Text
            className={`text-center text-base font-bold ${
              activeRun.isFinished ? 'text-white' : 'text-gray-600'
            }`}
          >
            {activeRun.isFinished
              ? 'Complete Run & Reset'
              : `${totalCount - completedCount} steps remaining`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

---

## Integration Notes for `app/index.tsx`

The home dashboard needs updates to support multi-select template launching and bookmark display:

```tsx
// Multi-select launch: track selected template IDs
const [selectedIds, setSelectedIds] = useState<string[]>([]);

// Launch combined run
const handleLaunchCombined = () => {
  if (selectedIds.length === 0) return;
  compileAndStartRun(selectedIds);
  router.push('/flight-deck');
};

// Bookmark launch
const handleLaunchBookmark = (bookmark: RoutineBookmark) => {
  compileAndStartRun(bookmark.templateIds, bookmark.selectedBranches);
  router.push('/flight-deck');
};

// Render bookmarks above template list
{state.bookmarks.map((bm) => (
  <Pressable key={bm.id} onPress={() => handleLaunchBookmark(bm)} className="...">
    <Text className="text-white">{bm.title}</Text>
  </Pressable>
))}
```
