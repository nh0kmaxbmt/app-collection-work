# 05 — UI: Flight Deck View

## Source
`docs/gemini-archive/gemini-05-UI Flight Deck View.txt`

## Feature Description
The core execution screen. Displays the active run with sequential steps, branch selection, progress tracking, and a completion/reset mechanism.

## Requirements
- If the active run has an unchosen branch, render a selector for the branch options (e.g., "Legs / Core")
- Render steps sequentially; locked steps are dimmed and unclickable
- Active steps are large, high-contrast touch targets optimized for mobile
- Subtle animations on state transitions (step checked off, next step unlocks)
- Fixed bottom bar with a progress bar and "Complete Run / Reset" button
- Button triggers `completeRun()` once all steps are checked

## Adaptation Notes (Expo / React Native)
- **Routing:** This is `app/flight-deck.tsx` (expo-router file-based route)
- **Styling:** NativeWind (`className`) instead of web Tailwind
- **Animations:** Use `react-native-reanimated` (already installed) for step transition animations
- **Touch targets:** Minimum 44pt touch areas per Apple HIG
- **Scroll:** Use `ScrollView` or `FlatList` for step list
- **Progress bar:** Custom view with animated width using Reanimated's `useAnimatedStyle`

---

## Sample Code: `app/flight-deck.tsx`

```tsx
// app/flight-deck.tsx
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useStore } from '../src/core/store';
import { StepItem } from '../src/components/StepItem';
import type { Template } from '../src/core/types';

export default function FlightDeck() {
  const { state, toggleStep, selectBranch, completeRun } = useStore();
  const { activeRun, templates } = state;

  if (!activeRun) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-950">
        <Text className="text-gray-500">No active run</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-lg bg-blue-600 px-6 py-3">
          <Text className="font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const template = templates.find((t) => t.id === activeRun.templateId);
  const hasBranching = template?.branchingStep;
  const branchChosen = hasBranching
    ? activeRun.currentSteps.some((s) => s.id.startsWith('legs-') || s.id.startsWith('core-'))
    : true;

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

      {/* Branch selector */}
      {hasBranching && !branchChosen && (
        <View className="border-b border-gray-800 px-4 py-4">
          <Text className="mb-3 text-base font-semibold text-white">
            {template!.branchingStep!.question}
          </Text>
          <View className="flex-row gap-3">
            {Object.keys(template!.branchingStep!.options).map((key) => (
              <Pressable
                key={key}
                onPress={() => selectBranch(key)}
                className="flex-1 rounded-lg border border-blue-500 bg-gray-900 px-4 py-3 active:bg-blue-600"
              >
                <Text className="text-center font-semibold text-blue-400">{key}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Steps list */}
      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {activeRun.currentSteps.map((step) => (
          <StepItem
            key={step.id}
            step={step}
            onToggle={() => {
              if (!step.isLocked) toggleStep(step.id);
            }}
          />
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

        {/* Complete button */}
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
            {activeRun.isFinished ? 'Complete Run & Reset' : `${totalCount - completedCount} steps remaining`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

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
    backgroundColor: withTiming(step.isCompleted ? '#22c55e' : '#1f2937'),
    borderColor: withTiming(step.isCompleted ? '#22c55e' : '#4b5563'),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: withTiming(step.isLocked ? 0.3 : step.isCompleted ? 0.6 : 1),
  }));

  return (
    <Pressable
      onPress={onToggle}
      disabled={step.isLocked}
      className="mb-3 flex-row items-center rounded-lg bg-gray-900 px-4 py-4"
      style={{ minHeight: 56 }}
    >
      {/* Checkbox circle */}
      <Animated.View
        style={[
          {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            marginRight: 12,
            alignItems: 'center',
            justifyContent: 'center',
          },
          checkStyle,
        ]}
      >
        {step.isCompleted && (
          <Text className="text-xs font-bold text-white">&#10003;</Text>
        )}
      </Animated.View>

      {/* Step text */}
      <Animated.View style={[{ flex: 1 }, textStyle]}>
        <Text
          className={`text-base ${
            step.isLocked
              ? 'text-gray-700'
              : step.isCompleted
                ? 'text-gray-500 line-through'
                : 'text-white'
          }`}
        >
          {step.text}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
```
