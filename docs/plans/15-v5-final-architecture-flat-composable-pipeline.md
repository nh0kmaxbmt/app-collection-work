# 15 — V5 Final Architecture: Flat Composable Pipeline

## Source
`docs/gemini-archive/component/gemini-15-combined Templates-enhance-01.txt`
Design context: `docs/gemini-archive/manual/gemini_manual-06-app-collection-linkage-enhance-01.md`

## Feature Description
The definitive architecture for FlightManual. Based on real-world testing, all internal template branching logic is eliminated. Every collection is now a **flat, standalone list** configured as either `linear` or `parallel`. Dynamic scenarios are handled by **stacking multiple templates at the dashboard layer** and saving combinations as `RoutineBookmark` shortcuts. This is the "freeze" architecture — greater functionality with less code complexity.

## What Gets Deleted
- `BranchingStep` interface
- `BranchCondition` interface
- `branchingStep` property on `Template`
- `branchSource` field on `Step`
- `selectedBranches` / `selectedBranch` on `RunInstance`
- All branch-related store actions (`selectBranch`, `toggleBranchOption`)
- Branch builder UI in `create-template.tsx`

## What Gets Added / Changed
- `Template.steps` replaces `Template.baseSteps` (renamed, flat)
- `Template.description` added
- `RoutineBookmark.description` added
- `RoutineBookmark.selectedBranches` removed — bookmarks only store `templateIds`
- Multi-select command palette with queue tray + Launch/Save Bookmark actions
- Bookmark grid on home screen for 1-tap launches

## Two-Screen Flow (The "Pre-Flight Launchpad")

```
Screen 1: Unified Dashboard
┌──────────────────────────────────────┐
│ [ Search routines...               ] │
│                                      │
│ Your Routines                        │
│ ┌──────────┐ ┌──────────┐           │
│ │ Standard │ │ Saturday │           │
│ │ Gym Day  │ │ Errands  │           │
│ └──────────┘ └──────────┘           │
│                                      │
│ Templates        (✓) multi-select   │
│ [✓] Gym Base Prep                   │
│ [✓] Leg Day Extras                  │
│ [ ] Bookstore Run                   │
├──────────────────────────────────────┤
│ Queue: [Gym Base ✕] [Leg Day ✕]    │
│ [🚀 Launch Flight] [📑 Save Bookmark]│
└──────────────────────────────────────┘
```

## Adaptation Notes (Expo / React Native)
- All previous branching logic stripped from `store.ts`
- `create-template.tsx` simplifies — no branch builder section needed
- `app/index.tsx` gets major rewrite: multi-select + queue tray + bookmark grid
- Flight deck (`app/flight-deck.tsx`) stays largely the same dual-viewport from V4
- NativeWind for all styling, expo-router for navigation

---

## Task 1: Clean Data Types (`src/core/types.ts`)

