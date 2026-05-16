import '@/global.css';

import { ActionSheetProvider } from '@expo/react-native-action-sheet';

import { StoreProvider } from '../src/core/store';

import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import * as Device from 'expo-device';
import { Link, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Icon } from '@/components/nativewindui/Icon';
import { ThemeToggle } from '@/components/nativewindui/ThemeToggle';
import { cn } from '@/lib/cn';
import { useColorScheme } from '@/lib/useColorScheme';
import { NAV_THEME } from '@/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const isIos26 = Platform.select({ default: false, ios: Device.osVersion?.startsWith('26.') });

export default function RootLayout() {
  const { colorScheme, isDarkColorScheme } = useColorScheme();

  return (
    <>
      <StatusBar
        key={`root-status-bar-${isDarkColorScheme ? 'light' : 'dark'}`}
        style={isDarkColorScheme ? 'light' : 'dark'}
      />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StoreProvider>
          <ActionSheetProvider>
            <NavThemeProvider value={NAV_THEME[colorScheme]}>
              <Stack>
                <Stack.Screen name="index" options={INDEX_OPTIONS} />
                <Stack.Screen name="flight-deck" options={FLIGHT_DECK_OPTIONS} />
                <Stack.Screen name="create-template" options={CREATE_TEMPLATE_OPTIONS} />
                <Stack.Screen name="modal" options={MODAL_OPTIONS} />
              </Stack>
            </NavThemeProvider>
          </ActionSheetProvider>
        </StoreProvider>
      </GestureHandlerRootView>
    </>
  );
}

const INDEX_OPTIONS = {
  headerLargeTitle: true,
  headerTransparent: isIos26,
  title: 'FlightManual',
  headerRight: () => <SettingsIcon />,
} as const;

function SettingsIcon() {
  return (
    <Link href="/modal" asChild>
      <Pressable className={cn('opacity-80 active:opacity-50', isIos26 && 'px-1.5')}>
        <Icon name="gearshape" className="text-foreground" />
      </Pressable>
    </Link>
  );
}

const FLIGHT_DECK_OPTIONS = {
  title: 'Flight Deck',
  headerBackTitle: 'Back',
} as const;

const CREATE_TEMPLATE_OPTIONS = {
  title: 'New Template',
  headerBackTitle: 'Back',
} as const;

const MODAL_OPTIONS = {
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
  title: 'Settings',
  headerRight: () => <ThemeToggle />,
} as const;
