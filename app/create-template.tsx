// app/create-template.tsx
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
} from 'react-native';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';

export default function CreateTemplate() {
  const { saveCustomTemplate } = useFlightManual();

  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [stepTexts, setStepTexts] = useState<string[]>(['']);

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

  const handleSave = () => {
    const trimmedName = name.trim();
    const filledSteps = stepTexts.map((s) => s.trim()).filter((s) => s.length > 0);
    if (!trimmedName || filledSteps.length === 0) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    saveCustomTemplate(trimmedName, tags, filledSteps);

    // Reset form
    setName('');
    setTagsInput('');
    setStepTexts(['']);

    router.back();
  };

  const canSave = name.trim().length > 0 && stepTexts.some((s) => s.trim().length > 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.headerTitle}>New Template</Text>

        {/* Template name */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Template Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Grocery Packing"
            placeholderTextColor="#6b7280"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Tags */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Tags (comma-separated)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. errands, weekly"
            placeholderTextColor="#6b7280"
            value={tagsInput}
            onChangeText={setTagsInput}
          />
        </View>

        {/* Step builder */}
        <View style={styles.stepsContainer}>
          <Text style={styles.fieldLabel}>Steps</Text>
          {stepTexts.map((text, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{i + 1}.</Text>
              <TextInput
                style={styles.stepInput}
                placeholder={`Step ${i + 1}`}
                placeholderTextColor="#6b7280"
                value={text}
                onChangeText={(t) => updateStep(i, t)}
              />
              {stepTexts.length > 1 && (
                <Pressable onPress={() => removeStep(i)} style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              )}
            </View>
          ))}

          {/* Add step button */}
          <Pressable onPress={addStep} style={styles.addStepButton}>
            <Text style={styles.addStepButtonText}>+ Add Step</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Save button */}
      <View style={styles.footerContainer}>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[
            styles.saveButton,
            canSave ? styles.saveButtonActive : styles.saveButtonInactive,
          ]}
        >
          <Text
            style={[
              styles.saveButtonText,
              canSave ? styles.saveButtonTextActive : styles.saveButtonTextInactive,
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
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
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
  stepNumber: {
    width: 24,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
  },
  stepInput: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  removeButtonText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  addStepButton: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
    backgroundColor: '#111827',
    paddingVertical: 12,
    alignItems: 'center',
  },
  addStepButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  footerContainer: {
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
  },
  saveButtonActive: {
    backgroundColor: '#2563eb',
  },
  saveButtonInactive: {
    backgroundColor: '#1f2937',
  },
  saveButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButtonTextActive: {
    color: '#ffffff',
  },
  saveButtonTextInactive: {
    color: '#4b5563',
  },
});
