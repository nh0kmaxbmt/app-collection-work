// app/index.tsx — V8.4 Multi-Instance Saved Runs & Action Sheet Menu
import { useState, useMemo } from 'react';
import { Stack } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFlightManual } from '../src/core/store';
import type { Collection, Template, RunInstance } from '../src/core/types';

type SortMode = 'recent' | 'used';
type ActionSheetType = 'collection' | 'template' | null;

interface ActionSheetState {
  visible: boolean;
  type: ActionSheetType;
  collection?: Collection;
  template?: Template;
}

export default function Dashboard() {
  const {
    state,
    compileAndStartRun,
    deleteTemplate,
    deleteCollection,
    viewMode,
    resumeSavedRun,
    deleteSavedRun,
    clearAllSavedRuns,
    getSavedRunExpiryHours,
  } = useFlightManual();
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');
  const [actionSheet, setActionSheet] = useState<ActionSheetState>({
    visible: false,
    type: null,
  });

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

  // Filter saved runs to only show non-expired ones
  const validSavedRuns = useMemo(() => {
    const now = Date.now();
    return state.savedRuns.filter(run => run.expiresAt && run.expiresAt > now);
  }, [state.savedRuns]);

  const handleLaunchCollection = (id: string) => {
    compileAndStartRun(id, false);
    router.push('/flight-deck' as any);
  };

  const handleLaunchTemplate = (id: string) => {
    compileAndStartRun(id, true);
    router.push('/flight-deck' as any);
  };

  const handleResumeRun = (runId: string) => {
    resumeSavedRun(runId);
    router.push('/flight-deck' as any);
  };

  const handleDeleteSavedRun = (run: RunInstance) => {
    Alert.alert(
      'Delete Saved Run',
      `Are you sure you want to delete "${run.customName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSavedRun(run.id),
        },
      ],
    );
  };

  const handleClearAllSavedRuns = () => {
    Alert.alert(
      'Clear All Saved Runs',
      `Are you sure you want to delete all ${validSavedRuns.length} saved run${validSavedRuns.length !== 1 ? 's' : ''}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => clearAllSavedRuns(),
        },
      ],
    );
  };

  const showCollectionActionSheet = (collection: Collection) => {
    setActionSheet({
      visible: true,
      type: 'collection',
      collection,
    });
  };

  const showTemplateActionSheet = (template: Template) => {
    setActionSheet({
      visible: true,
      type: 'template',
      template,
    });
  };

  const handleActionSheetEdit = () => {
    if (actionSheet.type === 'collection' && actionSheet.collection) {
      setActionSheet({ visible: false, type: null });
      router.push({
        pathname: '/create-collection',
        params: { id: actionSheet.collection.id },
      } as any);
    }
  };

  const handleActionSheetDelete = () => {
    if (actionSheet.type === 'collection' && actionSheet.collection) {
      setActionSheet({ visible: false, type: null });
      Alert.alert(
        'Delete Collection',
        `Are you sure you want to delete "${actionSheet.collection.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteCollection(actionSheet.collection!.id),
          },
        ],
      );
    } else if (actionSheet.type === 'template' && actionSheet.template) {
      setActionSheet({ visible: false, type: null });
      Alert.alert(
        'Delete Routine',
        `Are you sure you want to delete "${actionSheet.template.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteTemplate(actionSheet.template!.id),
          },
        ],
      );
    }
  };

  const closeActionSheet = () => {
    setActionSheet({ visible: false, type: null });
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
          onLongPress={() => showCollectionActionSheet(col)}
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
              onLongPress={() => showTemplateActionSheet(tpl)}
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
            onLongPress={() => showCollectionActionSheet(col)}
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
          {/* Multi-Banner: Saved Runs Horizontal Scroll */}
          {validSavedRuns.length > 0 && (
            <View style={styles.savedRunsSection}>
              <View style={styles.savedRunsHeader}>
                <Text style={styles.savedRunsTitle}>⏸ Saved Runs</Text>
                <Pressable onPress={handleClearAllSavedRuns} style={styles.clearAllButton}>
                  <Text style={styles.clearAllButtonText}>Clear All</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.savedRunsScrollContent}
              >
                {validSavedRuns.map((run) => {
                  const remainingHours = getSavedRunExpiryHours(run.id);
                  const completedCount = run.currentSteps.filter(s => s.isCompleted).length;
                  const totalCount = run.currentSteps.length;

                  return (
                    <View key={run.id} style={styles.savedRunCard}>
                      <View style={styles.savedRunCardHeader}>
                        <Text style={styles.savedRunName} numberOfLines={1}>
                          {run.customName}
                        </Text>
                        <Pressable
                          onPress={() => handleDeleteSavedRun(run)}
                          style={styles.savedRunDeleteButton}
                        >
                          <Text style={styles.savedRunDeleteButtonText}>✕</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.savedRunProgress}>
                        {completedCount}/{totalCount} steps
                      </Text>
                      <Text style={styles.savedRunExpiry}>
                        Expires in {remainingHours}h
                      </Text>
                      <Pressable
                        onPress={() => handleResumeRun(run.id)}
                        style={styles.savedRunResumeButton}
                      >
                        <Text style={styles.savedRunResumeButtonText}>Resume</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

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
          <Text style={styles.hintText}>Tap to launch · Long press for options</Text>
        </View>
      </View>

      {/* Action Sheet Modal */}
      <Modal
        visible={actionSheet.visible}
        transparent
        animationType="slide"
        onRequestClose={closeActionSheet}
      >
        <Pressable style={styles.actionSheetOverlay} onPress={closeActionSheet}>
          <View style={styles.actionSheetContent} onStartShouldSetResponder={() => true}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>
              {actionSheet.type === 'collection' ? actionSheet.collection?.name : actionSheet.template?.title}
            </Text>

            <Pressable onPress={handleActionSheetEdit} style={styles.actionSheetButton}>
              <Text style={styles.actionSheetButtonIcon}>✏️</Text>
              <Text style={styles.actionSheetButtonText}>
                {actionSheet.type === 'collection' ? 'Edit Collection' : 'View Routine Details'}
              </Text>
            </Pressable>

            <Pressable onPress={handleActionSheetDelete} style={styles.actionSheetButtonDestructive}>
              <Text style={styles.actionSheetButtonIcon}>🗑️</Text>
              <Text style={styles.actionSheetButtonTextDestructive}>Delete</Text>
            </Pressable>

            <Pressable onPress={closeActionSheet} style={styles.actionSheetCancelButton}>
              <Text style={styles.actionSheetCancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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

    // Saved runs section styles
    savedRunsSection: {
      marginBottom: 16,
    },
    savedRunsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    savedRunsTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#f59e0b' : '#d97706',
    },
    clearAllButton: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
    },
    clearAllButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#f87171' : '#dc2626',
    },
    savedRunsScrollContent: {
      paddingHorizontal: 16,
      gap: 12,
    },
    savedRunCard: {
      width: 160,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)',
      padding: 12,
    },
    savedRunCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    savedRunName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#fcd34d' : '#d97706',
    },
    savedRunDeleteButton: {
      padding: 4,
    },
    savedRunDeleteButtonText: {
      fontSize: 16,
      color: isDark ? '#f87171' : '#dc2626',
    },
    savedRunProgress: {
      fontSize: 13,
      color: isDark ? '#fbbf24' : '#f59e0b',
      marginBottom: 2,
    },
    savedRunExpiry: {
      fontSize: 12,
      color: isDark ? '#fbbf24' : '#f59e0b',
      opacity: 0.8,
      marginBottom: 8,
    },
    savedRunResumeButton: {
      backgroundColor: isDark ? '#f59e0b' : '#fbbf24',
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: 'center',
    },
    savedRunResumeButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#ffffff',
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

    // Cloud container
    cloudContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      padding: 16,
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

    // Action Sheet styles
    actionSheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    actionSheetContent: {
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 32,
      paddingTop: 12,
    },
    actionSheetHandle: {
      width: 36,
      height: 4,
      backgroundColor: isDark ? '#3f3f46' : '#d4d4d8',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    actionSheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#fafafa' : '#18181b',
      marginBottom: 8,
      textAlign: 'center',
    },
    actionSheetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#27272a' : '#e4e4e7',
    },
    actionSheetButtonIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    actionSheetButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#fafafa' : '#18181b',
    },
    actionSheetButtonDestructive: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      marginTop: 8,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    actionSheetButtonTextDestructive: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ef4444',
      marginLeft: 12,
    },
    actionSheetCancelButton: {
      marginTop: 12,
      paddingVertical: 14,
      backgroundColor: isDark ? '#27272a' : '#f4f4f5',
      borderRadius: 12,
      alignItems: 'center',
    },
    actionSheetCancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#a1a1aa' : '#71717a',
    },
  });
}
