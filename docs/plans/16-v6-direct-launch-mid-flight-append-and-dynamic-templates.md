# 16 — V6 Direct Launch, Mid-Flight Append & Dynamic Templates

## Source
`docs/gemini-archive/component/gemini-16-combined Templates-enhance-02.txt`
Design context: `docs/gemini-archive/manual/gemini_manual-07-app-collection-linkage-enhance-02.md`

## Feature Description
The V6 "Mid-Flight Composable Pipeline" architecture. Three fundamental shifts from V5:

1. **1-Tap Direct Launch** — no queue tray, no multi-select staging. Tapping any Collection or Template instantly starts execution.
2. **Mid-Flight Appending** — while executing, users can inject additional Collections into the active run without losing progress (like adding a stop to GPS navigation mid-drive).
3. **Fluid Dashboard Slider** — animated toggle between "Most Recent" and "Most Used" sort modes.

## Nomenclature Realignment

| Term | Definition | Maps to (V5) |
|------|-----------|--------------|
| **Step** | Single actionable checkbox item | Same |
| **Collection** | Standalone reusable list of flat steps (e.g., "Gym Base Prep") | Was "Template" |
| **Template** | Saved combination of multiple Collections (e.g., "Heavy Leg Gym Day") | Was "RoutineBookmark" |

## Key Changes from V5
- **Deleted:** Queue tray, multi-select checkboxes, "Launch Flight" / "Save Bookmark" tray buttons
- **Added:** `Collection` entity (what Templates were in V5), `appendCollectionToActiveRun()`, `saveActiveRunAsTemplate()`
- **Renamed:** `Template` → `Collection`, `RoutineBookmark` → `Template`
- **Dashboard:** Slider toggle replaces search-only view
- **Storage keys:** `flightmanual::collections` and `flightmanual::templates` (replaces old keys)

## Adaptation Notes (Expo / React Native)
- Sliding toggle: use `react-native-reanimated` `useAnimatedStyle` for fluid tab indicator
- Mid-flight overlay: RN `Modal` component for collection picker
- Storage migration: old keys (`flightmanual::templates` storing what were Templates) now store Collections
- `create-template.tsx` becomes `create-collection.tsx` (or update semantics)

---

## Task 1: Rewrite Core Types (`src/core/types.ts`)

```typescript
// src/core/types.ts — V6 Mid-Flight Composable Pipeline

export type ExecutionMode = 'linear' | 'parallel';

export interface Step {
  id: string;
  text: string;
  isCompleted: boolean;
  isLocked: boolean;
  dependsOnStepId?: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  executionMode: ExecutionMode;
  steps: Step[];
}

export interface Template {
  id: string;
  title: string;
  description?: string;
  templateIds: string[]; // References to Collection IDs
}

export type CompiledStep = Step & {
  parentTemplateName: string;
  executionMode: ExecutionMode;
};

export interface RunInstance {
  id: string;
  startedAt: number;
  currentSteps: CompiledStep[];
  isFinished: boolean;
}

export interface RunLog {
  collectionId: string;
  timestamp: number;
  durationMs: number;
}
```

---

## Task 2: Mid-Flight Data Core (`src/core/store.ts`)

### Storage Keys
- `flightmanual::collections` — stores `Collection[]`
- `flightmanual::templates` — stores `Template[]` (compound combinations)
- `flightmanual::active_run` — stores `RunInstance | null`
- `flightmanual::run_logs` — stores `RunLog[]`

### Key Functions

#### `compileAndStartRun(id: string, isTemplate: boolean)`
- If `isTemplate` is false: compile a single Collection directly into a RunInstance
- If `isTemplate` is true: fetch the Template, resolve its `templateIds` to Collections, compile all into one RunInstance
- Sets locks: parallel = all unlocked, linear = only first unlocked

#### `appendCollectionToActiveRun(collectionId: string)`
- Deep-clones the target Collection's steps
- Tags each with `parentTemplateName` and `executionMode`
- If linear: only first step unlocked, rest locked sequentially
- If parallel: all steps unlocked
- Appends to `activeRun.currentSteps` — existing progress preserved

