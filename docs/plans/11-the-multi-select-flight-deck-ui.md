# 11 — The Multi-Select Flight Deck UI

## Source
`docs/gemini-archive/component/gemini-11-The Multi-Select Flight Deck UI.txt`
Design context: `docs/gemini-archive/manual/gemini_manual-03-app-data-insert.md` Part 1

## Feature Description
Upgraded flight deck that replaces the single-choice branch gate with a dynamic multi-select matrix. Users can toggle multiple focus groups (e.g., both "Legs" and "Core") on/off at any time, with steps injecting or removing instantly without breaking baseline progress.

## Requirements
1. Check if `activeRun` has a branching step configuration
2. Render branching options as **multi-select toggle chips / checkable cards** (not a rigid single-option gate)
3. Tapping an option toggles it on/off, calling `toggleBranchOption(key, steps)` — instantly animates injection/removal of tasks
4. Render the active step list dynamically; downstream steps stay locked until their prerequisite is checked
5. Bottom completion drawer appears when ALL currently visible tasks are `isCompleted === true`

## Key Behavior Changes from Plan 09
- Branch options are now **toggleable checkboxes/chips**, not one-shot radio buttons
- Tapping an already-selected branch **removes** its steps from the list (reversible)
- `selectedBranches` is `string[]` instead of `selectedBranch?: string`
- No "gate" phase — branches can be toggled at any point during execution

## Adaptation Notes (Expo / React Native)
- Use `Pressable` with visual state for selected/unselected chips
- `react-native-reanimated` `Layout` transition for smooth step injection/removal animation
- `FlatList` with `extraData` or key-based re-rendering for branch step changes
- NativeWind `className` for all styling

---

## Sample Code: `app/flight-deck.tsx`

```tsx
// app/flight-deck.tsx — V3 Multi-Select Flight Deck
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Layout } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import { StepItem } from '../src/components/StepItem';
import type { Step } from '../src/core/types';

export default function FlightDeck() {
  const { state, toggleBranchOption, toggleStep, completeRun } = useFlightManual();
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
  const hasBranching = !!template?.branchingStep;

  const completedCount = activeRun.currentSteps.filter((s) => s.isCompleted).length;
  const totalCount = activeRun.currentSteps.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  const handleBranchToggle = (key: string) => {
    const steps = template!.branchingStep!.options[key] ?? [];
    toggleBranchOption(key, steps);
  };

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

      {/* Multi-select branch chips */}
      {hasBranching && (
        <View className="border-b border-gray-800 px-4 py-4">
          <Text className="mb-3 text-sm font-medium text-gray-400">
            {template!.branchingStep!.question}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {Object.keys(template!.branchingStep!.options).map((key) => {
              const isSelected = activeRun.selectedBranches.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => handleBranchToggle(key)}
                  className={`rounded-full px-5 py-2.5 ${
                    isSelected
                      ? 'border-2 border-blue-500 bg-blue-500/20'
                      : 'border border-gray-700 bg-gray-900'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      isSelected ? 'text-blue-400' : 'text-gray-400'
                    }`}
                  >
                    {isSelected ? '✓ ' : ''}{key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Step list with layout animation */}
      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {activeRun.currentSteps.map((step: Step) => (
          <Animated.View key={step.id} layout={Layout.springify()}>
            <StepItem
              step={step}
              onToggle={() => { if (!step.isLocked) toggleStep(step.id); }}
            />
          </Animated.View>
        ))}
      </ScrollView>

      {/* Bottom bar */}
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

        {/* Complete / status */}
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
