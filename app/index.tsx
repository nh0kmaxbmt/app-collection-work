// app/index.tsx
import { useState, useRef } from 'react';
import { View, TextInput, FlatList, Pressable, Text, StyleSheet } from 'react-native';
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
    <View style={styles.container}>
      {/* Search input */}
      <View style={styles.searchContainer}>
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search routines..."
          placeholderTextColor="#6b7280"
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="done"
        />
      </View>

      {/* Template list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: Template }) => (
          <Pressable
            onPress={() => handleSelect(item.id)}
            style={({ pressed }) => [
              styles.templateItem,
              pressed ? styles.templateItemPressed : null,
            ]}
          >
            <Text style={styles.templateName}>{item.name}</Text>
            <View style={styles.tagsContainer}>
              {item.tags.map((tag) => (
                <Text key={tag} style={styles.tagText}>
                  #{tag}
                </Text>
              ))}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !state.isLoading ? (
            <Text style={styles.emptyText}>No routines found</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  searchContainer: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    fontSize: 18,
    color: '#ffffff',
  },
  templateItem: {
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  templateItemPressed: {
    backgroundColor: '#1f2937',
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  tagsContainer: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyText: {
    marginTop: 32,
    textAlign: 'center',
    color: '#4b5563',
  },
});