#### `saveActiveRunAsTemplate(title: string, description: string)`
- Extracts unique `parentTemplateName` values from active run
- Maps them back to Collection IDs
- Creates a Template entry and persists

### Sample Code: compileAndStartRun

```typescript
const compileAndStartRun = useCallback(
  (id: string, isTemplate: boolean) => {
    let collectionIds: string[] = [];

    if (isTemplate) {
      const template = state.templates.find((t) => t.id === id);
      if (!template) return;
      collectionIds = template.templateIds;
    } else {
      collectionIds = [id];
    }

    const compiledSteps: CompiledStep[] = [];
    const seenIds = new Set<string>();

    for (const cId of collectionIds) {
      const collection = state.collections.find((c) => c.id === cId);
      if (!collection) continue;

      const isParallel = collection.executionMode === 'parallel';
      const steps = collection.steps.map((s, i) => {
        const uniqueId = seenIds.has(s.id) ? `${cId}::${s.id}` : s.id;
        seenIds.add(uniqueId);
        return {
          ...s,
          id: uniqueId,
          isCompleted: false,
          isLocked: isParallel ? false : i !== 0,
          dependsOnStepId: !isParallel && i > 0
            ? (seenIds.has(collection.steps[i - 1].id)
              ? `${cId}::${collection.steps[i - 1].id}`
              : collection.steps[i - 1].id)
            : undefined,
          parentTemplateName: collection.name,
          executionMode: collection.executionMode,
        } as CompiledStep;
      });
      compiledSteps.push(...steps);
    }

    dispatch({
      type: 'START_RUN',
      payload: {
        id: `run_${Date.now()}`,
        startedAt: Date.now(),
        currentSteps: compiledSteps,
        isFinished: false,
      },
    });
  },
  [state.collections, state.templates],
);
```

### Sample Code: appendCollectionToActiveRun

```typescript
const appendCollectionToActiveRun = useCallback(
  (collectionId: string) => {
    if (!state.activeRun) return;
    const collection = state.collections.find((c) => c.id === collectionId);
    if (!collection) return;

    const isParallel = collection.executionMode === 'parallel';
    const seenIds = new Set(state.activeRun.currentSteps.map((s) => s.id));

    const newSteps: CompiledStep[] = collection.steps.map((s, i) => {
      const uniqueId = seenIds.has(s.id) ? `${collectionId}::${s.id}` : s.id;
      seenIds.add(uniqueId);
      return {
        ...s,
        id: uniqueId,
        isCompleted: false,
        isLocked: isParallel ? false : i !== 0,
        dependsOnStepId: !isParallel && i > 0
          ? (seenIds.has(collection.steps[i - 1].id)
            ? `${collectionId}::${collection.steps[i - 1].id}`
            : collection.steps[i - 1].id)
          : undefined,
        parentTemplateName: collection.name,
        executionMode: collection.executionMode,
      } as CompiledStep;
    });

    dispatch({
      type: 'APPEND_STEPS',
      payload: newSteps,
    });
  },
  [state.activeRun, state.collections],
);
```

### Sample Code: saveActiveRunAsTemplate

```typescript
const saveActiveRunAsTemplate = useCallback(
  async (title: string, description: string) => {
    if (!state.activeRun) return;

    // Extract unique collection names and map back to IDs
    const uniqueNames = [...new Set(state.activeRun.currentSteps.map((s) => s.parentTemplateName))];
    const collectionIds = uniqueNames
      .map((name) => state.collections.find((c) => c.name === name)?.id)
      .filter((id): id is string => !!id);

    if (collectionIds.length < 2) return; // Only save multi-collection combos

    const template: Template = {
      id: `tpl_${Date.now()}`,
      title,
      description: description || undefined,
      templateIds: collectionIds,
    };

    dispatch({ type: 'SAVE_TEMPLATE', payload: template });

    try {
      const current = await AsyncStorage.getItem(KEYS.templates);
      const existing: Template[] = current ? JSON.parse(current) : [];
      await AsyncStorage.setItem(KEYS.templates, JSON.stringify([...existing, template]));
    } catch (e) {
      console.error('[FlightManual] saveActiveRunAsTemplate persist failed:', e);
    }
  },
  [state.activeRun, state.collections],
);
```

