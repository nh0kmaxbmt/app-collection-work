# 04 — UI: Command Palette

## Source
`docs/gemini-archive/gemini-04-UI Command Palette.txt`

## Feature Description
The main landing view of the app. A search-first interface that displays template suggestions, filtered by user input, sorted by the time-weighted engine when no search query is active.

## Requirements
- Full-width search input with autofocus on mount
- Template list filtered by search text (name and tags)
- When input is empty, templates are sorted by `getWeightedTemplates()`
- Clean, minimalist design inspired by Spotlight / Raycast
- Selecting a template triggers `startRun(templateId)`

## Adaptation Notes (Expo / React Native)
- **Routing:** Use `expo-router` — this screen is likely `app/(tabs)/index.tsx` or `app/index.tsx`
- **Styling:** NativeWind (`className`) instead of web Tailwind utility classes
- **List:** Use `FlatList` from React Native for performance with template lists
- **Input:** Use RN `TextInput` with `autoFocus` prop
- **Navigation:** Use `router.push('/flight-deck')` after starting a run
- **Keyboard:** Mobile keyboard considerations — no keyboard shortcuts needed (unlike desktop Spotlight)

---

## Sample Code: `app/index.tsx`

```tsx
// app/index.tsx
import { useState, useRef } from 'react';
import { View, TextInput, FlatList, Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../src/core/store';
import { getWeightedTemplates } from '../src/core/engine';
import type { Template } from '../src/core/types';

export default function CommandPalette() {
  const { state, startRun } = useStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  const weighted = getWeightedTemplates(state.templates, state.historyLogs);

  const filtered = query
    ? state.templates.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())),
      )
    : weighted;

  const handleSelect = (templateId: string) => {
    startRun(templateId);
    router.push('/flight-deck');
  };

  return (
    <View className="flex-1 bg-gray-950 px-4 pt-12">
      {/* Search input */}
      <View className="mb-4 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
        <TextInput
          ref={inputRef}
          className="text-lg text-white placeholder:text-gray-500"
          placeholder="Search routines..."
          placeholderTextColor="#6b7280"
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="done"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Template list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: Template }) => (
          <Pressable
            onPress={() => handleSelect(item.id)}
            className="mb-2 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 active:bg-gray-800"
          >
            <Text className="text-base font-semibold text-white">{item.name}</Text>
            <View className="mt-1 flex-row gap-2">
              {item.tags.map((tag) => (
                <Text key={tag} className="text-xs text-gray-500">
                  #{tag}
                </Text>
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