```typescript
// src/core/types.ts — V5 Final Clean Model

export type ExecutionMode = 'linear' | 'parallel';

export interface Step {
  id: string;
  text: string;
  isCompleted: boolean;
  isLocked: boolean;
  dependsOnStepId?: string; // Intra-collection linear locking only
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  executionMode: ExecutionMode;
  steps: Step[];
}

export interface RoutineBookmark {
  id: string;
  title: string;
  description?: string;
  templateIds: string[];
}

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

## Task 2: Update Core Context Store (`src/core/store.ts`)

### Key Changes
- No branch-related actions or state
- `compileAndStartRun(templateIds, bookmarkId?)` — simplified, no branch injection
- `saveRoutineBookmark(title, description, templateIds)` — simpler signature
- `saveCustomTemplate` updated for new flat schema (no branchingStep)

### Sample Code: compileAndStartRun

```typescript
const compileAndStartRun = useCallback(
  (templateIds: string[], bookmarkId?: string) => {
    const compiledSteps: CompiledStep[] = [];
    const seenIds = new Set<string>();

    for (const tplId of templateIds) {
      const template = state.templates.find((t) => t.id === tplId);
      if (!template) continue;

      const isParallel = template.executionMode === 'parallel';

      const steps = template.steps.map((s, i) => {
        // Deduplicate IDs across multiple templates
        const id = seenIds.has(s.id) ? `${tplId}::${s.id}` : s.id;
        seenIds.add(id);
        return {
          ...s,
          id,
          isCompleted: false,
          isLocked: isParallel ? false : i !== 0,
          dependsOnStepId: !isParallel && i > 0
            ? (seenIds.has(template.steps[i - 1].id) ? `${tplId}::${template.steps[i - 1].id}` : template.steps[i - 1].id)
            : undefined,
          parentTemplateName: template.name,
          executionMode: template.executionMode,
        } as CompiledStep;
      });
      compiledSteps.push(...steps);
    }

    const instance: RunInstance = {
      id: `run_${Date.now()}`,
      bookmarkId,
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
  async (title: string, description: string, templateIds: string[]) => {
    const bookmark: RoutineBookmark = {
      id: `bm_${Date.now()}`,
      title,
      description: description || undefined,
      templateIds,
    };
    dispatch({ type: 'SAVE_BOOKMARK', payload: bookmark });

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

### Sample Code: Updated saveCustomTemplate

```typescript
const saveCustomTemplate = useCallback(
  async (
    name: string,
    description: string,
    tags: string[],
    stepTexts: string[],
    executionMode: ExecutionMode = 'linear',
  ) => {
    const id = `tpl_${Date.now()}`;
    const steps: Step[] = stepTexts.map((text, i) => ({
      id: `step_${id}_${i}`,
      text,
      isCompleted: false,
      isLocked: false, // Lock state is set at compile time
      dependsOnStepId: i > 0 ? `step_${id}_${i - 1}` : undefined,
    }));
    const template: Template = { id, name, description: description || undefined, tags, executionMode, steps };
    dispatch({ type: 'SAVE_TEMPLATE', payload: template });

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

---

## Task 3: Refactor Dashboard Launcher (`app/index.tsx`)

### Features
- Search bar (same Spotlight-style)
- Bookmark grid at top for 1-tap launches
- Template list with multi-select checkboxes
- Bottom queue tray showing stacked items with remove buttons
- "Launch Flight" and "Save Bookmark" actions on tray
- Save Bookmark modal (Name + Description inputs)

### Sample Code: `app/index.tsx`

```tsx
// app/index.tsx — V5 Multi-Select Launcher + Bookmark Grid
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import { getWeightedTemplates } from '../src/core/engine';
import type { Template, RoutineBookmark } from '../src/core/types';

export default function Dashboard() {
  const { state, compileAndStartRun, saveRoutineBookmark } = useFlightManual();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bookmarkModalVisible, setBookmarkModalVisible] = useState(false);
  const [bmTitle, setBmTitle] = useState('');
  const [bmDescription, setBmDescription] = useState('');

  // Filtered / weighted templates
  const weighted = getWeightedTemplates(state.templates, state.historyLogs);
  const displayed = query
    ? state.templates.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())),
      )
    : weighted;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleLaunch = () => {
    if (selectedIds.length === 0) return;
    compileAndStartRun(selectedIds);
    setSelectedIds([]);
    router.push('/flight-deck');
  };

  const handleLaunchBookmark = (bm: RoutineBookmark) => {
    compileAndStartRun(bm.templateIds, bm.id);
    router.push('/flight-deck');
  };

  const handleSaveBookmark = () => {
    if (!bmTitle.trim() || selectedIds.length === 0) return;
    saveRoutineBookmark(bmTitle.trim(), bmDescription.trim(), selectedIds);
    setBmTitle('');
    setBmDescription('');
    setBookmarkModalVisible(false);
    setSelectedIds([]);
  };

  return (
    <View className="flex-1 bg-gray-950">
      {/* Search bar */}
      <View className="px-4 pt-14">
        <View className="mb-4 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
          <TextInput
            className="text-lg text-white"
            placeholderTextColor="#6b7280"
            placeholder="Search routines..."
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Bookmark grid */}
        {state.bookmarks.length > 0 && (
          <View className="px-4 mb-4">
            <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Your Routines
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {state.bookmarks.map((bm) => (
                <Pressable
                  key={bm.id}
                  onPress={() => handleLaunchBookmark(bm)}
                  className="rounded-xl border border-indigo-500/30 bg-indigo-950/50 px-4 py-3 active:bg-indigo-900"
                >
                  <Text className="text-sm font-bold text-indigo-300">{bm.title}</Text>
                  {bm.description ? (
                    <Text className="mt-0.5 text-xs text-gray-500">{bm.description}</Text>
                  ) : null}
                  <Text className="mt-1 text-xs text-gray-600">
                    {bm.templateIds.length} collection{bm.templateIds.length !== 1 ? 's' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Template list with multi-select */}
        <View className="px-4">
          <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Templates
          </Text>
          {displayed.map((tpl) => {
            const isSelected = selectedIds.includes(tpl.id);
            return (
              <Pressable
                key={tpl.id}
                onPress={() => toggleSelect(tpl.id)}
                className={`mb-2 flex-row items-center rounded-lg border px-4 py-3 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-gray-800 bg-gray-900'
                }`}
              >
                {/* Checkbox indicator */}
                <View
                  className={`mr-3 h-5 w-5 items-center justify-center rounded border-2 ${
                    isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-600'
                  }`}
                >
                  {isSelected && <Text className="text-xs font-bold text-white">✓</Text>}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-white">{tpl.name}</Text>
                  <View className="mt-1 flex-row items-center gap-2">
                    <Text className="text-xs text-gray-500">{tpl.executionMode}</Text>
                    {tpl.tags.map((tag) => (
                      <Text key={tag} className="text-xs text-gray-600">#{tag}</Text>
                    ))}
                  </View>
                </View>
                {/* Quick single-launch */}
                <Pressable
                  onPress={() => {
                    compileAndStartRun([tpl.id]);
                    router.push('/flight-deck');
                  }}
                  className="ml-2 rounded-lg bg-gray-800 px-3 py-1.5 active:bg-gray-700"
                >
                  <Text className="text-xs font-semibold text-gray-400">Run</Text>
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Queue tray */}
      {selectedIds.length > 0 && (
        <View className="border-t border-gray-800 bg-gray-900 px-4 pb-8 pt-3">
          {/* Stacked items */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {selectedIds.map((id) => {
              const tpl = state.templates.find((t) => t.id === id);
              if (!tpl) return null;
              return (
                <View
                  key={id}
                  className="mr-2 flex-row items-center rounded-full bg-gray-800 px-3 py-1.5"
                >
                  <Text className="mr-2 text-xs text-white">{tpl.name}</Text>
                  <Pressable onPress={() => toggleSelect(id)}>
                    <Text className="text-xs text-gray-500">✕</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          {/* Action buttons */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleLaunch}
              className="flex-1 items-center rounded-xl bg-blue-600 py-3 active:bg-blue-700"
            >
              <Text className="text-sm font-bold text-white">Launch Flight</Text>
            </Pressable>
            <Pressable
              onPress={() => setBookmarkModalVisible(true)}
              className="flex-1 items-center rounded-xl border border-gray-700 bg-gray-800 py-3 active:bg-gray-700"
            >
              <Text className="text-sm font-bold text-gray-300">Save Bookmark</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* FAB for new template */}
      <Pressable
        onPress={() => router.push('/create-template')}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-lg active:bg-blue-700"
      >
        <Text className="text-2xl font-light text-white">+</Text>
      </Pressable>

      {/* Save Bookmark modal */}
      <Modal visible={bookmarkModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          className="flex-1 justify-end"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="rounded-t-2xl bg-gray-900 px-6 pb-8 pt-6">
            <Text className="mb-4 text-lg font-bold text-white">Save as Routine</Text>
            <TextInput
              className="mb-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white"
              placeholder="Routine name"
              placeholderTextColor="#6b7280"
              value={bmTitle}
              onChangeText={setBmTitle}
              autoFocus
            />
            <TextInput
              className="mb-4 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white"
              placeholder="Description (optional)"
              placeholderTextColor="#6b7280"
              value={bmDescription}
              onChangeText={setBmDescription}
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setBookmarkModalVisible(false)}
                className="flex-1 items-center rounded-xl bg-gray-800 py-3"
              >
                <Text className="font-semibold text-gray-400">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveBookmark}
                disabled={!bmTitle.trim()}
                className={`flex-1 items-center rounded-xl py-3 ${
                  bmTitle.trim() ? 'bg-blue-600 active:bg-blue-700' : 'bg-gray-800'
                }`}
              >
                <Text className={`font-bold ${bmTitle.trim() ? 'text-white' : 'text-gray-600'}`}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
```

---

## Task 4: Flight Deck (`app/flight-deck.tsx`)

### No Major Changes from V4 Plan (14)
The dual-viewport engine from plan 14 remains the same. The only difference is that compiled steps no longer have `branchSource` — they all come from flat templates. The grouping logic, active/locked zones, progress bar, and completion handler are identical.

Reference: `docs/plans/14-v4-composable-stack-architecture-combined-templates.md` Task 3 sample code.

One minor update — the toggle step handler must unlock the next sibling **within the same parent template**:

```typescript
const toggleStep = useCallback((stepId: string) => {
  dispatch({ type: 'TOGGLE_STEP', payload: stepId });
}, []);
```

The reducer's `TOGGLE_STEP` case finds the step, flips `isCompleted`, then scans `currentSteps` for items with `dependsOnStepId === stepId` and unlocks them. This already works correctly for the flat model since `dependsOnStepId` chains are intra-template.