### Additional Reducer Action

```typescript
// Add to Action union
| { type: 'APPEND_STEPS'; payload: CompiledStep[] }

// In reducer
case 'APPEND_STEPS': {
  if (!state.activeRun) return state;
  return {
    ...state,
    activeRun: {
      ...state.activeRun,
      currentSteps: [...state.activeRun.currentSteps, ...action.payload],
      isFinished: false, // Reset since new steps were added
    },
  };
}
```

---

## Task 3: Dashboard with Sliding Filter (`app/index.tsx`)

### Layout Structure
- Sliding toggle bar: `[Most Recent] [Most Used]`
- Templates section (compound combinations — 1-tap launch)
- Collections section (standalone lists — 1-tap launch)
- No queue tray, no multi-select, no staging

### Sample Code: `app/index.tsx`

```tsx
// app/index.tsx — V6 Direct Launch Dashboard
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import type { Collection, Template } from '../src/core/types';

type SortMode = 'recent' | 'used';

export default function Dashboard() {
  const { state, compileAndStartRun } = useFlightManual();
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');

  // Sort collections based on mode
  const sortedCollections = (() => {
    let items = [...state.collections];
    if (search) {
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      );
    }
    if (sortMode === 'used') {
      // Count log frequency per collection
      const counts = new Map<string, number>();
      for (const log of state.historyLogs) {
        counts.set(log.collectionId, (counts.get(log.collectionId) ?? 0) + 1);
      }
      items.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
    }
    // 'recent' = default order (creation order)
    return items;
  })();

  const sortedTemplates = (() => {
    let items = [...state.templates];
    if (search) {
      items = items.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()),
      );
    }
    return items;
  })();

  const handleLaunchCollection = (id: string) => {
    compileAndStartRun(id, false);
    router.push('/flight-deck');
  };

  const handleLaunchTemplate = (id: string) => {
    compileAndStartRun(id, true);
    router.push('/flight-deck');
  };

  // Animated slider position
  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(sortMode === 'recent' ? 0 : 150) }],
  }));

  return (
    <View className="flex-1 bg-gray-950">
      {/* Search */}
      <View className="px-4 pt-14">
        <View className="mb-4 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
          <TextInput
            className="text-lg text-white"
            placeholderTextColor="#6b7280"
            placeholder="Search..."
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
      </View>

      {/* Sliding sort toggle */}
      <View className="mb-4 px-4">
        <View className="flex-row rounded-xl bg-gray-900 p-1">
          {/* Animated background slider */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 4,
                left: 4,
                width: 146,
                height: 36,
                backgroundColor: '#1e40af',
                borderRadius: 10,
              },
              sliderStyle,
            ]}
          />
          <Pressable
            onPress={() => setSortMode('recent')}
            className="flex-1 items-center py-2"
          >
            <Text className={`text-sm font-semibold ${sortMode === 'recent' ? 'text-white' : 'text-gray-500'}`}>
              Most Recent
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSortMode('used')}
            className="flex-1 items-center py-2"
          >
            <Text className={`text-sm font-semibold ${sortMode === 'used' ? 'text-white' : 'text-gray-500'}`}>
              Most Used
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Templates (compound combos) */}
        {sortedTemplates.length > 0 && (
          <View className="mb-6">
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-indigo-400">
              Saved Routines
            </Text>
            {sortedTemplates.map((tpl) => (
              <Pressable
                key={tpl.id}
                onPress={() => handleLaunchTemplate(tpl.id)}
                className="mb-2 rounded-xl border border-indigo-500/30 bg-indigo-950/40 px-4 py-3 active:bg-indigo-900/60"
              >
                <Text className="text-base font-bold text-indigo-300">{tpl.title}</Text>
                {tpl.description && (
                  <Text className="mt-0.5 text-xs text-gray-500">{tpl.description}</Text>
                )}
                <Text className="mt-1 text-xs text-gray-600">
                  {tpl.templateIds.length} collection{tpl.templateIds.length !== 1 ? 's' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Collections (standalone lists) */}
        <View className="mb-6">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
            Collections
          </Text>
          {sortedCollections.map((col) => (
            <Pressable
              key={col.id}
              onPress={() => handleLaunchCollection(col.id)}
              className="mb-2 flex-row items-center rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 active:bg-gray-800"
            >
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">{col.name}</Text>
                <View className="mt-1 flex-row items-center gap-2">
                  <Text className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                    {col.executionMode}
                  </Text>
                  {col.tags.map((tag) => (
                    <Text key={tag} className="text-xs text-gray-600">#{tag}</Text>
                  ))}
                </View>
              </View>
              <Text className="text-sm text-gray-600">{col.steps.length} steps</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* FAB for new collection */}
      <Pressable
        onPress={() => router.push('/create-collection')}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-lg active:bg-blue-700"
      >
        <Text className="text-2xl font-light text-white">+</Text>
      </Pressable>
    </View>
  );
}
```

