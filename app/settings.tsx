// app/settings.tsx — V8.0 Settings Module with Theme Toggle
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
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ThemeMode = 'light' | 'dark' | 'system';

export default function Settings() {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

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

  const getThemeLabel = (mode: ThemeMode): string => {
    switch (mode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
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

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>

            <View style={styles.infoGroup}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Version</Text>
                <Text style={styles.infoValue}>8.0.0</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Build</Text>
                <Text style={styles.infoValue}>Production</Text>
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
