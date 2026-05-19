// app/index.tsx — V8.2 Dashboard with Enhanced Cloud View
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import type { Collection, Template } from '../src/core/types';

type SortMode = 'recent' | 'used';

export default function Dashboard() {
  const { state, compileAndStartRun, deleteTemplate, deleteCollection, viewMode } = useFlightManual();
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');

  // Detect system color scheme for adaptive theming
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Get safe area insets for proper positioning
  const insets = useSafeAreaInsets();

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

  // Q: What is passed to flight-deck? Do we have the name of the collection?
  // A: In the current code, `handleLaunchCollection` does not pass any parameters to the `/flight-deck` route; it just pushes the route as a string.
  // The name of the collection is not passed via navigation params. 
  // The routine actually starts in the store (`compileAndStartRun(id, false)`), and the flight-deck gets the currently active run from state.
  // Therefore, the collection name is available inside 'flight-deck' by looking at the run's steps or collection metadata in the store, 
  // but it is NOT passed as a prop or navigation param.

  const handleLaunchCollection = (id: string) => {
    compileAndStartRun(id, false); // This sets the active run in the store
    // No parameters are passed here; flight-deck will query store for active run
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

  // Helper to format card metadata line
  const formatMetadataLine = (description: string | undefined, tags: string[]): string => {
    const desc = description || '';
    const tagsStr = tags.map((t) => `#${t}`).join(' ');
    if (desc && tagsStr) {
      return `${desc} — ${tagsStr}`;
    }
    return desc || tagsStr;
  };

  // Calculate scroll content container style with proper safe area padding
  const scrollContentContainerStyle = {
    paddingBottom: insets.bottom + 120,
    paddingHorizontal: 12,
    paddingTop: 8,
  };

  // Cloud view scroll content style
  const cloudScrollContentStyle = {
    paddingBottom: insets.bottom + 120,
    paddingHorizontal: 16,
    paddingTop: 16,
  };

  // Helper text container style with safe area padding - positioned absolutely above nav bar
  const helperTextStyle = {
    position: 'absolute' as const,
    bottom: insets.bottom + 12,
    left: 0,
    right: 0,
    alignItems: 'center' as const,
  };

  // Adaptive styles object
  const styles = getStyles(isDark);

  // Render cloud tag mode - Enhanced with gorgeous capsule cards
  // WordPress-style tag cloud: uniform size/color in pill box with background color for each tag
  const renderCloudMode = () => (
    <View
      style={[
        styles.cloudContainer,
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'center',
          alignItems: 'flex-end',
        },
      ]}
    >
      {sortedCollections.map((col) => (
        <Pressable
          key={col.id}
          onPress={() => handleLaunchCollection(col.id)}
          onLongPress={() => handleDeleteCollection(col)}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              margin: 4,
              backgroundColor: isDark
                ? 'rgba(39,41,54,0.87)'
                : 'rgba(224,242,254,1)',
              borderRadius: 9999,
              paddingHorizontal: 18,
              paddingVertical: 8,
              minHeight: 36,
              shadowColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.07)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.10,
              shadowRadius: 6,
              elevation: 2,
              borderWidth: pressed ? 2 : 0,
              borderColor: pressed ? '#2563eb' : 'transparent',
            },
          ]}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: isDark ? '#e0edfa' : '#1e293b',
              letterSpacing: 0.1,
            }}
          >
            {col.name}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: isDark ? '#60a5fa' : '#2563eb',
              marginLeft: 8,
            }}
          >
            ({col.steps.length})
          </Text>
        </Pressable>
      ))}
    </View>
  );

  // Render list mode
  const renderListMode = () => (
    <>
      {/* Templates Section */}
      {sortedTemplates.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Routines</Text>
          {sortedTemplates.map((tpl) => (
            <Pressable
              key={tpl.id}
              onPress={() => handleLaunchTemplate(tpl.id)}
              onLongPress={() => handleDeleteTemplate(tpl)}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <Text style={styles.cardTitle}>
                {tpl.title} ({tpl.templateIds.length} collection{tpl.templateIds.length !== 1 ? 's' : ''})
              </Text>
              {tpl.description && (
                <Text style={styles.cardMetadata}>
                  {tpl.description}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Collections Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Collections</Text>
        {sortedCollections.map((col) => (
          <Pressable
            key={col.id}
            onPress={() => handleLaunchCollection(col.id)}
            onLongPress={() => handleDeleteCollection(col)}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.cardTitle}>
              {col.name} ({col.steps.length} steps)
            </Text>
            {(col.description || col.tags.length > 0) && (
              <Text style={styles.cardMetadata}>
                {formatMetadataLine(col.description, col.tags)}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
    </>
  );

  return (
    <>
      {/* Native Expo Router Header with Settings Button */}
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'FlyManual',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: isDark ? '#09090b' : '#ffffff',
          },
          headerTitleStyle: {
            color: isDark ? '#f4f4f5' : '#09090b',
            fontWeight: 'bold',
            fontSize: 22,
          },
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Settings</Text>
            </Pressable>
          ),
        }}
      />

      {/* Main Container */}
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchInputWrapper}>
            <TextInput
              style={styles.searchInput}
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              placeholder="Search collections and routines..."
              value={search}
              onChangeText={setSearch}
              autoFocus={false}
            />
          </View>
        </View>

        {/* Segment Selector Bar */}
        <View style={styles.segmentWrapper}>
          <View style={styles.segmentBackground}>
            {/* Most Recent Tab */}
            <Pressable
              onPress={() => setSortMode('recent')}
              style={[
                styles.segmentTab,
                sortMode === 'recent' ? styles.segmentTabActive : styles.segmentTabInactive,
              ]}
            >
              <Text
                style={[
                  styles.segmentTabText,
                  sortMode === 'recent' ? styles.segmentTabTextActive : styles.segmentTabTextInactive,
                ]}
              >
                Most Recent
              </Text>
            </Pressable>

            {/* Most Used Tab */}
            <Pressable
              onPress={() => setSortMode('used')}
              style={[
                styles.segmentTab,
                sortMode === 'used' ? styles.segmentTabActive : styles.segmentTabInactive,
              ]}
            >
              <Text
                style={[
                  styles.segmentTabText,
                  sortMode === 'used' ? styles.segmentTabTextActive : styles.segmentTabTextInactive,
                ]}
              >
                Most Used
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={viewMode === 'cloud' ? cloudScrollContentStyle : scrollContentContainerStyle}
          showsVerticalScrollIndicator={false}
        >
          {/* Render based on view mode */}
          {viewMode === 'list' ? renderListMode() : renderCloudMode()}
        </ScrollView>

        {/* FAB */}
        <Pressable
          onPress={() => router.push('/create-collection' as any)}
          style={{ position: 'absolute', bottom: insets.bottom + 20, right: 24 }}
        >
          <View style={styles.fab}>
            <Text style={styles.fabText}>+</Text>
          </View>
        </Pressable>

        {/* Helper Text */}
        <View style={helperTextStyle}>
          <Text style={styles.hintText}>Tap to launch · Long press to delete</Text>
        </View>
      </View>
    </>
  );
}

// Style generator function for adaptive theming
function getStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#09090b' : '#fafafa',
    },

    // Header button styles
    headerButton: {
      marginRight: 16,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: isDark ? '#27272a' : '#f4f4f5',
    },
    headerButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#f4f4f5' : '#09090b',
    },

    // Search styles
    searchWrapper: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
    },
    searchInputWrapper: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#27272a' : '#e4e4e7',
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    searchInput: {
      fontSize: 16,
      color: isDark ? '#fafafa' : '#18181b',
    },

    // Segment selector styles
    segmentWrapper: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    segmentBackground: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#27272a' : '#f4f4f5',
      padding: 4,
      borderRadius: 12,
    },
    segmentTab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentTabActive: {
      backgroundColor: '#2563eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    segmentTabInactive: {
      backgroundColor: 'transparent',
    },
    segmentTabText: {
      fontSize: 14,
      fontWeight: '600',
    },
    segmentTabTextActive: {
      color: '#ffffff',
    },
    segmentTabTextInactive: {
      color: isDark ? '#a1a1aa' : '#71717a',
    },

    // Scroll content
    scrollContent: {
      flex: 1,
    },

    // Section
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      marginBottom: 12,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: isDark ? '#818cf8' : '#3b82f6',
    },

    // Cloud container - flex-row flex-wrap gap-2.5 p-4
    cloudContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      padding: 16,
    },

    // Cloud pill - gorgeous tactile capsule card
    cloudPillLight: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e4e4e7',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    cloudPillDark: {
      backgroundColor: '#18181b',
      borderWidth: 1,
      borderColor: 'rgba(39, 39, 42, 0.8)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 2,
    },
    cloudPill: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
    },
    cloudPillPressed: {
      transform: [{ scale: 0.95 }],
    },
    cloudPillContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    // text-sm font-semibold text-zinc-800 dark:text-zinc-200
    cloudPillNameLight: {
      fontSize: 14,
      fontWeight: '600',
      color: '#27272a',
    },
    cloudPillNameDark: {
      fontSize: 14,
      fontWeight: '600',
      color: '#e4e4e7',
    },
    // text-xs font-bold text-blue-600 dark:text-blue-400 ml-1.5
    cloudPillCountLight: {
      fontSize: 12,
      fontWeight: '700',
      color: '#2563eb',
      marginLeft: 6,
    },
    cloudPillCountDark: {
      fontSize: 12,
      fontWeight: '700',
      color: '#60a5fa',
      marginLeft: 6,
    },

    // Card styles
    card: {
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? '#27272a' : '#e4e4e7',
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.1 : 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    cardPressed: {
      transform: [{ scale: 0.99 }],
    },

    // Card title
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#fafafa' : '#18181b',
      marginBottom: 4,
    },

    // Card metadata
    cardMetadata: {
      fontSize: 14,
      color: isDark ? '#a1a1aa' : '#71717a',
      marginTop: 2,
    },

    // FAB
    fab: {
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

    // Hint text
    hintText: {
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? '#71717a' : '#a1a1aa',
    },
  });
}