---

## Task 4: Dynamic Execution Deck (`app/flight-deck.tsx`)

### New Features
- **[+ Append Collection to Run]** button pinned below steps
- Opens modal overlay with searchable collection list
- **[Save Combination as Template]** button — only visible when `uniqueCollectionCount > 1`

### Sample Code: Key Additions to Flight Deck

```tsx
// app/flight-deck.tsx — V6 additions (append + save overlay)
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Layout } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import type { CompiledStep } from '../src/core/types';

export default function FlightDeck() {
  const { state, toggleStep, completeRun, appendCollectionToActiveRun, saveActiveRunAsTemplate } = useFlightManual();
  const { activeRun, collections } = state;

  const [appendModalVisible, setAppendModalVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [appendSearch, setAppendSearch] = useState('');

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

  // Unique collection count for save guard
  const uniqueCollections = new Set(steps.map((s) => s.parentTemplateName));
  const showSaveButton = uniqueCollections.size > 1;

  // Grouping helper
  const groupByName = (list: CompiledStep[]) => {
    const groups: { name: string; steps: CompiledStep[] }[] = [];
    for (const step of list) {
      const existing = groups.find((g) => g.name === step.parentTemplateName);
      if (existing) existing.steps.push(step);
      else groups.push({ name: step.parentTemplateName, steps: [step] });
    }
    return groups;
  };

  const activeGroups = groupByName(activeSteps);
  const lockedGroups = groupByName(lockedSteps);

  // Filtered collections for append modal (exclude already-running ones)
  const availableCollections = collections.filter((c) => {
    const nameMatch = !appendSearch || c.name.toLowerCase().includes(appendSearch.toLowerCase());
    const notAlreadyRunning = !uniqueCollections.has(c.name);
    return nameMatch && notAlreadyRunning;
  });

  const handleAppend = (collectionId: string) => {
    appendCollectionToActiveRun(collectionId);
    setAppendModalVisible(false);
    setAppendSearch('');
  };

  const handleSave = () => {
    if (!saveTitle.trim()) return;
    saveActiveRunAsTemplate(saveTitle.trim(), saveDescription.trim());
    setSaveTitle('');
    setSaveDescription('');
    setSaveModalVisible(false);
  };

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
        {/* NOW ACTIVE */}
        <View className="px-4 pt-4">
          <Text className="mb-3 text-sm font-bold tracking-wider text-orange-400">NOW ACTIVE</Text>
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
                    <View className="mr-3 h-6 w-6 items-center justify-center rounded-full border-2 border-green-500" />
                    <Text className="flex-1 text-base text-white">{step.text}</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          ))}
        </View>

        {/* NEXT UP */}
        {lockedGroups.length > 0 && (
          <View className="px-4 pt-2 pb-4">
            <Text className="mb-3 text-sm font-bold tracking-wider text-gray-600">NEXT UP</Text>
            {lockedGroups.map((group) => (
              <View key={group.name} className="mb-4">
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
                  {group.name}
                </Text>
                {group.steps.map((step) => (
                  <View key={step.id} className="mb-2 flex-row items-center rounded-lg bg-gray-900/50 px-4 py-3" style={{ opacity: 0.4 }}>
                    <View className="mr-3 h-6 w-6 rounded-full border-2 border-gray-700" />
                    <Text className="flex-1 text-sm text-gray-600">{step.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Append Collection button */}
        <View className="px-4 pb-4">
          <Pressable
            onPress={() => setAppendModalVisible(true)}
            className="items-center rounded-xl border border-dashed border-gray-700 py-3 active:bg-gray-900"
          >
            <Text className="text-sm font-semibold text-blue-400">+ Append Collection to Run</Text>
          </Pressable>
        </View>

        {/* Save as Template button (conditional) */}
        {showSaveButton && (
          <View className="px-4 pb-4">
            <Pressable
              onPress={() => setSaveModalVisible(true)}
              className="items-center rounded-xl bg-blue-600 py-3 active:bg-blue-700"
            >
              <Text className="text-sm font-bold text-white">Save Combination as Template</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Bottom progress bar + complete */}
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
          className={`rounded-xl py-4 ${activeRun.isFinished ? 'bg-green-600 active:bg-green-700' : 'bg-gray-800'}`}
        >
          <Text className={`text-center text-base font-bold ${activeRun.isFinished ? 'text-white' : 'text-gray-600'}`}>
            {activeRun.isFinished ? 'Complete Run & Reset' : `${totalCount - completedCount} steps remaining`}
          </Text>
        </Pressable>
      </View>

      {/* Append Collection Modal */}
      <Modal visible={appendModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[70%] rounded-t-2xl bg-gray-900 px-4 pb-8 pt-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-white">Append Collection</Text>
              <Pressable onPress={() => { setAppendModalVisible(false); setAppendSearch(''); }}>
                <Text className="text-gray-500">Close</Text>
              </Pressable>
            </View>
            <TextInput
              className="mb-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white"
              placeholder="Search collections..."
              placeholderTextColor="#6b7280"
              value={appendSearch}
              onChangeText={setAppendSearch}
              autoFocus
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              {availableCollections.map((col) => (
                <Pressable
                  key={col.id}
                  onPress={() => handleAppend(col.id)}
                  className="mb-2 rounded-lg border border-gray-800 bg-gray-800/50 px-4 py-3 active:bg-gray-700"
                >
                  <Text className="text-base font-semibold text-white">{col.name}</Text>
                  <Text className="text-xs text-gray-500">{col.executionMode} · {col.steps.length} steps</Text>
                </Pressable>
              ))}
              {availableCollections.length === 0 && (
                <Text className="py-4 text-center text-gray-600">No collections available to append</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Save Template Modal */}
      <Modal visible={saveModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-2xl bg-gray-900 px-6 pb-8 pt-6">
            <Text className="mb-4 text-lg font-bold text-white">Save as Routine</Text>
            <TextInput
              className="mb-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white"
              placeholder="Routine name"
              placeholderTextColor="#6b7280"
              value={saveTitle}
              onChangeText={setSaveTitle}
              autoFocus
            />
            <TextInput
              className="mb-4 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white"
              placeholder="Description (optional)"
              placeholderTextColor="#6b7280"
              value={saveDescription}
              onChangeText={setSaveDescription}
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setSaveModalVisible(false)}
                className="flex-1 items-center rounded-xl bg-gray-800 py-3"
              >
                <Text className="font-semibold text-gray-400">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!saveTitle.trim()}
                className={`flex-1 items-center rounded-xl py-3 ${saveTitle.trim() ? 'bg-blue-600 active:bg-blue-700' : 'bg-gray-800'}`}
              >
                <Text className={`font-bold ${saveTitle.trim() ? 'text-white' : 'text-gray-600'}`}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
```
