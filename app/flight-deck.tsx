// app/flight-deck.tsx
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useStore } from '../src/core/store';
import { StepItem } from '../src/components/StepItem';

const AnimatedView = Animated.View;

export default function FlightDeck() {
  const { state, toggleStep, selectBranch, completeRun } = useStore();
  const { activeRun, templates } = state;

  if (!activeRun) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No active run</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{template?.name ?? 'Run'}</Text>
        <Text style={styles.headerSubtitle}>
          {completedCount} / {totalCount} steps
        </Text>
      </View>

      {/* Branch selector */}
      {hasBranching && !branchChosen && (
        <View style={styles.branchSelector}>
          <Text style={styles.branchQuestion}>
            {template!.branchingStep!.question}
          </Text>
          <View style={styles.branchOptions}>
            {Object.keys(template!.branchingStep!.options).map((key) => (
              <Pressable
                key={key}
                onPress={() => selectBranch(key)}
                style={styles.branchOption}
              >
                <Text style={styles.branchOptionText}>{key}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Steps list */}
      <ScrollView
        style={styles.stepsList}
        contentContainerStyle={styles.stepsListContent}
        showsVerticalScrollIndicator={false}
      >
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
      <View style={styles.bottomBar}>
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <AnimatedView
            style={useAnimatedStyle(() => ({
              width: withTiming(`${progress * 100}%`),
              height: '100%',
              backgroundColor: withTiming(
                activeRun.isFinished ? '#22c55e' : '#3b82f6',
              ),
              borderRadius: 9999,
            }))}
          />
        </View>

        {/* Complete button */}
        <Pressable
          onPress={handleComplete}
          disabled={!activeRun.isFinished}
          style={[
            styles.completeButton,
            activeRun.isFinished ? styles.completeButtonActive : styles.completeButtonInactive,
          ]}
        >
          <Text
            style={[
              styles.completeButtonText,
              activeRun.isFinished ? styles.completeButtonTextActive : styles.completeButtonTextInactive,
            ]}
          >
            {activeRun.isFinished ? 'Complete Run & Reset' : `${totalCount - completedCount} steps remaining`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#030712',
  },
  emptyText: {
    color: '#6b7280',
  },
  backButton: {
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    fontWeight: '600',
    color: '#ffffff',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7280',
  },
  branchSelector: {
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  branchQuestion: {
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  branchOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  branchOption: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  branchOptionText: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#60a5fa',
  },
  stepsList: {
    flex: 1,
  },
  stepsListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    backgroundColor: '#030712',
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  progressContainer: {
    marginBottom: 16,
    height: 8,
    borderRadius: 9999,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
  },
  completeButton: {
    borderRadius: 12,
    paddingVertical: 16,
  },
  completeButtonActive: {
    backgroundColor: '#16a34a',
  },
  completeButtonInactive: {
    backgroundColor: '#1f2937',
  },
  completeButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  completeButtonTextActive: {
    color: '#ffffff',
  },
  completeButtonTextInactive: {
    color: '#4b5563',
  },
});
