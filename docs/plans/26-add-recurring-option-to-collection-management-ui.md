# Plan 26: Add Recurring Option to Collection Management UI

## Implementation Status: ✅ COMPLETE

### Overview
This plan adds a user-facing toggle switch in the collection creation/editing interface that allows users to mark collections as "Daily Recurring Routines." When enabled, these collections automatically spawn fresh run instances each day via the Plan 25 engine.

### Files Modified

#### 1. `/Users/vincent/app-collection-work/src/core/store.tsx`

**Changes Made:**
- Updated `UPDATE_COLLECTION` action type to include `isRecurring: boolean`
- Modified `UPDATE_COLLECTION` reducer case to persist `isRecurring` in collection metadata
- Updated `saveCustomCollection` function signature to accept `isRecurring` parameter
- Updated `updateCollection` function signature to accept `isRecurring` parameter
- Updated FlightContext interface to reflect new parameter signatures
- Added immediate AsyncStorage persistence for recurring flag updates

**Key Code Blocks:**
```typescript
// Action type updated
| { type: 'UPDATE_COLLECTION'; payload: { id: string; name: string; description: string; tags: string[]; executionMode: ExecutionMode; steps: Step[]; isRecurring: boolean } }

// Reducer updated to handle isRecurring
case 'UPDATE_COLLECTION': {
  const { id, name, description, tags, executionMode, steps, isRecurring } = action.payload;
  return {
    ...state,
    collections: state.collections.map(col =>
      col.id === id
        ? { ...col, name, description, tags, executionMode, steps, isRecurring }
        : col
    ),
  };
}

// Function signatures updated
saveCustomCollection: (
  name: string,
  description: string,
  tags: string[],
  stepTexts: string[],
  executionMode: ExecutionMode,
  isRecurring: boolean,
) => Promise<void>;

updateCollection: (
  id: string,
  name: string,
  description: string,
  tags: string[],
  executionMode: ExecutionMode,
  stepTexts: string[],
  isRecurring: boolean,
) => Promise<void>;
```

#### 2. `/Users/vincent/app-collection-work/app/create-collection.tsx`

**Changes Made:**
- Added `Switch` import from react-native
- Added `isRecurring` state hook: `const [isRecurring, setIsRecurring] = useState(false);`
- Updated form hydration to populate `isRecurring` when editing existing collections
- Updated `handleSave` to pass `isRecurring` to both `saveCustomCollection` and `updateCollection`
- Added recurring toggle UI component between Description and Tags fields
- Added adaptive styles for recurring card (light/dark mode support)

**UI Component Added:**
```typescript
{/* Daily Recurring Routine Toggle */}
<View style={[styles.fieldContainer, adaptiveStyles.recurringCard]}>
  <View style={styles.recurringContent}>
    <View style={styles.recurringTextContainer}>
      <Text style={adaptiveStyles.fieldLabel}>🔁 Daily Recurring Routine</Text>
      <Text style={adaptiveStyles.recurringDescription}>
        Automatically resets and regenerates a fresh blank list at the start of each day.
      </Text>
    </View>
    <Switch
      value={isRecurring}
      onValueChange={setIsRecurring}
      trackColor={{ false: '#3f3f46', true: '#22c55e' }}
      thumbColor={isRecurring ? '#ffffff' : '#f4f4f5'}
      ios_backgroundColor="#3f3f46"
    />
  </View>
</View>
```

#### 3. `/Users/vincent/app-collection-work/app/create-template.tsx`

**Changes Made:**
- Updated `saveCustomCollection` call to include `false` for `isRecurring` parameter (templates are not recurring by default)

### How It Works

1. **User creates a new collection:**
   - Fills in name, description, tags, execution mode, and steps
   - Toggles "🔁 Daily Recurring Routine" switch if desired
   - Clicks "Save Collection"
   - The `isRecurring` value is persisted to AsyncStorage via the store

2. **User edits an existing collection:**
   - Collection loads with current `isRecurring` state pre-populated
   - User can toggle the switch on/off
   - Clicks "Update Collection"
   - The updated `isRecurring` value is saved to AsyncStorage

3. **Plan 25 Integration:**
   - When `isRecurring: true`, the Plan 25 sync engine automatically spawns daily runs
   - Incomplete progress rolls over to the next day
   - Completed runs reset after the grace window (4 AM)

### Visual Design

The recurring toggle appears as a beautiful card container with:
- **Icon**: 🔁 emoji prefix for visual recognition
- **Title**: "Daily Recurring Routine" in bold field label style
- **Description**: "Automatically resets and regenerates a fresh blank list at the start of each day."
- **Switch**: Native Switch component with green (#22c55e) track when enabled
- **Adaptive theming**: Light/dark mode support with appropriate border/background colors

### Testing Checklist

- [ ] Create a new collection with recurring enabled
- [ ] Create a new collection with recurring disabled
- [ ] Edit an existing collection and toggle recurring on
- [ ] Edit an existing collection and toggle recurring off
- [ ] Verify recurring collection spawns daily run on app boot
- [ ] Verify non-recurring collection does not auto-spawn
- [ ] Test light/dark mode appearance of recurring card
- [ ] Verify data persists across app restarts

### Backward Compatibility

- Existing collections without `isRecurring` field default to `false` (non-recurring)
- No migration needed - the feature is fully additive
- All existing functionality remains unchanged

### Related Plans

- **Plan 25**: Persistent Recurring Routines with 4-Hour Post-Midnight Grace Window (data layer)
- **Plan 26**: This plan (UI layer)
