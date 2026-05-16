// app/settings.tsx — V8.2 Native File System Backup/Restore
import { useState } from 'react';
import { Stack } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Appearance,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFlightManual } from '../src/core/store';
import type { DashboardViewMode } from '../src/core/types';

type ThemeMode = 'light' | 'dark' | 'system';

export default function Settings() {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { viewMode, setViewMode, exportData, importData } = useFlightManual();

  const isDark = systemColorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);

    // Apply the theme change
    if (mode === 'light') {
      Appearance.setColorScheme('light');
    } else if (mode === 'dark') {
      Appearance.setColorScheme('dark');
    } else {
      Appearance.setColorScheme(null); // Use system preference
    }
  };

  const handleViewModeChange = (mode: DashboardViewMode) => {
    setViewMode(mode);
  };

  // Export using native file system and share sheet
  const handleExport = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      // Get the JSON data from store
      const jsonData = await exportData();

      // Write to a temporary file in the cache directory
      const fileName = `flymanual_backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, jsonData);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();

      if (!isAvailable) {
        Alert.alert(
          'Sharing Not Available',
          'Your device does not support file sharing. The backup has been saved to the app cache.',
        );
        return;
      }

      // Open the native share sheet
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export FlyManual Backup',
      });

      Alert.alert(
        'Export Successful',
        'Your backup has been shared. Save it to a secure location.',
      );
    } catch (error) {
      console.error('[Settings] Export failed:', error);
      Alert.alert(
        'Export Failed',
        'Could not create or share the backup file. Please try again.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Import using native document picker
  const handleImport = async () => {
    if (isImporting) return;

    try {
      setIsImporting(true);

      // Open the document picker for JSON files
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      // User canceled the picker
      if (result.canceled) {
        setIsImporting(false);
        return;
      }

      // Get the file URI from the picked asset
      const fileUri = result.assets[0].uri;

      // Read the file contents
      const fileContent = await FileSystem.readAsStringAsync(fileUri);

      // Validate and import the data
      const success = await importData(fileContent);

      if (success) {
        Alert.alert(
          'Import Successful',
          'Your collections and templates have been restored from the backup.',
        );
      } else {
        Alert.alert(
          'Import Failed',
          'The backup file is invalid or corrupted. Please ensure it is a valid FlyManual backup JSON file.',
        );
      }
    } catch (error) {
      console.error('[Settings] Import failed:', error);
      Alert.alert(
        'Import Failed',
        'Could not read the selected file. Please ensure it is a valid JSON file.',
      );
    } finally {
      setIsImporting(false);
    }
  };

  const styles = getStyles(isDark, insets);

  return (
    <>
      {/* Native Expo Router Header */}
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: isDark ? '#09090b' : '#ffffff',
          },
          headerTitleStyle: {
            color: isDark ? '#f4f4f5' : '#09090b',
            fontWeight: 'bold',
            fontSize: 22,
          },
          headerTintColor: isDark ? '#f4f4f5' : '#09090b',
        }}
      />

      {/* Main Container */}
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Appearance Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appearance</Text>

            {/* Theme Mode Selector */}
            <View style={styles.optionGroup}>
              {/* Light Mode Option */}
              <Pressable
                onPress={() => handleThemeChange('light')}
                style={[
                  styles.optionRow,
                  themeMode === 'light' && styles.optionRowActive,
                ]}
              >
                <View style={styles.optionTextContainer}>
                  <Text
                    style={[
                      styles.optionTitle,
                      themeMode === 'light' && styles.optionTitleActive,
                    ]}
                  >
                    Light
                  </Text>
                  <Text style={styles.optionDescription}>
                    Always use light mode
                  </Text>
                </View>
                <View style={[styles.radioCircle, themeMode === 'light' && styles.radioCircleActive]}>
                  {themeMode === 'light' && <View style={styles.radioDot} />}
                </View>
              </Pressable>

              {/* Dark Mode Option */}
              <Pressable
                onPress={() => handleThemeChange('dark')}
                style={[
                  styles.optionRow,
                  themeMode === 'dark' && styles.optionRowActive,
                ]}
              >
                <View style={styles.optionTextContainer}>
                  <Text
                    style={[
                      styles.optionTitle,
                      themeMode === 'dark' && styles.optionTitleActive,
                    ]}
                  >
                    Dark
                  </Text>
                  <Text style={styles.optionDescription}>
                    Always use dark mode
                  </Text>
                </View>
                <View style={[styles.radioCircle, themeMode === 'dark' && styles.radioCircleActive]}>
                  {themeMode === 'dark' && <View style={styles.radioDot} />}
                </View>
              </Pressable>

              {/* System Mode Option */}
              <Pressable
                onPress={() => handleThemeChange('system')}
                style={[
                  styles.optionRow,
                  themeMode === 'system' && styles.optionRowActive,
                ]}
              >
                <View style={styles.optionTextContainer}>
                  <Text
                    style={[
                      styles.optionTitle,
                      themeMode === 'system' && styles.optionTitleActive,
                    ]}
                  >
                    System
                  </Text>
                  <Text style={styles.optionDescription}>
                    Follow system settings
                  </Text>
                </View>
                <View style={[styles.radioCircle, themeMode === 'system' && styles.radioCircleActive]}>
                  {themeMode === 'system' && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            </View>
          </View>

          {/* Dashboard Layout Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dashboard Layout</Text>

            <View style={styles.optionGroup}>
              {/* Vertical List Option */}
              <Pressable
                onPress={() => handleViewModeChange('list')}
                style={[
                  styles.optionRow,
                  viewMode === 'list' && styles.optionRowActive,
                ]}
              >
                <View style={styles.optionTextContainer}>
                  <Text
                    style={[
                      styles.optionTitle,
                      viewMode === 'list' && styles.optionTitleActive,
                    ]}
                  >
                    Vertical List
                  </Text>
                  <Text style={styles.optionDescription}>
                    Full card details with descriptions
                  </Text>
                </View>
                <View style={[styles.radioCircle, viewMode === 'list' && styles.radioCircleActive]}>
                  {viewMode === 'list' && <View style={styles.radioDot} />}
                </View>
              </Pressable>

              {/* Compact Cloud Tag Option */}
              <Pressable
                onPress={() => handleViewModeChange('cloud')}
                style={[
                  styles.optionRow,
                  viewMode === 'cloud' && styles.optionRowActive,
                ]}
              >
                <View style={styles.optionTextContainer}>
                  <Text
                    style={[
                      styles.optionTitle,
                      viewMode === 'cloud' && styles.optionTitleActive,
                    ]}
                  >
                    Compact Cloud
                  </Text>
                  <Text style={styles.optionDescription}>
                    Dense tag grid for quick access
                  </Text>
                </View>
                <View style={[styles.radioCircle, viewMode === 'cloud' && styles.radioCircleActive]}>
                  {viewMode === 'cloud' && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            </View>
          </View>

          {/* Data Management Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Management</Text>

            <View style={styles.optionGroup}>
              {/* Export Button */}
              <Pressable
                onPress={handleExport}
                disabled={isExporting}
                style={[styles.actionButton, isExporting && styles.actionButtonDisabled]}
              >
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionButtonText}>
                    {isExporting ? 'Exporting...' : 'Export JSON Backup'}
                  </Text>
                  <Text style={styles.actionButtonSubtext}>
                    {isExporting
                      ? 'Creating backup file...'
                      : 'Generate and share a backup of all your collections'}
                  </Text>
                </View>
              </Pressable>

              {/* Import Button */}
              <Pressable
                onPress={handleImport}
                disabled={isImporting}
                style={[
                  styles.actionButton,
                  styles.actionButtonSecondary,
                  isImporting && styles.actionButtonDisabled,
                ]}
              >
                <View style={styles.actionButtonContent}>
                  <Text
                    style={[
                      styles.actionButtonText,
                      styles.actionButtonTextSecondary,
                    ]}
                  >
                    {isImporting ? 'Importing...' : 'Import JSON Backup'}
                  </Text>
                  <Text
                    style={[
                      styles.actionButtonSubtext,
                      styles.actionButtonSubtextSecondary,
                    ]}
                  >
                    {isImporting
                      ? 'Restoring from file...'
                      : 'Restore collections from a backup file'}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>

            <View style={styles.infoGroup}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Version</Text>
                <Text style={styles.infoValue}>8.2.0</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Build</Text>
                <Text style={styles.infoValue}>Production</Text>
              </View>
              <View style={styles.infoRowLast}>
                <Text style={styles.infoLabel}>View Mode</Text>
                <Text style={styles.infoValue}>{viewMode === 'list' ? 'Vertical List' : 'Compact Cloud'}</Text>
              </View>
            </View>
          </View>

          {/* File System Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Storage</Text>

            <View style={styles.infoGroup}>
              <View style={styles.infoRowLast}>
                <Text style={styles.infoLabel}>Backup Format</Text>
                <Text style={styles.infoValue}>JSON (Native File System)</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

// Style generator function for adaptive theming
function getStyles(isDark: boolean, insets: { bottom: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#09090b' : '#fafafa',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: insets.bottom + 24,
      paddingHorizontal: 16,
      paddingTop: 24,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: isDark ? '#818cf8' : '#3b82f6',
      marginBottom: 12,
    },
    optionGroup: {
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? '#27272a' : '#e4e4e7',
      overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#27272a' : '#f4f4f5',
    },
    optionRowActive: {
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.04)',
    },
    optionTextContainer: {
      flex: 1,
      marginRight: 12,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#fafafa' : '#18181b',
      marginBottom: 2,
    },
    optionTitleActive: {
      color: isDark ? '#60a5fa' : '#3b82f6',
    },
    optionDescription: {
      fontSize: 13,
      color: isDark ? '#71717a' : '#a1a1aa',
    },
    radioCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: isDark ? '#3f3f46' : '#d4d4d8',
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioCircleActive: {
      borderColor: isDark ? '#60a5fa' : '#3b82f6',
    },
    radioDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
    },
    actionButton: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#27272a' : '#f4f4f5',
    },
    actionButtonSecondary: {
      borderBottomWidth: 0,
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonContent: {
      flexDirection: 'column',
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#60a5fa' : '#3b82f6',
      marginBottom: 4,
    },
    actionButtonTextSecondary: {
      color: isDark ? '#a78bfa' : '#7c3aed',
    },
    actionButtonSubtext: {
      fontSize: 13,
      color: isDark ? '#71717a' : '#a1a1aa',
    },
    actionButtonSubtextSecondary: {
      color: isDark ? '#71717a' : '#a1a1aa',
    },
    infoGroup: {
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? '#27272a' : '#e4e4e7',
      paddingVertical: 8,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#27272a' : '#f4f4f5',
    },
    infoRowLast: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    infoLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: isDark ? '#a1a1aa' : '#71717a',
    },
    infoValue: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#fafafa' : '#18181b',
    },
  });
}
