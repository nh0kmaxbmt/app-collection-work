// app/create-template.tsx — V6.2 Collection Creator (Renamed Execution Modes)
import { useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import type { ExecutionMode } from '../src/core/types';

export default function CreateCollection() {
  const { saveCustomCollection } = useFlightManual();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [stepTexts, setStepTexts] = useState<string[]>(['']);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('linear');

  // Detect color scheme for adaptive theming
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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

  const handleSave = async () => {
    const trimmedName = name.trim();
    const filledSteps = stepTexts.map((s) => s.trim()).filter((s) => s.length > 0);
    if (!trimmedName || filledSteps.length === 0) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    // Save with execution mode
    await saveCustomCollection(trimmedName, description.trim(), tags, filledSteps, executionMode);

    // Reset form
    setName('');
    setDescription('');
    setTagsInput('');
    setStepTexts(['']);
    setExecutionMode('linear');

    router.back();
  };

  const canSave = name.trim().length > 0 && stepTexts.some((s) => s.trim().length > 0);

  // Adaptive styles
  const adaptiveStyles = {
    container: isDark ? styles.containerDark : styles.containerLight,
    headerTitle: isDark ? styles.headerTitleDark : styles.headerTitleLight,
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
    addStepButtonText: isDark ? styles.addStepButtonTextDark : styles.addStepButtonTextLight,
    saveButtonActive: isDark ? styles.saveButtonActiveDark : styles.saveButtonActiveLight,
    saveButtonTextActive: isDark ? styles.saveButtonTextActiveDark : styles.saveButtonTextActiveLight,
    saveButtonTextInactive: isDark ? styles.saveButtonTextInactiveDark : styles.saveButtonTextInactiveLight,
    footerBorder: isDark ? styles.footerBorderDark : styles.footerBorderLight,
  };

  return (
    <KeyboardAvoidingView
      style={adaptiveStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={adaptiveStyles.headerTitle}>New Template</Text>

        {/* Template name (REQUIRED) */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Text style={adaptiveStyles.fieldLabel}>Template Name</Text>
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
            placeholder="Brief description of this template"
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

        {/* Execution Mode Selector - Updated Labels: Sequential/Flexible */}
        <View style={styles.fieldContainer}>
          <Text style={adaptiveStyles.fieldLabel}>Execution Mode</Text>
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
          {stepTexts.map((text, i) => (
            <View key={i} style={styles.stepRow}>
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
                  <Text style={adaptiveStyles.removeButtonText}>Remove</Text>
                </Pressable>
              )}
            </View>
          ))}

          <Pressable onPress={addStep} style={styles.addStepButton}>
            <Text style={adaptiveStyles.addStepButtonText}>+ Add Step</Text>
          </Pressable>
        </View>
      </ScrollView>

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
            Save Template
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
  headerTitleLight: {
    fontSize: 24,
    fontWeight: '700',
    color: '#18181b',
    marginBottom: 24,
  },
  headerTitleDark: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fafafa',
    marginBottom: 24,
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
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  stepNumberLight: {
    width: 24,
    fontSize: 12,
    color: '#a1a1aa',
    textAlign: 'right',
  },
  stepNumberDark: {
    width: 24,
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
