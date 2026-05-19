# 17 — Flight Deck Back Guard & Saved Runs

## Source
`docs/gemini-archive/manual/gemini_manual-08-app-collection-saved-run.md`

## Feature Description
A native back-action interception system for the flight deck. When users press Android hardware back, iOS swipe-back, or header back during an active run, the app prevents accidental state loss. For previously saved runs, it silently updates. For fresh runs, it presents a confirmation modal with Save, Abandon, or Cancel options.

## Key Concepts

### Back Action Conditional Matrix
| Condition | Source | Behavior |
|-----------|--------|----------|
| Existing saved run | `isFromSavedList` flag or matching `runId` in `savedRuns` | Silent autosave + `router.replace('/')` — no modal |
| Fresh run | No match in `savedRuns` | `e.preventDefault()` + show exit modal |

### Exit Modal Options
1. **Save Progress** — nested text input for custom name, calls `saveCurrentRunForLater(customName)`, navigates home
2. **Abandon Run** — clears active run, navigates home
3. **Cancel / Stay** — closes modal, continues execution

## New Store Requirements

### New State
- `savedRuns: SavedRun[]` — persisted to `flightmanual::saved_runs`
- `activeRun` gets an optional `savedRunId?: string` field to track if launched from saved list

### New Interface

```typescript
export interface SavedRun {
  id: string;
  customName: string;
  runInstance: RunInstance;
  savedAt: number;
}
```

### New Store Actions
- `saveCurrentRunForLater(customName: string)` — pushes active run into `savedRuns`, clears `activeRun`, persists
- `updateSavedRun()` — overwrites matching saved run with current step state
- `resumeSavedRun(savedRunId: string)` — loads a saved run back into `activeRun`
- `deleteSavedRun(savedRunId: string)` — removes from `savedRuns`

## Adaptation Notes (Expo / React Native)
- `BackHandler` from `react-native` for Android hardware back
- `useNavigation` from `expo-router` + `beforeRemove` event for iOS swipe-back and header back
- `useEffect` cleanup must remove both listeners
- `router.replace('/')` (not `router.back()`) to avoid re-triggering the guard
- `Modal` from `react-native` for the exit overlay
- NativeWind styling for the modal UI

---

## Sample Code: `app/flight-deck.tsx` — Back Guard Integration

```tsx
// app/flight-deck.tsx — V8.3 Back Guard additions
// Add these imports alongside existing ones:
import { BackHandler } from 'react-native';
import { useNavigation } from 'expo-router';

// Inside the component:
const navigation = useNavigation();
const { state, toggleStep, completeRun, saveCurrentRunForLater, updateSavedRun, clearActiveRun } = useFlightManual();
const [exitModalVisible, setExitModalVisible] = useState(false);
const [saveName, setSaveName] = useState('');
const [showSaveInput, setShowSaveInput] = useState(false);

const isFromSaved = !!state.activeRun?.savedRunId;

// Back interception guard
useEffect(() => {
  const handleBackPress = () => {
    if (!state.activeRun) return false;
    if (isFromSaved) {
      // Silent autosave for resumed runs
      updateSavedRun();
      router.replace('/');
      return true;
    }
    // Fresh run — show exit modal
    setExitModalVisible(true);
    return true;
  };

  // Android hardware back
  const backSubscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

  // iOS swipe-back + header back
  const unsubscribe = navigation.addListener('beforeRemove', (e) => {
    if (!state.activeRun) return;
    e.preventDefault();
    if (isFromSaved) {
      updateSavedRun();
      router.replace('/');
    } else {
      setExitModalVisible(true);
    }
  });

  return () => {
    backSubscription.remove();
    unsubscribe();
  };
}, [state.activeRun, isFromSaved, navigation]);
```

---

## Sample Code: Exit Modal UI

```tsx
{/* Exit Confirmation Modal */}
<Modal visible={exitModalVisible} animationType="fade" transparent>
  <View className="flex-1 items-center justify-center bg-black/60 px-6">
    <View className="w-full rounded-2xl bg-gray-900 p-6">
      <Text className="mb-2 text-xl font-bold text-white">Leave Flight?</Text>
      <Text className="mb-6 text-sm text-gray-400">
        You have an active run in progress.
      </Text>

      {/* Option 1: Save Progress */}
      {!showSaveInput ? (
        <Pressable
          onPress={() => setShowSaveInput(true)}
          className="mb-3 items-center rounded-xl bg-blue-600 py-3 active:bg-blue-700"
        >
          <Text className="text-sm font-bold text-white">Save Progress for Later</Text>
        </Pressable>
      ) : (
        <View className="mb-3">
          <TextInput
            className="mb-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white"
            placeholder="Give it a name..."
            placeholderTextColor="#6b7280"
            value={saveName}
            onChangeText={setSaveName}
            autoFocus
          />
          <Pressable
            onPress={() => {
              saveCurrentRunForLater(saveName.trim() || `Run ${new Date().toLocaleDateString()}`);
              setExitModalVisible(false);
              setSaveName('');
              setShowSaveInput(false);
              router.replace('/');
            }}
            className="items-center rounded-xl bg-blue-600 py-3 active:bg-blue-700"
          >
            <Text className="text-sm font-bold text-white">Save & Exit</Text>
          </Pressable>
        </View>
      )}

      {/* Option 2: Abandon Run */}
      <Pressable
        onPress={() => {
          clearActiveRun();
          setExitModalVisible(false);
          setShowSaveInput(false);
          setSaveName('');
          router.replace('/');
        }}
        className="mb-3 items-center rounded-xl border border-red-500/30 bg-gray-800 py-3 active:bg-gray-700"
      >
        <Text className="text-sm font-semibold text-red-400">Abandon Run</Text>
      </Pressable>

      {/* Option 3: Cancel / Stay */}
      <Pressable
        onPress={() => {
          setExitModalVisible(false);
          setShowSaveInput(false);
          setSaveName('');
        }}
        className="items-center rounded-xl bg-gray-800 py-3 active:bg-gray-700"
      >
        <Text className="text-sm font-semibold text-gray-400">Cancel</Text>
      </Pressable>
    </View>
  </View>
</Modal>
```

