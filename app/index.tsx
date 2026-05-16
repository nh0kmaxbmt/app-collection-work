// app/index.tsx — V6.4 Adaptive Theme Dashboard (Native Header & Reactive Sorting)
import { useState, useMemo } from 'react';
import { Stack } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import type { Collection, Template } from '../src/core/types';

type SortMode = 'recent' | 'used';

export default function Dashboard() {
  const { state, compileAndStartRun, deleteTemplate, deleteCollection } = useFlightManual();
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');

  // Detect system color scheme for adaptive theming
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Reactive sorting with useMemo - re-evaluates when sortMode or dependencies change
  const sortedCollections = useMemo(() => {
    let items = [...state.collections];

    // Apply search filter
    if (search) {
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      );
    }

    // Sort based on current mode
    if (sortMode === 'recent') {
      // Sort by most recently used (based on historyLogs timestamps)
      const lastUsedMap = new Map<string, number>();
      for (const log of state.historyLogs) {
        const existing = lastUsedMap.get(log.collectionId);
        if (!existing || log.timestamp > existing) {
          lastUsedMap.set(log.collectionId, log.timestamp);
        }
      }
      items.sort((a, b) => {
        const aTime = lastUsedMap.get(a.id) ?? 0;
        const bTime = lastUsedMap.get(b.id) ?? 0;
        return bTime - aTime;
      });
    } else if (sortMode === 'used') {
      // Sort by usage frequency (count of historyLogs entries)
      const counts = new Map<string, number>();
      for (const log of state.historyLogs) {
        counts.set(log.collectionId, (counts.get(log.collectionId) ?? 0) + 1);
      }
      items.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
    }

    return items;
  }, [state.collections, state.historyLogs, search, sortMode]);

  const sortedTemplates = useMemo(() => {
    let items = [...state.templates];
    if (search) {
      items = items.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()),
      );
    }
    return items;
  }, [state.templates, search]);

  const handleLaunchCollection = (id: string) => {
    compileAndStartRun(id, false);
    router.push('/flight-deck' as any);
  };

  const handleLaunchTemplate = (id: string) => {
    compileAndStartRun(id, true);
    router.push('/flight-deck' as any);
  };

  const handleDeleteTemplate = (template: Template) => {
    Alert.alert(
      'Delete Routine',
      `Are you sure you want to delete "${template.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTemplate(template.id),
        },
      ],
    );
  };

  const handleDeleteCollection = (collection: Collection) => {
    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${collection.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCollection(collection.id),
        },
      ],
    );
  };

  // Animated slider position - proper 50/50 split alignment
  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(sortMode === 'recent' ? 0 : 1, { duration: 250 }) }],
  }));

  // Adaptive color styles based on current theme mode
  const adaptiveStyles = {
    container: isDark ? styles.containerDark : styles.containerLight,
    searchInputWrapper: isDark ? styles.searchInputWrapperDark : styles.searchInputWrapperLight,
    searchInput: isDark ? styles.searchInputDark : styles.searchInputLight,
    searchPlaceholder: isDark ? '#6b7280' : '#9ca3af',
    toggleBackground: isDark ? styles.toggleBackgroundDark : styles.toggleBackgroundLight,
    toggleButtonText: isDark ? styles.toggleButtonTextDark : styles.toggleButtonTextLight,
    toggleButtonTextInactive: isDark ? styles.toggleButtonTextInactiveDark : styles.toggleButtonTextInactiveLight,
    sectionTitle: isDark ? styles.sectionTitleDark : styles.sectionTitleLight,
    rowCard: isDark ? styles.rowCardDark : styles.rowCardLight,
    cardTitle: isDark ? styles.cardTitleDark : styles.cardTitleLight,
    cardMetadata: isDark ? styles.cardMetadataDark : styles.cardMetadataLight,
    hintText: isDark ? styles.hintTextDark : styles.hintTextLight,
  };

  // Helper to format card metadata line
  const formatMetadataLine = (description: string | undefined, tags: string[]): string => {
    const desc = description || '';
    const tagsStr = tags.map((t) => `#${t}`).join(' ');
    if (desc && tagsStr) {
      return `${desc} — ${tagsStr}`;
    }
    return desc || tagsStr;
  };

  // Helper to get execution mode display label
  const getExecutionModeLabel = (mode: 'linear' | 'parallel'): string => {
    return mode === 'linear' ? 'Sequential' : 'Flexible';
  };

  return (
    <>
      {/* Native Expo Router Header */}
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'FlightManual',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: isDark ? '#09090b' : '#fafafa',
          },
          headerTitleStyle: {
            color: isDark ? '#f4f4f5' : '#09090b',
            fontWeight: 'bold',
          },
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings' as any)} style={styles.settingsButton}>
              <Text style={styles.settingsIcon}>⚙️</Text>
            </Pressable>
          ),
        }}
      />

      <View style={adaptiveStyles.container}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={adaptiveStyles.searchInputWrapper}>
            <TextInput
              style={adaptiveStyles.searchInput}
              placeholderTextColor={adaptiveStyles.searchPlaceholder}
              placeholder="Search collections and routines..."
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
        </View>

        {/* Sliding sort toggle - Fixed equal 50/50 split with proper sync */}
        <View style={styles.toggleContainer}>
          <View style={adaptiveStyles.toggleBackground}>
            {/* Animated background slider - exactly 50% width */}
            <Animated.View
              style={[
                styles.sliderIndicator,
                sliderStyle,
              ]}
            />
            <View style={styles.toggleButtonsRow}>
              <Pressable
                onPress={() => setSortMode('recent')}
                style={styles.toggleButton}
              >
                <Text style={[
                  adaptiveStyles.toggleButtonText,
                  sortMode !== 'recent' ? adaptiveStyles.toggleButtonTextInactive : null
                ]}>
                  Most Recent
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSortMode('used')}
                style={styles.toggleButton}
              >
                <Text style={[
                  adaptiveStyles.toggleButtonText,
                  sortMode !== 'used' ? adaptiveStyles.toggleButtonTextInactive : null
                ]}>
                  Most Used
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Templates (compound combos) */}
          {sortedTemplates.length > 0 && (
            <View style={styles.section}>
              <Text style={adaptiveStyles.sectionTitle}>Saved Routines</Text>
              {sortedTemplates.map((tpl) => (
                <Pressable
                  key={tpl.id}
                  onPress={() => handleLaunchTemplate(tpl.id)}
                  onLongPress={() => handleDeleteTemplate(tpl)}
                  style={({ pressed }) => [
                    adaptiveStyles.rowCard,
                    pressed && styles.rowCardPressed,
                  ]}
                >
                  <View style={styles.cardContent}>
                    {/* Line 1: Title with collection count */}
                    <Text style={adaptiveStyles.cardTitle}>
                      {tpl.title} ({tpl.templateIds.length} collection{tpl.templateIds.length !== 1 ? 's' : ''})
                    </Text>
                    {/* Line 2: Description only (templates don't have tags) */}
                    {tpl.description && (
                      <Text style={adaptiveStyles.cardMetadata}>
                        {tpl.description}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Collections (standalone lists) */}
          <View style={styles.section}>
            <Text style={adaptiveStyles.sectionTitle}>Collections</Text>
            {sortedCollections.map((col) => (
              <Pressable
                key={col.id}
                onPress={() => handleLaunchCollection(col.id)}
                onLongPress={() => handleDeleteCollection(col)}
                style={({ pressed }) => [
                  adaptiveStyles.rowCard,
                  pressed && styles.rowCardPressed,
                ]}
              >
                <View style={styles.cardContent}>
                  {/* Line 1: Name with step count and execution mode */}
                  <Text style={adaptiveStyles.cardTitle}>
                    {col.name} ({col.steps.length} steps) · {getExecutionModeLabel(col.executionMode)}
                  </Text>
                  {/* Line 2: Description with tags */}
                  {(col.description || col.tags.length > 0) && (
                    <Text style={adaptiveStyles.cardMetadata}>
                      {formatMetadataLine(col.description, col.tags)}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* FAB for new collection */}
        <Pressable
          onPress={() => router.push('/create-template' as any)}
          style={styles.fab}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        {/* Hint text */}
        <View style={styles.hintContainer}>
          <Text style={adaptiveStyles.hintText}>Tap to launch • Long press to delete</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Native header is configured via Stack.Screen options above

  // Settings button in header
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  settingsIcon: {
    fontSize: 18,
  },

  // Container - Adaptive light/dark
  containerLight: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  containerDark: {
    flex: 1,
    backgroundColor: '#09090b',
  },

  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  searchInputWrapperLight: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputWrapperDark: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputLight: {
    fontSize: 16,
    color: '#18181b',
  },
  searchInputDark: {
    fontSize: 16,
    color: '#fafafa',
  },

  toggleContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  toggleBackgroundLight: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#e4e4e7',
    padding: 4,
    position: 'relative',
  },
  toggleBackgroundDark: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#27272a',
    padding: 4,
    position: 'relative',
  },
  toggleButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    zIndex: 1,
  },
  sliderIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: '50%',
    height: 36,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  toggleButton: {
    flex: 1,
    width: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  toggleButtonTextLight: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  toggleButtonTextDark: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fafafa',
  },
  toggleButtonTextInactiveLight: {
    color: '#a1a1aa',
  },
  toggleButtonTextInactiveDark: {
    color: '#71717a',
  },

  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitleLight: {
    marginBottom: 12,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#3b82f6',
  },
  sectionTitleDark: {
    marginBottom: 12,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#818cf8',
  },

  // Row cards - Adaptive light/dark with shadow
  // Matches: bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl mb-3 shadow-sm
  rowCardLight: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rowCardDark: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  rowCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardContent: {
    flex: 1,
  },

  // Card title - text-base font-bold text-zinc-900 dark:text-zinc-100
  cardTitleLight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18181b',
    marginBottom: 4,
  },
  cardTitleDark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fafafa',
    marginBottom: 4,
  },

  // Card metadata - text-sm text-zinc-500 dark:text-zinc-400 mt-1
  cardMetadataLight: {
    fontSize: 14,
    color: '#71717a',
    marginTop: 4,
  },
  cardMetadataDark: {
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 4,
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#ffffff',
    lineHeight: 36,
  },

  hintContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 88,
  },
  hintTextLight: {
    fontSize: 11,
    color: '#a1a1aa',
    textAlign: 'center',
  },
  hintTextDark: {
    fontSize: 11,
    color: '#52525b',
    textAlign: 'center',
  },
});
