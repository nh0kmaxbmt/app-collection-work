// app/flight-deck.tsx — V6.1 Dynamic Execution Deck (Hook-Safe & Navigation-Robust)
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Layout,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import type { CompiledStep } from '../src/core/types';

const AnimatedView = Animated.View;

// Separate component for animated step item
interface AnimatedStepItemProps {
  step: CompiledStep;
  onPress: (stepId: string) => void;
}

function AnimatedStepItem({ step, onPress }: AnimatedStepItemProps) {
  const checkboxStyle = useAnimatedStyle(
    () => ({
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      marginRight: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderColor: step.isCompleted ? '#22c55e' : '#4b5563',
      backgroundColor: withTiming(step.isCompleted ? '#22c55e' : 'transparent'),
    }),
    [step.isCompleted],
  );

  const textStyle = useAnimatedStyle(
    () => ({
      flex: 1,
      fontSize: 16,
      opacity: withTiming(step.isCompleted ? 0.5 : 1),
      textDecorationColor: '#ffffff',
      textDecorationLine: step.isCompleted ? ('line-through' as const) : ('none' as const),
      color: '#ffffff',
    }),
    [step.isCompleted],
  );

  return (
    <AnimatedView layout={Layout.springify()}>
      <Pressable
        onPress={() => onPress(step.id)}
        style={styles.stepItem}
      >
        <Animated.View style={checkboxStyle}>
          {step.isCompleted && <Text style={styles.checkmark}>&#10003;</Text>}
        </Animated.View>
        <Animated.Text style={textStyle}>{step.text}</Animated.Text>
        {step.executionMode === 'parallel' && (
          <Text style={styles.executionModeBadge}>parallel</Text>
        )}
      </Pressable>
    </AnimatedView>
  );
}

export default function FlightDeck() {
  const {
    state,
    toggleStep,
    completeRun,
    appendCollectionToActiveRun,
    saveActiveRunAsTemplate,
  } = useFlightManual();
  const { activeRun, collections } = state;

  // ─── ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS ───
  const [appendModalVisible, setAppendModalVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [appendSearch, setAppendSearch] = useState('');

  // Memoized values based on activeRun state
  const steps = activeRun?.currentSteps ?? [];
  const completedCount = steps.filter((s) => s.isCompleted).length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  // Unique collection count for save guard
  const uniqueCollections = useMemo(
    () => new Set(steps.map((s) => s.parentTemplateName)),
    [steps],
  );
  const showSaveButton = uniqueCollections.size > 1;

  // Grouping helper
  const groupByName = useCallback((list: CompiledStep[]) => {
    const groups: { name: string; steps: CompiledStep[] }[] = [];
    for (const step of list) {
      const existing = groups.find((g) => g.name === step.parentTemplateName);
      if (existing) existing.steps.push(step);
      else groups.push({ name: step.parentTemplateName, steps: [step] });
    }
    return groups;
  }, []);

  const activeSteps = steps.filter((s) => !s.isCompleted && !s.isLocked);
  const lockedSteps = steps.filter((s) => !s.isCompleted && s.isLocked);

  const activeGroups = useMemo(() => groupByName(activeSteps), [activeSteps, groupByName]);
  const lockedGroups = useMemo(() => groupByName(lockedSteps), [lockedSteps, groupByName]);

  // Filtered collections for append modal (exclude already-running ones)
  const availableCollections = useMemo(
    () =>
      collections.filter((c) => {
        const nameMatch =
          !appendSearch ||
          c.name.toLowerCase().includes(appendSearch.toLowerCase());
        const notAlreadyRunning = !uniqueCollections.has(c.name);
        return nameMatch && notAlreadyRunning;
      }),
    [collections, appendSearch, uniqueCollections],
  );

  // Reanimated progress style
  const progressStyle = useAnimatedStyle(
    () => ({
      width: `${progress * 100}%`,
      height: '100%',
      backgroundColor: activeRun?.isFinished ? '#22c55e' : '#3b82f6',
      borderRadius: 9999,
    }),
    [progress, activeRun?.isFinished],
  );

  // ─── Handlers ───────────────────────────────────────────────
  const handleAppend = (collectionId: string) => {
    appendCollectionToActiveRun(collectionId);
    setAppendModalVisible(false);
    setAppendSearch('');
  };

  const handleSave = () => {
    if (!saveTitle.trim()) {
      Alert.alert('Error', 'Please enter a name for this routine');
      return;
    }
    saveActiveRunAsTemplate(saveTitle.trim(), saveDescription.trim());
    setSaveTitle('');
    setSaveDescription('');
    setSaveModalVisible(false);
    Alert.alert('Saved', 'Your routine has been saved successfully');
  };

  const handleComplete = () => {
    if (!activeRun) return;

    // Navigate FIRST before clearing state to ensure component unmounts cleanly
    router.replace('/');

    // Then complete the run (clears activeRun)
    completeRun();
  };

  // ─── CONDITIONAL RENDERING (after all hooks) ─────────────────────
  if (!activeRun) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No active run</Text>
        <Pressable
          onPress={() => router.replace('/')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Flight Plan</Text>
        <Text style={styles.headerSubtitle}>
          {completedCount} / {totalCount} complete
        </Text>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* NOW ACTIVE */}
        <View style={styles.zoneContainer}>
          <Text style={styles.activeZoneTitle}>🔥 NOW ACTIVE</Text>
          {activeGroups.map((group) => (
            <View key={group.name} style={styles.templateGroup}>
              <Text style={styles.templateGroupName}>{group.name}</Text>
              {group.steps.map((step) => (
                <AnimatedStepItem
                  key={step.id}
                  step={step}
                  onPress={toggleStep}
                />
              ))}
            </View>
          ))}
        </View>

        {/* NEXT UP */}
        {lockedGroups.length > 0 && (
          <View style={styles.zoneContainer}>
            <Text style={styles.lockedZoneTitle}>⏳ NEXT UP</Text>
            {lockedGroups.map((group) => (
              <View key={group.name} style={styles.templateGroup}>
                <Text style={styles.lockedTemplateGroupName}>{group.name}</Text>
                {group.steps.map((step) => (
                  <View key={step.id} style={styles.lockedStepItem}>
                    <View style={styles.lockedCheckbox} />
                    <Text style={styles.lockedStepText}>{step.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Append Collection button */}
        <View style={styles.appendContainer}>
          <Pressable
            onPress={() => setAppendModalVisible(true)}
            style={styles.appendButton}
          >
            <Text style={styles.appendButtonText}>+ Append Collection to Run</Text>
          </Pressable>
        </View>

        {/* Save as Template button (conditional) */}
        {showSaveButton && (
          <View style={styles.saveContainer}>
            <Pressable
              onPress={() => setSaveModalVisible(true)}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Save Combination as Routine</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Bottom progress bar + complete */}
      <View style={styles.bottomBar}>
        <View style={styles.progressContainer}>
          <AnimatedView style={progressStyle} />
        </View>
        <Pressable
          onPress={handleComplete}
          disabled={!activeRun.isFinished}
          style={[
            styles.completeButton,
            activeRun.isFinished
              ? styles.completeButtonActive
              : styles.completeButtonInactive,
          ]}
        >
          <Text
            style={[
              styles.completeButtonText,
              activeRun.isFinished
                ? styles.completeButtonTextActive
                : styles.completeButtonTextInactive,
            ]}
          >
            {activeRun.isFinished
              ? 'Complete Run & Reset'
              : `${totalCount - completedCount} steps remaining`}
          </Text>
        </Pressable>
      </View>

      {/* Append Collection Modal */}
      <Modal
        visible={appendModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setAppendModalVisible(false);
          setAppendSearch('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Append Collection</Text>
              <Pressable
                onPress={() => {
                  setAppendModalVisible(false);
                  setAppendSearch('');
                }}
              >
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Search collections..."
              placeholderTextColor="#6b7280"
              value={appendSearch}
              onChangeText={setAppendSearch}
              autoFocus
            />
            <ScrollView style={styles.modalScroll}>
              {availableCollections.map((col) => (
                <Pressable
                  key={col.id}
                  onPress={() => handleAppend(col.id)}
                  style={styles.collectionOption}
                >
                  <Text style={styles.collectionOptionName}>{col.name}</Text>
                  <Text style={styles.collectionOptionMeta}>
                    {col.executionMode} · {col.steps.length} steps
                  </Text>
                </Pressable>
              ))}
              {availableCollections.length === 0 && (
                <Text style={styles.noCollectionsText}>
                  No collections available to append
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Save Template Modal */}
      <Modal
        visible={saveModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.saveModalContent}>
            <Text style={styles.modalTitle}>Save as Routine</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Routine name"
              placeholderTextColor="#6b7280"
              value={saveTitle}
              onChangeText={setSaveTitle}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Description (optional)"
              placeholderTextColor="#6b7280"
              value={saveDescription}
              onChangeText={setSaveDescription}
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setSaveModalVisible(false);
                  setSaveTitle('');
                  setSaveDescription('');
                }}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!saveTitle.trim()}
                style={[
                  styles.modalSaveButton,
                  !saveTitle.trim() ? styles.modalSaveButtonDisabled : null,
                ]}
              >
                <Text
                  style={[
                    styles.modalSaveButtonText,
                    !saveTitle.trim() ? styles.modalSaveButtonTextDisabled : null,
                  ]}
                >
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  backButton: {
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
  scrollContent: {
    flex: 1,
  },
  zoneContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  activeZoneTitle: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#fb923c',
  },
  lockedZoneTitle: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#4b5563',
  },
  templateGroup: {
    marginBottom: 16,
  },
  templateGroupName: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#6b7280',
  },
  lockedTemplateGroupName: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#374151',
  },
  stepItem: {
    marginBottom: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  executionModeBadge: {
    fontSize: 12,
    color: '#6b7280',
  },
  lockedStepItem: {
    marginBottom: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: 8,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    opacity: 0.4,
  },
  lockedCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    marginRight: 12,
  },
  lockedStepText: {
    flex: 1,
    fontSize: 14,
    color: '#4b5563',
  },
  appendContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  appendButton: {
    alignItems: 'center' as const,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#4b5563',
    backgroundColor: 'transparent',
    paddingVertical: 14,
  },
  appendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
  },
  saveContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  saveButton: {
    alignItems: 'center' as const,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  saveModalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 24,
  },
  modalHeader: {
    marginBottom: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalClose: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalInput: {
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#030712',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
  },
  modalScroll: {
    maxHeight: 300,
  },
  collectionOption: {
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  collectionOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  collectionOptionMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  noCollectionsText: {
    paddingVertical: 32,
    textAlign: 'center',
    color: '#4b5563',
  },
  modalButtons: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    alignItems: 'center' as const,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    paddingVertical: 14,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
  },
  modalSaveButton: {
    flex: 1,
    alignItems: 'center' as const,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#1f2937',
    opacity: 0.6,
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalSaveButtonTextDisabled: {
    color: '#4b5563',
  },
});