---

## Sample Code: Store Additions (`src/core/store.ts`)

```typescript
// New state field
interface FlightState {
  // ... existing fields
  savedRuns: SavedRun[];
}

// New actions
type Action =
  | // ... existing actions
  { type: 'SAVE_RUN_FOR_LATER'; payload: { customName: string } }
  | { type: 'UPDATE_SAVED_RUN' }
  | { type: 'LOAD_SAVED_RUN'; payload: string } // savedRunId
  | { type: 'DELETE_SAVED_RUN'; payload: string }
  | { type: 'CLEAR_ACTIVE_RUN' };

// Reducer cases
case 'SAVE_RUN_FOR_LATER': {
  if (!state.activeRun) return state;
  const saved: SavedRun = {
    id: `saved_${Date.now()}`,
    customName: action.payload.customName,
    runInstance: { ...state.activeRun },
    savedAt: Date.now(),
  };
  return {
    ...state,
    activeRun: null,
    savedRuns: [...state.savedRuns, saved],
  };
}

case 'UPDATE_SAVED_RUN': {
  if (!state.activeRun?.savedRunId) return state;
  return {
    ...state,
    savedRuns: state.savedRuns.map((sr) =>
      sr.id === state.activeRun!.savedRunId
        ? { ...sr, runInstance: { ...state.activeRun! }, savedAt: Date.now() }
        : sr,
    ),
  };
}

case 'LOAD_SAVED_RUN': {
  const saved = state.savedRuns.find((sr) => sr.id === action.payload);
  if (!saved) return state;
  return {
    ...state,
    activeRun: { ...saved.runInstance, savedRunId: saved.id },
  };
}

case 'DELETE_SAVED_RUN': {
  return {
    ...state,
    savedRuns: state.savedRuns.filter((sr) => sr.id !== action.payload),
  };
}

case 'CLEAR_ACTIVE_RUN': {
  return { ...state, activeRun: null };
}

// New action functions exposed via context
const saveCurrentRunForLater = useCallback((customName: string) => {
  dispatch({ type: 'SAVE_RUN_FOR_LATER', payload: { customName } });
}, []);

const updateSavedRun = useCallback(() => {
  dispatch({ type: 'UPDATE_SAVED_RUN' });
}, []);

const resumeSavedRun = useCallback((savedRunId: string) => {
  dispatch({ type: 'LOAD_SAVED_RUN', payload: savedRunId });
}, []);

const deleteSavedRun = useCallback((savedRunId: string) => {
  dispatch({ type: 'DELETE_SAVED_RUN', payload: savedRunId });
}, []);

const clearActiveRun = useCallback(() => {
  dispatch({ type: 'CLEAR_ACTIVE_RUN' });
}, []);
```

---

## Integration Note for `app/index.tsx`

The dashboard should display saved runs that can be resumed:

```tsx
{/* Saved / Suspended Runs */}
{state.savedRuns.length > 0 && (
  <View className="mb-6">
    <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-400">
      Saved Runs
    </Text>
    {state.savedRuns.map((sr) => (
      <Pressable
        key={sr.id}
        onPress={() => {
          resumeSavedRun(sr.id);
          router.push('/flight-deck');
        }}
        className="mb-2 flex-row items-center rounded-lg border border-amber-500/30 bg-amber-950/30 px-4 py-3 active:bg-amber-900/40"
      >
        <View className="flex-1">
          <Text className="text-sm font-semibold text-amber-300">{sr.customName}</Text>
          <Text className="text-xs text-gray-500">
            {sr.runInstance.currentSteps.filter((s) => s.isCompleted).length}/{sr.runInstance.currentSteps.length} done
          </Text>
        </View>
        <Pressable onPress={() => deleteSavedRun(sr.id)} className="px-2 py-1">
          <Text className="text-xs text-gray-600">Delete</Text>
        </Pressable>
      </Pressable>
    ))}
  </View>
)}
```
