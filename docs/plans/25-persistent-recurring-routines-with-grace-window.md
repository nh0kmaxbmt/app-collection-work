# Plan 25: Persistent Recurring Routines with 4-Hour Post-Midnight Grace Window

## Context

This feature transforms any collection into an automated, self-generating rolling goal. Collections flagged with `isRecurring: true` will automatically spawn daily run instances that:
- Auto-spawn on first app open each calendar day
- Roll over incomplete progress to the next day (no backlog duplicates)
- Reset completed runs after a 4-hour post-midnight grace window (12AM-4AM counts as previous day)
- Save silently without exit confirmation modals

## Implementation Status: ✅ COMPLETE

### Files Modified

#### 1. `/Users/vincent/app-collection-work/src/core/types.ts`
- Added `isRecurring?: boolean` to Collection interface
- Added `logicalDate?: string` and `completedAtLogicalDate?: string` to RunInstance interface

#### 2. `/Users/vincent/app-collection-work/src/core/config.ts`
- Added `RECURRING_CONFIG` object with `GRACE_WINDOW_END_HOUR: 4`
- Added `getLogicalDate(dateInput?: Date): string` helper function
- Added `isNewLogicalDay(lastCheckedDateString: string): boolean` utility function

#### 3. `/Users/vincent/app-collection-work/src/core/store.tsx`
- Added `RunSpawnOptions` interface for `compileAndStartRun`
- Modified `compileAndStartRun` to accept optional `isRecurringSpawn`, `logicalDate`, and `expiresAt` parameters
- Added recurring routine sync `useEffect` that runs on app boot:
  - CASE 1: Spawns fresh instance when none exists
  - CASE 2: Leaves incomplete runs untouched (rollover)
  - CASE 3: Resets completed runs when new logical day arrives
- Modified `UPDATE_SAVED_RUN` action to support `completedAtLogicalDate`
- Updated `updateSavedRun` function to accept optional `completedAtLogicalDate` parameter
- Updated FlightContext interface with new signatures

#### 4. `/Users/vincent/app-collection-work/app/flight-deck.tsx`
- Added `APP_CONFIG` import
- Added `isRecurringRun` detection based on collection's `isRecurring` flag
- Modified `handleComplete` to mark recurring runs with completion date instead of finalizing
- Added **RULE D** to both hardware back button and `beforeRemove` listener:
  - Recurring runs save silently with no modals
  - Completed runs get marked with `completedAtLogicalDate`
  - Partial progress updates in-place

## How It Works

### Logical Date System
The `getLogicalDate()` function converts calendar time to "logical" time:
- 12:00 AM - 3:59 AM: Counts as **previous day** (grace window)
- 4:00 AM onwards: Counts as **current day**

### Daily Sync Behavior
On each app boot, the store syncs recurring collections:

| Active Saved Run State | Run Progress | Completion Date | Action |
|---|---|---|---|
| Does Not Exist | N/A | N/A | **Spawn Fresh Run** (`expiresAt: undefined`) |
| Exists | Incomplete | N/A | **Leave Untouched** (rolls over to next day) |
| Exists | Complete (100%) | Matches Today | **Leave Visible** (shows achievement) |
| Exists | Complete (100%) | Before Today | **Purge & Spawn Fresh Empty Run** |

### Back-Guard Rules
The 5-rule system now includes:

| Rule | Run Type | Condition | Action |
|---|---|---|---|
| **A-1** | Resumed Saved | 100% done | Complete → Scrub → Back |
| **A-2** | Resumed Saved | Partial done | Update in-place → Back |
| **B** | Fresh Standard | Untouched | Silent clear → Back |
| **C** | Fresh Standard | Dirty | Show modal |
| **D** | **Recurring** | **Any progress** | **Silent save → Back (no modals)** |

## Verification Routine

### 1. Flush Bundler Cache
```bash
npx expo start --clear
```

### 2. Verify Auto-Generation
1. Go to collection editor and toggle `isRecurring: true` on a routine
2. Return to home - verify empty card auto-spawns in active runs

### 3. Verify Silent Exit (Rule D)
1. Open recurring card, check one step, press back
2. Verify silent pop-back with zero popup modals

### 4. Verify Rollover & Expiry Protection
1. Change system clock forward 2 days
2. Verify recurring card remains (partial progress preserved)
3. Verify standard saved runs get wiped by 24h GC
4. Verify completed recurring runs reset after grace window

### 5. Verify Grace Window
1. At 2:00 AM, complete all steps in recurring run
2. Verify completion date shows previous day
3. At 5:00 AM, verify new blank run spawns

## Technical Notes

1. **No Background Timers**: All logic runs on app foreground boot - no battery drain
2. **Persistence**: The persist middleware in `store.tsx` handles AsyncStorage automatically
3. **Type Safety**: All changes are fully typed with TypeScript
4. **Backward Compatible**: Existing collections without `isRecurring` work unchanged
