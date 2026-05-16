# 09 — Search Dashboard & Run-time Execution View UI Configuration

## Source
`docs/gemini-archive/component/gemini-09-Search Dashboard & Run-time Execution View UI Configuration.txt`
Data lifecycle: `docs/gemini-archive/manual/gemini_manual-02-app-data.md` Part 3

## Feature Description
Combined UI plan for all three screens: the command palette (search dashboard), the flight deck (execution view), and the step item component. These map directly to the 6-phase Data Interaction Lifecycle from the manual.

## Requirements
- **`app/index.tsx`** — Full-screen Raycast-style spotlight input. Lists weighted templates when empty. Enter/click calls `startRun()` and routes to flight-deck.
- **`app/flight-deck.tsx`** — Subscribes to `activeRun` state. If branch is unselected, renders full-screen touch buttons for each option via `selectBranch()`. Renders sequential steps via `StepItem`. Fixed bottom progress bar with completion trigger.
- **`src/components/StepItem.tsx`** — NativeWind-styled step renderer. Locked items use opacity/blur. Active steps use large mobile tap targets (min 44pt).

## Data Interaction Lifecycle Mapping

| Phase | Component | Action |
|-------|-----------|--------|
| Boot | `app/index.tsx` | Reads templates & logs, passes to `getWeightedTemplates()` |
| Init | `app/index.tsx` | User selects template → `startRun()` → route to flight-deck |
| Gate | `app/flight-deck.tsx` | Branch selector shown if `selectedBranch` is undefined |
| Ingest | `app/flight-deck.tsx` | User taps branch → `selectBranch(optionKey)` → steps inject |
| Mutate | `StepItem.tsx` + deck | User checks step → `toggleStep()` → next unlocks |
| Purge | `app/flight-deck.tsx` | All done → `completeRun()` → UI wipes, returns to palette |

## Adaptation Notes (Expo / React Native)
- Expo Router file-based routing: `app/index.tsx`, `app/flight-deck.tsx`
- NativeWind `className` for all styling
- `react-native-reanimated` for step transition animations
- `FlatList` for template/step lists
- `TextInput` with `autoFocus` for search
- `router.push()` / `router.back()` for navigation

---

## Sample Code: `app/index.tsx`

```tsx
// app/index.tsx
import { useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import { getWeightedTemplates } from '../src/core/engine';
import type { Template } from '../src/core/types';

export default function SearchDashboard() {
  const { state, startRun } = useFlightManual();
  const [query, setQuery] = useState('');

  // Weighted order when no search, filtered results when searching
  const weighted = getWeightedTemplates(state.templates, state.historyLogs);
  const displayed = query
    ? state.templates.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())),
      )
    : weighted;

  const handleSelect = (id: string) => {
    startRun(id);
    router.push('/flight-deck');
  };

  return (
    <View className="flex-1 bg-gray-950 px-4 pt-14">
      {/* Spotlight search */}
      <View className="mb-4 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
        <TextInput
          className="text-lg text-white"
          placeholderTextColor="#6b7280"
          placeholder="Search routines..."
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
        />
      </View>

      {/* Template list */}
      <FlatList
        data={displayed}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: Template }) => (
          <Pressable
            onPress={() => handleSelect(item.id)}
            className="mb-2 rounded-lg border border-gray-800 bg-gray-900 px-4 py-4 active:bg-gray-800"
          >
            <Text className="text-base font-semibold text-white">{item.name}</Text>
            <View className="mt-1 flex-row gap-2">
              {item.tags.map((tag) => (
                <Text key={tag} className="text-xs text-gray-500">#{tag}</Text>
              ))}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="mt-8 text-center text-gray-600">No routines found</Text>
        }
      />
    </View>
  );
}
```

---

## Sample Code: `app/flight-deck.tsx`

```tsx
// app/flight-deck.tsx
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import { StepItem } from '../src/components/StepItem';

export default function FlightDeck() {
  const { state, selectBranch, toggleStep, completeRun } = useFlightManual();
  const { activeRun, templates } = state;

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

  const template = templates.find((t) => t.id === activeRun.templateId);
  const needsBranch = template?.branchingStep && !activeRun.selectedBranch;

  const completedCount = activeRun.currentSteps.filter((s) => s.isCompleted).length;
  const totalCount = activeRun.currentSteps.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  const handleComplete = () => {
    completeRun();
    router.back();
  };

  return (
    <View className="flex-1 bg-gray-950">
      {/* Header */}
      <View className="border-b border-gray-800 px-4 py-4">
        <Text className="text-xl font-bold text-white">{template?.name ?? 'Run'}</Text>
        <Text className="mt-1 text-sm text-gray-500">
          {completedCount} / {totalCount} steps
        </Text>
      </View>

      {/* Branch selector — Phase: Gate / Ingest */}
      {needsBranch && (
        <View className="border-b border-gray-800 px-4 py-6">
          <Text className="mb-4 text-center text-base font-semibold text-white">
            {template!.branchingStep!.question}
          </Text>
          <View className="flex-row gap-4 px-2">
            {Object.keys(template!.branchingStep!.options).map((key) => (
              <Pressable
                key={key}
                onPress={() => selectBranch(key)}
                className="flex-1 items-center rounded-xl border-2 border-blue-500 bg-gray-900 py-5 active:bg-blue-900"
              >
                <Text className="text-lg font-bold text-blue-400">{key.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Step list — Phase: Mutate */}
      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {activeRun.currentSteps.map((step) => (
          <StepItem
            key={step.id}
            step={step}
            onToggle={() => { if (!step.isLocked) toggleStep(step.id); }}
          />
        ))}
      </ScrollView>

      {/* Bottom bar — Phase: Purge */}
      <View className="border-t border-gray-800 bg-gray-950 px-4 pb-8 pt-4">
        {/* Progress bar */}
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

        {/* Complete / status button */}
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

## Sample Code: `src/components/StepItem.tsx`

```tsx
// src/components/StepItem.tsx
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { Step } from '../core/types';

interface StepItemProps {
  step: Step;
  onToggle: () => void;
}

export function StepItem({ step, onToggle }: StepItemProps) {
  const checkStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(step.isCompleted ? '#22c55e' : 'transparent'),
    borderColor: withTiming(step.isCompleted ? '#22c55e' : step.isLocked ? '#374151' : '#6b7280'),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: withTiming(step.isLocked ? 0.3 : step.isCompleted ? 0.5 : 1),
  }));

  return (
    <Pressable
      onPress={onToggle}
      disabled={step.isLocked}
      className="mb-3 flex-row items-center rounded-lg bg-gray-900 px-4 py-4"
      style={{ minHeight: 56 }} // 44pt minimum touch + padding
    >
      {/* Checkbox circle */}
      <Animated.View
        style={[
          {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            marginRight: 14,
            alignItems: 'center',
            justifyContent: 'center',
          },
          checkStyle,
        ]}
      >
        {step.isCompleted && <Text className="text-xs font-bold text-white">&#10003;</Text>}
      </Animated.View>

      {/* Step text */}
      <Animated.View style={[{ flex: 1 }, textStyle]}>
        <Text
          className={`text-base ${
            step.isLocked ? 'text-gray-700' : step.isCompleted ? 'text-gray-500 line-through' : 'text-white'
          }`}
        >
          {step.text}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
```
