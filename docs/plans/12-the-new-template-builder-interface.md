# 12 — The New Template Builder Interface

## Source
`docs/gemini-archive/component/gemini-12-The New Template Builder Interface.txt`
Design context: `docs/gemini-archive/manual/gemini_manual-03-app-data-insert.md` Part 1 (Template Architect)

## Feature Description
A new creation screen that lets users build custom templates directly in the app. Provides inputs for template name, tags, and a dynamic step builder with add/remove capabilities. Eliminates the need for hardcoded templates only.

## Requirements
1. Clean form with text inputs for **Template Name** and **comma-separated Tags**
2. Dynamic step builder state array — render an unordered list of current steps with a text input for each
3. **[+ Add Step]** button that appends a blank entry to the inputs array
4. **Save button** — validates inputs are non-empty, calls `saveCustomTemplate(name, tags, steps)`, clears form, navigates back via `router.back()`
5. Minimalist dark layout matching a developer-tool utility aesthetic

## Adaptation Notes (Expo / React Native)
- New route: `app/create-template.tsx` (expo-router file-based)
- Use `TextInput` for all inputs, `ScrollView` for the step list
- NativeWind `className` for dark theme styling
- Keyboard-aware: wrap in `KeyboardAvoidingView` or use `react-native-keyboard-aware-scroll-view` if available
- Home dashboard (`app/index.tsx`) needs a FAB or button that routes to this screen via `router.push('/create-template')`

---

## Sample Code: `app/create-template.tsx`

```tsx
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
      className="flex-1 bg-gray-950"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1 px-4 pt-6" keyboardShouldPersistTaps="handled">
        {/* Header */}
        <Text className="mb-6 text-2xl font-bold text-white">New Template</Text>

        {/* Template name */}
        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-400">Template Name</Text>
          <TextInput
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
            placeholder="e.g. Grocery Packing"
            placeholderTextColor="#6b7280"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Tags */}
        <View className="mb-6">
          <Text className="mb-2 text-sm font-medium text-gray-400">Tags (comma-separated)</Text>
          <TextInput
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
            placeholder="e.g. errands, weekly"
            placeholderTextColor="#6b7280"
            value={tagsInput}
            onChangeText={setTagsInput}
          />
        </View>

        {/* Step builder */}
        <View className="mb-4">
          <Text className="mb-3 text-sm font-medium text-gray-400">Steps</Text>
          {stepTexts.map((text, i) => (
            <View key={i} className="mb-2 flex-row items-center gap-2">
              <Text className="w-6 text-right text-xs text-gray-600">{i + 1}.</Text>
              <TextInput
                className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-3 text-white"
                placeholder={`Step ${i + 1}`}
                placeholderTextColor="#6b7280"
                value={text}
                onChangeText={(t) => updateStep(i, t)}
              />
              {stepTexts.length > 1 && (
                <Pressable onPress={() => removeStep(i)} className="px-2 py-3">
                  <Text className="text-sm text-red-500">Remove</Text>
                </Pressable>
              )}
            </View>
          ))}

          {/* Add step button */}
          <Pressable
            onPress={addStep}
            className="mt-2 items-center rounded-lg border border-dashed border-gray-700 py-3"
          >
            <Text className="text-sm font-semibold text-gray-500">+ Add Step</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Save button */}
      <View className="border-t border-gray-800 px-4 pb-8 pt-4">
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className={`rounded-xl py-4 ${
            canSave ? 'bg-blue-600 active:bg-blue-700' : 'bg-gray-800'
          }`}
        >
          <Text
            className={`text-center text-base font-bold ${
              canSave ? 'text-white' : 'text-gray-600'
            }`}
          >
            Save Template
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
```

## Integration Note for `app/index.tsx`

The home dashboard needs a floating action button (FAB) to navigate to this screen. Add to `app/index.tsx`:

```tsx
// Add a FAB at the bottom-right of the search dashboard
<Pressable
  onPress={() => router.push('/create-template')}
  className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-lg active:bg-blue-700"
>
  <Text className="text-2xl font-light text-white">+</Text>
</Pressable>
```
