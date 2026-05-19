// app/create-collection.tsx — V8.4 Drag-and-Drop Reordering & Keyboard Avoidance
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useColorScheme,
  TouchableWithoutFeedback,
  Keyboard,
  PanResponder,
} from 'react-native';
import { useFlightManual } from '../src/core/store';
import type { ExecutionMode, Collection } from '../src/core/types';

interface DragState {
  index: number | null;
  y: number;
  height: number;
}

export default function CreateCollection() {
  const { saveCustomCollection, updateCollection, state } = useFlightManual();
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Check if we're editing an existing collection
  const editingId = params.id;
  const existingCollection = editingId
    ? state.collections.find((c) => c.id === editingId)
    : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [stepTexts, setStepTexts] = useState<string[]>(['']);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('linear');

  // Drag state
  const [dragState, setDragState] = useState<DragState>({ index: null, y: 0, height: 0 });
  const [dragPositions, setDragPositions] = useState<Record<number, number>>({});

  // Detect color scheme for adaptive theming
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Populate form if editing
  useEffect(() => {
    if (existingCollection) {
      setName(existingCollection.name);
      setDescription(existingCollection.description || '');
      setTagsInput(existingCollection.tags.join(', '));
      setStepTexts(existingCollection.steps.map((s) => s.text));
      setExecutionMode(existingCollection.executionMode);
    }
  }, [existingCollection]);

  // Measure row positions for drag calculations
  const measureRow = (index: number, event: any) => {
    const { y, height } = event.nativeEvent.layout;
    setDragPositions(prev => ({ ...prev, [index]: y }));
  };

  // Create pan responder for drag gesture
  const createPanResponder = (index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => dragState.index === null,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {
        setDragState({ index, y: dragPositions[index] || 0, height: 60 });
      },
      onPanResponderMove: (_, gestureState) => {
        const currentY = (dragPositions[index] || 0) + gestureState.dy;
        setDragState(prev => prev.index === index ? { ...prev, y: currentY } : prev);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentY = (dragPositions[index] || 0) + gestureState.dy;

        // Find which index we're over
        let targetIndex = index;
        for (let i = 0; i < stepTexts.length; i++) {
          if (i === index) continue;
          const rowY = dragPositions[i] || 0;
          if (currentY > rowY && currentY < rowY + 60) {
            targetIndex = i;
            break;
          }
        }

        // Reorder if target is different
        if (targetIndex !== index && targetIndex >= 0 && targetIndex < stepTexts.length) {
          setStepTexts(prev => {
            const newItems = [...prev];
            const [removed] = newItems.splice(index, 1);
            newItems.splice(targetIndex, 0, removed);
            return newItems;
          });
        }

        // Reset drag state
        setDragState({ index: null, y: 0, height: 0 });
      },
    });
  };

  const addStep = () => setStepTexts((prev) => [...prev, '']);

  const updateStep = (index: number, text: string) => {
    setStepTexts((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const removeStep = (index: number) => {
    setStepTexts((prev) => prev.filter((_, i) => i !== index));
  };

  // Move step up in array (decrease index)
  const moveStepUp = (index: number) => {
    if (index === 0) return; // Already at top
    setStepTexts((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  // Move step down in array (increase index)
  const moveStepDown = (index: number) => {
    if (index === stepTexts.length - 1) return; // Already at bottom
    setStepTexts((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const filledSteps = stepTexts.map((s) => s.trim()).filter((s) => s.length > 0);
    if (!trimmedName || filledSteps.length === 0) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    if (editingId && existingCollection) {
      // Update existing collection
      await updateCollection(
        editingId,
        trimmedName,
        description.trim(),
        tags,
        executionMode,
        filledSteps,
      );
    } else {
      // Create new collection
      await saveCustomCollection(
        trimmedName,
        description.trim(),
        tags,
        filledSteps,
        executionMode,
      );
    }

    router.back();
  };

  const canSave = name.trim().length > 0 && stepTexts.some((s) => s.trim().length > 0);

  // Adaptive styles
  const adaptiveStyles = {
    container: isDark ? styles.containerDark : styles.containerLight,
    fieldLabel: isDark ? styles.fieldLabelDark : styles.fieldLabelLight,
    textInput: isDark ? styles.textInputDark : styles.textInputLight,
    placeholderText: isDark ? '#6b7280' : '#9ca3af',
    executionModeButton: isDark ? styles.executionModeButtonDark : styles.executionModeButtonLight,
    executionModeButtonSelected: isDark ? styles.executionModeButtonSelectedDark : styles.executionModeButtonSelectedLight,
    executionModeButtonText: isDark ? styles.executionModeButtonTextDark : styles.executionModeButtonTextLight,
    executionModeButtonTextSelected: isDark ? styles.executionModeButtonTextSelectedDark : styles.executionModeButtonTextSelectedLight,
    executionModeDescription: isDark ? styles.executionModeDescriptionDark : styles.executionModeDescriptionLight,
    stepNumber: isDark ? styles.stepNumberDark : styles.stepNumberLight,
    stepInput: isDark ? styles.stepInputDark : styles.stepInputLight,
    stepPlaceholderText: isDark ? '#6b7280' : '#9ca3af',
    removeButtonText: isDark ? styles.removeButtonTextDark : styles.removeButtonTextLight,
    reorderButtonUp: isDark ? styles.reorderButtonDark : styles.reorderButtonLight,
    reorderButtonDown: isDark ? styles.reorderButtonDark : styles.reorderButtonLight,
    reorderButtonDisabled: styles.reorderButtonDisabled,
    reorderButtonText: isDark ? styles.reorderButtonTextDark : styles.reorderButtonTextLight,
    dragHandle: isDark ? styles.dragHandleDark : styles.dragHandleLight,
    addStepButtonText: isDark ? styles.addStepButtonTextDark : styles.addStepButtonTextLight,
    saveButtonActive: isDark ? styles.saveButtonActiveDark : styles.saveButtonActiveLight,
    saveButtonTextActive: isDark ? styles.saveButtonTextActiveDark : styles.saveButtonTextActiveLight,
    saveButtonTextInactive: isDark ? styles.saveButtonTextInactiveDark : styles.saveButtonTextInactiveLight,
    footerBorder: isDark ? styles.footerBorderDark : styles.footerBorderLight,
  };

  return (
    <KeyboardAvoidingView
      style={adaptiveStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {/* Configure header based on mode */}
      <Stack.Screen
        options={{
          title: editingId ? 'Edit Collection' : 'Create Collection',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: isDark ? '#09090b' : '#ffffff',
          },
          headerTintColor: isDark ? '#f4f4f5' : '#09090b',
          headerTitleStyle: {
            color: isDark ? '#f4f4f5' : '#09090b',
            fontWeight: 'bold',
          },
        }}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Collection name (REQUIRED) */}
          <View style={styles.fieldContainer}>
            <View style={styles.labelRow}>
              <Text style={adaptiveStyles.fieldLabel}>Collection Name</Text>
              <Text style={styles.requiredAsterisk}> *</Text>
            </View>
            <TextInput
              style={adaptiveStyles.textInput}
              placeholder="e.g. Grocery Packing"
              placeholderTextColor={adaptiveStyles.placeholderText}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Description (Optional) */}
          <View style={styles.fieldContainer}>
            <Text style={adaptiveStyles.fieldLabel}>Description (Optional)</Text>
            <TextInput
              style={adaptiveStyles.textInput}
              placeholder="Brief description of this collection"
              placeholderTextColor={adaptiveStyles.placeholderText}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Tags (Optional) */}
          <View style={styles.fieldContainer}>
            <Text style={adaptiveStyles.fieldLabel}>Tags (comma-separated)</Text>
            <TextInput
              style={adaptiveStyles.textInput}
              placeholder="e.g. errands, weekly"
              placeholderTextColor={adaptiveStyles.placeholderText}
              value={tagsInput}
              onChangeText={setTagsInput}
            />
          </View>

          {/* Execution Mode Selector */}
          <View style={styles.fieldContainer}>
            <View style={styles.labelRow}>
              <Text style={adaptiveStyles.fieldLabel}>Execution Mode</Text>
              <Text style={styles.requiredAsterisk}> *</Text>
            </View>
            <View style={styles.executionModeContainer}>
              <Pressable
                onPress={() => setExecutionMode('linear')}
                style={[
                  adaptiveStyles.executionModeButton,
                  executionMode === 'linear' ? adaptiveStyles.executionModeButtonSelected : null,
                ]}
              >
                <Text
                  style={[
                    adaptiveStyles.executionModeButtonText,
                    executionMode === 'linear' ? adaptiveStyles.executionModeButtonTextSelected : null,
                  ]}
                >
                  Sequential
                </Text>
                <Text style={adaptiveStyles.executionModeDescription}>
                  Complete steps in strict chronological order
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setExecutionMode('parallel')}
                style={[
                  adaptiveStyles.executionModeButton,
                  executionMode === 'parallel' ? adaptiveStyles.executionModeButtonSelected : null,
                ]}
              >
                <Text
                  style={[
                    adaptiveStyles.executionModeButtonText,
                    executionMode === 'parallel' ? adaptiveStyles.executionModeButtonTextSelected : null,
                  ]}
                >
                  Flexible
                </Text>
                <Text style={adaptiveStyles.executionModeDescription}>
                  All steps available to check off in any order
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Step builder (REQUIRED) */}
          <View style={styles.stepsContainer}>
            <View style={styles.labelRow}>
              <Text style={adaptiveStyles.fieldLabel}>Steps</Text>
              <Text style={styles.requiredAsterisk}> *</Text>
            </View>
            <View style={styles.stepsHelperText}>
              <Text style={styles.stepsHelperTextContent}>
                Drag the ≡ handle to reorder steps
              </Text>
            </View>
            {stepTexts.map((text, i) => {
              const isDragging = dragState.index === i;
              const panHandlers = createPanResponder(i).panHandlers;

              return (
                <View
                  key={i}
                  onLayout={(e) => measureRow(i, e)}
                  style={[
                    styles.stepRow,
                    isDragging && styles.stepRowDragging,
                  ]}
                >
                  {/* Drag handle */}
                  <View
                    {...panHandlers}
                    style={adaptiveStyles.dragHandle}
                  >
                    <Text style={styles.dragHandleIcon}>≡</Text>
                  </View>

                  <Text style={adaptiveStyles.stepNumber}>{i + 1}.</Text>
                  <TextInput
                    style={adaptiveStyles.stepInput}
                    placeholder={`Step ${i + 1}`}
                    placeholderTextColor={adaptiveStyles.stepPlaceholderText}
                    value={text}
                    onChangeText={(t) => updateStep(i, t)}
                  />
                  {stepTexts.length > 1 && (
                    <Pressable onPress={() => removeStep(i)} style={styles.removeButton}>
                      <Text style={adaptiveStyles.removeButtonText}>−</Text>
                    </Pressable>
               
                  )}
                </View>
              );
            })}

            <Pressable onPress={addStep} style={styles.addStepButton}>
              <Text style={adaptiveStyles.addStepButtonText}>+ Add Step</Text>
            </Pressable>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Save button */}
      <View style={[styles.footerContainer, adaptiveStyles.footerBorder]}>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[
            styles.saveButton,
            canSave ? adaptiveStyles.saveButtonActive : styles.saveButtonInactive,
          ]}
        >
          <Text
            style={[
              styles.saveButtonText,
              canSave ? adaptiveStyles.saveButtonTextActive : adaptiveStyles.saveButtonTextInactive,
            ]}
          >
            {editingId ? 'Update Collection' : 'Save Collection'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Container - Adaptive light/dark
  containerLight: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  containerDark: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabelLight: {
    fontSize: 14,
    fontWeight: '600',
    color: '#71717a',
  },
  fieldLabelDark: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  requiredAsterisk: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
    marginLeft: 2,
  },
  textInputLight: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#18181b',
  },
  textInputDark: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fafafa',
  },
  executionModeContainer: {
    gap: 8,
  },
  executionModeButtonLight: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  executionModeButtonDark: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  executionModeButtonSelectedLight: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  executionModeButtonSelectedDark: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  executionModeButtonTextLight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#71717a',
    marginBottom: 4,
  },
  executionModeButtonTextDark: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a1a1aa',
    marginBottom: 4,
  },
  executionModeButtonTextSelectedLight: {
    color: '#3b82f6',
  },
  executionModeButtonTextSelectedDark: {
    color: '#60a5fa',
  },
  executionModeDescriptionLight: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  executionModeDescriptionDark: {
    fontSize: 13,
    color: '#71717a',
  },
  stepsContainer: {
    marginBottom: 16,
  },
  stepsHelperText: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  stepsHelperTextContent: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  stepRowDragging: {
    opacity: 0.8,
    zIndex: 1000,
  },
  dragHandleLight: {
    width: 28,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f4f5',
    borderRadius: 6,
  },
  dragHandleDark: {
    width: 28,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272a',
    borderRadius: 6,
  },
  dragHandleIcon: {
    fontSize: 18,
    fontWeight: '300',
    color: '#9ca3af',
    letterSpacing: -2,
  },
  stepNumberLight: {
    width: 28,
    fontSize: 12,
    color: '#a1a1aa',
    textAlign: 'right',
  },
  stepNumberDark: {
    width: 28,
    fontSize: 12,
    color: '#71717a',
    textAlign: 'right',
  },
  stepInputLight: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#18181b',
  },
  stepInputDark: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fafafa',
  },
  reorderControls: {
    flexDirection: 'column',
    gap: 2,
  },
  reorderButton: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  reorderButtonLight: {
    backgroundColor: '#f4f4f5',
  },
  reorderButtonDark: {
    backgroundColor: '#27272a',
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  reorderButtonTextLight: {
    fontSize: 14,
    color: '#71717a',
  },
  reorderButtonTextDark: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  removeButtonTextLight: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  removeButtonTextDark: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  addStepButton: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addStepButtonTextLight: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  addStepButtonTextDark: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  footerContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  footerBorderLight: {
    borderTopColor: '#e4e4e7',
  },
  footerBorderDark: {
    borderTopColor: '#27272a',
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
  },
  saveButtonActiveLight: {
    backgroundColor: '#2563eb',
  },
  saveButtonActiveDark: {
    backgroundColor: '#2563eb',
  },
  saveButtonInactive: {
    backgroundColor: '#e4e4e7',
  },
  saveButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButtonTextActiveLight: {
    color: '#ffffff',
  },
  saveButtonTextActiveDark: {
    color: '#ffffff',
  },
  saveButtonTextInactiveLight: {
    color: '#a1a1aa',
  },
  saveButtonTextInactiveDark: {
    color: '#71717a',
  },
});
