// src/core/store.tsx — V9.1 Centralized Config & Dynamic Expiry Integration with Conditional Deletion
import { createContext, useContext, useReducer, useEffect, useCallback, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG, logConfigState } from './config';
import type {
  Collection,
  Template,
  RunInstance,
  RunLog,
  Step,
  CompiledStep,
  ExecutionMode,
  DashboardViewMode,
  FlightManualBackup,
} from './types';

// Use centralized storage keys from config
const KEYS = APP_CONFIG.STORAGE_KEYS;

// ─── Seed data ──────────────────────────────────────────────
const SEED_COLLECTIONS: Collection[] = [
  {
    id: 'col_gym_prep',
    name: 'Gym Session Prep',
    description: 'Standard pre-workout preparation routine',
    tags: ['fitness', 'daily'],
    executionMode: 'linear',
    steps: [
      { id: 'step_1', text: 'Fill up 1.5L water bottle', isCompleted: false, isLocked: false },
      { id: 'step_2', text: 'Pack lifting belt and clean towel into gym bag', isCompleted: false, isLocked: true, dependsOnStepId: 'step_1' },
      { id: 'step_3', text: 'Verify wireless headphones are charged > 50%', isCompleted: false, isLocked: true, dependsOnStepId: 'step_2' },
      { id: 'step_4', text: 'Put on workout shoes and tie laces', isCompleted: false, isLocked: true, dependsOnStepId: 'step_3' },
      { id: 'step_5', text: 'Grab pre-workout snack if needed', isCompleted: false, isLocked: true, dependsOnStepId: 'step_4' },
    ],
  },
  {
    id: 'col_leg_day',
    name: 'Leg Day Extras',
    description: 'Additional items for lower body focus sessions',
    tags: ['fitness', 'legs'],
    executionMode: 'linear',
    steps: [
      { id: 'step_leg_1', text: 'Pack knee sleeves', isCompleted: false, isLocked: false },
      { id: 'step_leg_2', text: 'Pack lifting belt (heavier weight expected)', isCompleted: false, isLocked: true, dependsOnStepId: 'step_leg_1' },
      { id: 'step_leg_3', text: 'Bring foam roller for post-workout', isCompleted: false, isLocked: true, dependsOnStepId: 'step_leg_2' },
    ],
  },
  {
    id: 'col_upper_body',
    name: 'Upper Body Focus',
    description: 'Items for push and pull day sessions',
    tags: ['fitness', 'upper'],
    executionMode: 'linear',
    steps: [
      { id: 'step_upper_1', text: 'Pack lifting straps', isCompleted: false, isLocked: false },
      { id: 'step_upper_2', text: 'Pack wrist wraps', isCompleted: false, isLocked: true, dependsOnStepId: 'step_upper_1' },
      { id: 'step_upper_3', text: 'Bring chalk if gym allows', isCompleted: false, isLocked: true, dependsOnStepId: 'step_upper_2' },
    ],
  },
  {
    id: 'col_grocery_list',
    name: 'Grocery List',
    description: 'Weekly grocery shopping essentials',
    tags: ['errands', 'shopping', 'weekly'],
    executionMode: 'parallel',
    steps: [
      { id: 'step_g1', text: 'Get shopping bags', isCompleted: false, isLocked: false },
      { id: 'step_g2', text: 'Buy milk', isCompleted: false, isLocked: false },
      { id: 'step_g3', text: 'Buy eggs', isCompleted: false, isLocked: false },
      { id: 'step_g4', text: 'Buy bread', isCompleted: false, isLocked: false },
      { id: 'step_g5', text: 'Buy coffee beans', isCompleted: false, isLocked: false },
      { id: 'step_g6', text: 'Buy fresh produce', isCompleted: false, isLocked: false },
    ],
  },
  {
    id: 'col_bookstore',
    name: 'Bookstore Run',
    description: 'Library and bookstore errands',
    tags: ['errands', 'reading'],
    executionMode: 'linear',
    steps: [
      { id: 'step_b1', text: 'Locate library card', isCompleted: false, isLocked: false },
      { id: 'step_b2', text: 'Grab book bag', isCompleted: false, isLocked: true, dependsOnStepId: 'step_b1' },
      { id: 'step_b3', text: 'Check return due dates', isCompleted: false, isLocked: true, dependsOnStepId: 'step_b2' },
    ],
  },
  {
    id: 'col_coffee_shop',
    name: 'Coffee Shop',
    description: 'Cafe visit checklist',
    tags: ['errands', 'food'],
    executionMode: 'parallel',
    steps: [
      { id: 'step_c1', text: 'Bring reusable cup', isCompleted: false, isLocked: false },
      { id: 'step_c2', text: 'Check loyalty app for rewards', isCompleted: false, isLocked: false },
      { id: 'step_c3', text: 'Bring headphones for podcast', isCompleted: false, isLocked: false },
    ],
  },
];

const SEED_LOGS: RunLog[] = [
  { collectionId: 'col_gym_prep', timestamp: 1778950800000, durationMs: 420000 },
  { collectionId: 'col_gym_prep', timestamp: 1779037200000, durationMs: 380000 },
  { collectionId: 'col_grocery_list', timestamp: 1779123600000, durationMs: 510000 },
  { collectionId: 'col_gym_prep', timestamp: 1779210000000, durationMs: 400000 },
  { collectionId: 'col_bookstore', timestamp: 1779213600000, durationMs: 180000 },
  { collectionId: 'col_leg_day', timestamp: 1779296400000, durationMs: 450000 },
  { collectionId: 'col_gym_prep', timestamp: 1779382800000, durationMs: 390000 },
  { collectionId: 'col_grocery_list', timestamp: 1779386400000, durationMs: 480000 },
];

// ─── State ──────────────────────────────────────────────────
interface FlightState {
  collections: Collection[];
  templates: Template[];
  activeRun: RunInstance | null;
  savedRuns: RunInstance[];
  historyLogs: RunLog[];
  isLoading: boolean;
}

// Helper to check if a saved run has expired using config-based thresholds
function checkRunExpired(expiresAt: number | undefined): boolean {
  if (!expiresAt) return false;
  return Date.now() > expiresAt;
}

// ─── Actions ────────────────────────────────────────────────
type Action =
  | { type: 'HYDRATE'; payload: { collections: Collection[]; templates: Template[]; activeRun: RunInstance | null; savedRuns: RunInstance[]; historyLogs: RunLog[] } }
  | { type: 'START_RUN'; payload: RunInstance }
  | { type: 'TOGGLE_STEP'; payload: string }
  | { type: 'COMPLETE_RUN'; payload: { log: RunLog; savedRunId?: string } }
  | { type: 'APPEND_STEPS'; payload: CompiledStep[] }
  | { type: 'SAVE_TEMPLATE'; payload: Template }
  | { type: 'SAVE_COLLECTION'; payload: Collection }
  | { type: 'UPDATE_COLLECTION'; payload: { id: string; name: string; description: string; tags: string[]; executionMode: ExecutionMode; steps: Step[] } }
  | { type: 'DELETE_TEMPLATE'; payload: string }
  | { type: 'DELETE_COLLECTION'; payload: string }
  | { type: 'SAVE_RUN_FOR_LATER'; payload: { run: RunInstance; name: string } }
  | { type: 'UPDATE_SAVED_RUN'; payload: { id: string; steps: CompiledStep[] } }
  | { type: 'RESUME_SPECIFIC_RUN'; payload: RunInstance }
  | { type: 'DELETE_SAVED_RUN'; payload: string }
  | { type: 'CLEAR_ACTIVE_RUN' }
  | { type: 'CLEAR_EXPIRED_RUNS' }
  | { type: 'REPLACE_ALL_DATA'; payload: { collections: Collection[]; templates: Template[]; historyLogs: RunLog[] } };

const initialState: FlightState = {
  collections: [],
  templates: [],
  activeRun: null,
  savedRuns: [],
  historyLogs: [],
  isLoading: true,
};

// ─── Helper: Safe AsyncStorage operations with fallback ─────
async function safeGetItem<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      const parsed = JSON.parse(value);
      return parsed as T;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Native module is null') || message.includes('null is not an object')) {
      console.warn(`[FlightManual] AsyncStorage unavailable for ${key}, using fallback`);
    } else {
      console.error(`[FlightManual] AsyncStorage.getItem(${key}) failed:`, error);
    }
  }
  return null;
}

async function safeGetItemWithFallback<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      const parsed = JSON.parse(value);
      return parsed as T;
    }
    return fallback;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Native module is null') || message.includes('null is not an object')) {
      console.warn(`[FlightManual] AsyncStorage unavailable for ${key}, using fallback`);
    } else {
      console.error(`[FlightManual] AsyncStorage.getItem(${key}) failed:`, error);
    }
  }
  return fallback;
}

async function safeSetItem(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Native module is null') || message.includes('null is not an object')) {
      console.warn(`[FlightManual] AsyncStorage unavailable, skipping persist for ${key}`);
    } else {
      console.error(`[FlightManual] AsyncStorage.setItem(${key}) failed:`, error);
    }
  }
}

async function safeRemoveItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Native module is null') || message.includes('null is not an object')) {
      console.warn(`[FlightManual] AsyncStorage unavailable, skipping remove for ${key}`);
    } else {
      console.error(`[FlightManual] AsyncStorage.removeItem(${key}) failed:`, error);
    }
  }
}

// ─── Immutable linear step unlock helper ───────────────────
function unlockNextLinearStep(
  steps: CompiledStep[],
  completedStepId: string,
  parentTemplateName: string
): CompiledStep[] {
  // Find all steps from the same parent collection
  const siblingSteps = steps.filter(s => s.parentTemplateName === parentTemplateName);

  // Find the completed step's index in the siblings
  const completedIndex = siblingSteps.findIndex(s => s.id === completedStepId);
  if (completedIndex === -1) return steps;

  // Find the next step in the sequence (by original array order)
  const nextStep = siblingSteps[completedIndex + 1];
  if (!nextStep) return steps;

  // Unlock the next step immutably
  return steps.map(s =>
    s.id === nextStep.id ? { ...s, isLocked: false } : { ...s }
  );
}

// ─── Reducer ────────────────────────────────────────────────
function reducer(state: FlightState, action: Action): FlightState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...action.payload, isLoading: false };

    case 'START_RUN':
      return { ...state, activeRun: action.payload };

    case 'TOGGLE_STEP': {
      if (!state.activeRun) return state;
      const stepId = action.payload;

      // Find the step being toggled
      const targetStep = state.activeRun.currentSteps.find(s => s.id === stepId);
      if (!targetStep) return state;

      // Calculate new completion state
      const newIsCompleted = !targetStep.isCompleted;

      // IMMUTABLE: Create brand new array with all steps as brand new objects
      let newSteps = state.activeRun.currentSteps.map(step =>
        step.id === stepId
          ? { ...step, isCompleted: newIsCompleted }
          : { ...step }
      );

      // If step was just completed, unlock the next linear step in its sequence
      if (newIsCompleted && targetStep.executionMode === 'linear') {
        newSteps = unlockNextLinearStep(newSteps, stepId, targetStep.parentTemplateName);
      }

      const allDone = newSteps.every(s => s.isCompleted);

      return {
        ...state,
        activeRun: {
          ...state.activeRun!,
          currentSteps: newSteps,
          isFinished: allDone
        }
      };
    }

    case 'COMPLETE_RUN': {
      const { log, savedRunId } = action.payload;

      // Filter out the completed saved run if it came from the pending registry
      const updatedSavedRuns = savedRunId
        ? state.savedRuns.filter((sr) => sr.id !== savedRunId)
        : state.savedRuns;

      return {
        ...state,
        activeRun: null,
        historyLogs: [...state.historyLogs, log],
        savedRuns: updatedSavedRuns,
      };
    }

    case 'APPEND_STEPS': {
      if (!state.activeRun) return state;
      return {
        ...state,
        activeRun: {
          ...state.activeRun,
          currentSteps: [...state.activeRun.currentSteps, ...action.payload],
          isFinished: false,
        },
      };
    }

    case 'SAVE_TEMPLATE':
      return { ...state, templates: [...state.templates, action.payload] };

    case 'SAVE_COLLECTION':
      return { ...state, collections: [...state.collections, action.payload] };

    case 'UPDATE_COLLECTION': {
      const { id, name, description, tags, executionMode, steps } = action.payload;
      return {
        ...state,
        collections: state.collections.map(col =>
          col.id === id
            ? { ...col, name, description, tags, executionMode, steps }
            : col
        ),
      };
    }

    case 'DELETE_TEMPLATE':
      return { ...state, templates: state.templates.filter((t) => t.id !== action.payload) };

    case 'DELETE_COLLECTION':
      return { ...state, collections: state.collections.filter((c) => c.id !== action.payload) };

    case 'SAVE_RUN_FOR_LATER': {
      const { run, name } = action.payload;
      const savedRunId = `saved_${Date.now()}`;
      const runWithName: RunInstance = {
        ...run,
        id: savedRunId,
        customName: name,
        expiresAt: Date.now() + APP_CONFIG.getExpiryDuration(), // DYNAMIC: Uses config-based duration
        savedRunId: undefined, // Fresh saves don't have a savedRunId parent
      };
      return {
        ...state,
        activeRun: null,
        savedRuns: [...state.savedRuns, runWithName],
      };
    }

    case 'UPDATE_SAVED_RUN': {
      const { id, steps } = action.payload;
      // Find and update the saved run immutably in the savedRuns array
      // This keeps the persisted entry alive while updating its progress
      const updatedSavedRuns = state.savedRuns.map(savedRun =>
        savedRun.id === id
          ? {
              ...savedRun,
              currentSteps: steps.map(s => ({ ...s })),
              savedAt: Date.now(),
            }
          : savedRun
      );

      return {
        ...state,
        savedRuns: updatedSavedRuns,
      };
    }

    case 'RESUME_SPECIFIC_RUN': {
      const resumedRun: RunInstance = {
        ...action.payload,
        savedRunId: action.payload.id, // Mark this run as resumed from saved list
      };
      // CRITICAL: Keep the saved run in the savedRuns array!
      // We NO LONGER filter it out. The saved run persists in the database
      // while activeRun becomes a temporary working copy.
      return {
        ...state,
        activeRun: resumedRun,
        // savedRuns remains unchanged - the original entry stays in the database
      };
    }

    case 'DELETE_SAVED_RUN':
      return {
        ...state,
        savedRuns: state.savedRuns.filter(r => r.id !== action.payload),
      };

    case 'CLEAR_ACTIVE_RUN':
      return {
        ...state,
        activeRun: null,
      };

    case 'CLEAR_EXPIRED_RUNS': {
      const now = Date.now();
      return {
        ...state,
        savedRuns: state.savedRuns.filter(run => run.expiresAt && run.expiresAt > now),
      };
    }

    case 'REPLACE_ALL_DATA':
      return {
        ...state,
        collections: action.payload.collections,
        templates: action.payload.templates,
        historyLogs: action.payload.historyLogs,
      };

    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────
interface FlightContextValue {
  state: FlightState;
  viewMode: DashboardViewMode;
  setViewMode: (mode: DashboardViewMode) => void;
  compileAndStartRun: (id: string, isTemplate: boolean) => void;
  toggleStep: (stepId: string) => void;
  completeRun: (savedRunId?: string) => Promise<void>;
  appendCollectionToActiveRun: (collectionId: string) => void;
  saveActiveRunAsTemplate: (title: string, description: string) => Promise<void>;
  saveCustomCollection: (
    name: string,
    description: string,
    tags: string[],
    stepTexts: string[],
    executionMode: ExecutionMode,
  ) => Promise<void>;
  updateCollection: (
    id: string,
    name: string,
    description: string,
    tags: string[],
    executionMode: ExecutionMode,
    stepTexts: string[],
  ) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
  saveCurrentRunForLater: (name: string) => void;
  updateSavedRun: (id: string, steps: CompiledStep[]) => Promise<void>;
  resumeSavedRun: (id: string) => void;
  deleteSavedRun: (runId: string) => void;
  clearActiveRun: () => void;
  isRunExpired: () => boolean;
  getRunExpiryHours: () => number;
  getSavedRunExpiryHours: (runId: string) => number;
  exportData: () => Promise<string>;
  importData: (jsonStr: string) => Promise<boolean>;
}

const FlightContext = createContext<FlightContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────
export function FlightManualProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [viewMode, setViewModeState] = useState<DashboardViewMode>('list');

  // Log configuration state on mount for debugging
  useEffect(() => {
    logConfigState();
  }, []);

  // Hydrate view mode from storage
  useEffect(() => {
    (async () => {
      try {
        const savedViewMode = await safeGetItemWithFallback<DashboardViewMode>(KEYS.VIEW_MODE, 'list');
        setViewModeState(savedViewMode);
      } catch (e) {
        console.error('[FlightManual] Failed to load view mode:', e);
      }
    })();
  }, []);

  // Hydrate with safe AsyncStorage fallback and config-based expiry cleanup for saved runs
  useEffect(() => {
    (async () => {
      try {
        const collections = await safeGetItemWithFallback<Collection[]>(KEYS.COLLECTIONS, SEED_COLLECTIONS);
        const templates = await safeGetItemWithFallback<Template[]>(KEYS.TEMPLATES, []);
        let activeRun = await safeGetItemWithFallback<RunInstance | null>(KEYS.ACTIVE_RUN, null);
        let savedRuns = await safeGetItemWithFallback<RunInstance[]>(KEYS.SAVED_RUNS, []);
        const historyLogs = await safeGetItemWithFallback<RunLog[]>(KEYS.RUN_LOGS, SEED_LOGS);

        const now = Date.now();

        // Garbage collection: Check if active run has expired (config-based threshold)
        if (activeRun && activeRun.expiresAt && checkRunExpired(activeRun.expiresAt)) {
          console.log('[FlightManual] Active run expired, clearing...');
          activeRun = null;
          await safeRemoveItem(KEYS.ACTIVE_RUN);
        }

        // Garbage collection: Filter out expired saved runs (sweeps on boot)
        const initialCount = savedRuns.length;
        const validSavedRuns = savedRuns.filter(run => {
          if (run.expiresAt && checkRunExpired(run.expiresAt)) {
            console.log(`[FlightManual] Saved run "${run.customName || 'Unnamed'}" expired, removing...`);
            return false;
          }
          return true;
        });

        // Log how many stale runs were swept away
        const sweptCount = initialCount - validSavedRuns.length;
        if (sweptCount > 0) {
          console.log(`[FlightManual] Garbage collection: Swept away ${sweptCount} expired saved run${sweptCount !== 1 ? 's' : ''}`);
        }

        // Persist cleaned saved runs if any were removed
        if (validSavedRuns.length !== savedRuns.length) {
          await safeSetItem(KEYS.SAVED_RUNS, validSavedRuns);
          savedRuns = validSavedRuns;
        }

        dispatch({
          type: 'HYDRATE',
          payload: { collections, templates, activeRun, savedRuns, historyLogs },
        });
      } catch (error) {
        console.error('[FlightManual] Hydration failed, using seed data:', error);
        dispatch({
          type: 'HYDRATE',
          payload: {
            collections: SEED_COLLECTIONS,
            templates: [],
            activeRun: null,
            savedRuns: [],
            historyLogs: SEED_LOGS
          },
        });
      }
    })();
  }, []);

  // Persist all state changes with safe fallback
  useEffect(() => {
    if (state.isLoading) return;

    (async () => {
      try {
        // Handle activeRun null case for deletion
        if (state.activeRun === null) {
          await safeRemoveItem(KEYS.ACTIVE_RUN);
        } else {
          await safeSetItem(KEYS.ACTIVE_RUN, state.activeRun);
        }

        // Persist saved runs array
        await safeSetItem(KEYS.SAVED_RUNS, state.savedRuns);

        await Promise.all([
          safeSetItem(KEYS.COLLECTIONS, state.collections),
          safeSetItem(KEYS.TEMPLATES, state.templates),
          safeSetItem(KEYS.RUN_LOGS, state.historyLogs),
        ]);
      } catch (error) {
        console.error('[FlightManual] Persistence failed, continuing with in-memory state:', error);
      }
    })();
  }, [state.collections, state.templates, state.activeRun, state.savedRuns, state.historyLogs, state.isLoading]);

  // ─── View Mode Management ─────────────────────────────────
  const setViewMode = useCallback(async (mode: DashboardViewMode) => {
    setViewModeState(mode);
    try {
      await safeSetItem(KEYS.VIEW_MODE, mode);
    } catch (e) {
      console.error('[FlightManual] Failed to persist view mode:', e);
    }
  }, []);

  // ─── Export/Import Data Management ────────────────────────
  const exportData = useCallback(async (): Promise<string> => {
    const backup: FlightManualBackup = {
      version: '9.0.0',
      exportedAt: Date.now(),
      collections: state.collections,
      templates: state.templates,
      historyLogs: state.historyLogs,
      savedRuns: state.savedRuns,
    };
    return JSON.stringify(backup, null, 2);
  }, [state.collections, state.templates, state.historyLogs, state.savedRuns]);

  const importData = useCallback(async (jsonStr: string): Promise<boolean> => {
    try {
      // Parse the JSON string
      const parsed = JSON.parse(jsonStr) as unknown;

      // Validate the structure
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON: not an object');
      }

      const backup = parsed as FlightManualBackup;

      // Validate required fields
      if (!backup.version || typeof backup.version !== 'string') {
        throw new Error('Invalid backup: missing or invalid version');
      }

      if (!Array.isArray(backup.collections)) {
        throw new Error('Invalid backup: collections must be an array');
      }

      if (!Array.isArray(backup.templates)) {
        throw new Error('Invalid backup: templates must be an array');
      }

      if (!Array.isArray(backup.historyLogs)) {
        throw new Error('Invalid backup: historyLogs must be an array');
      }

      // savedRuns is optional for backwards compatibility
      if (backup.savedRuns && !Array.isArray(backup.savedRuns)) {
        throw new Error('Invalid backup: savedRuns must be an array');
      }

      // Validate collection structure
      for (const col of backup.collections) {
        if (!col.id || !col.name || !Array.isArray(col.steps)) {
          throw new Error('Invalid backup: malformed collection data');
        }
      }

      // Validate template structure
      for (const tpl of backup.templates) {
        if (!tpl.id || !tpl.title || !Array.isArray(tpl.templateIds)) {
          throw new Error('Invalid backup: malformed template data');
        }
      }

      // Update the store state
      dispatch({
        type: 'REPLACE_ALL_DATA',
        payload: {
          collections: backup.collections,
          templates: backup.templates,
          historyLogs: backup.historyLogs,
        },
      });

      // Import saved runs if present
      if (backup.savedRuns) {
        const now = Date.now();
        const validSavedRuns = backup.savedRuns.filter(run => run.expiresAt && run.expiresAt > now);
        // Set saved runs through a separate dispatch
        for (const run of validSavedRuns) {
          if (run.customName) {
            dispatch({ type: 'SAVE_RUN_FOR_LATER', payload: { run, name: run.customName } });
          }
        }
      }

      // Persist to AsyncStorage
      await Promise.all([
        safeSetItem(KEYS.COLLECTIONS, backup.collections),
        safeSetItem(KEYS.TEMPLATES, backup.templates),
        safeSetItem(KEYS.RUN_LOGS, backup.historyLogs),
      ]);

      console.log('[FlightManual] Data import successful');
      return true;
    } catch (error) {
      console.error('[FlightManual] Import failed:', error);
      return false;
    }
  }, []);

  // ─── Actions ──────────────────────────────────────────────
  const compileAndStartRun = useCallback(
    (id: string, isTemplate: boolean) => {
      let collectionIds: string[] = [];

      if (isTemplate) {
        const template = state.templates.find((t) => t.id === id);
        if (!template) return;
        collectionIds = template.templateIds;
      } else {
        collectionIds = [id];
      }

      const compiledSteps: CompiledStep[] = [];
      const seenIds = new Set<string>();

      for (const cId of collectionIds) {
        const collection = state.collections.find((c) => c.id === cId);
        if (!collection) continue;

        const isParallel = collection.executionMode === 'parallel';
        const steps = collection.steps.map((s, i) => {
          const uniqueId = seenIds.has(s.id) ? `${cId}::${s.id}` : s.id;
          seenIds.add(uniqueId);
          return {
            ...s,
            id: uniqueId,
            isCompleted: false,
            isLocked: isParallel ? false : i !== 0,
            dependsOnStepId: !isParallel && i > 0
              ? (seenIds.has(collection.steps[i - 1].id)
                ? `${cId}::${collection.steps[i - 1].id}`
                : collection.steps[i - 1].id)
              : undefined,
            parentTemplateName: collection.name,
            executionMode: collection.executionMode,
          } as CompiledStep;
        });
        compiledSteps.push(...steps);
      }

      dispatch({
        type: 'START_RUN',
        payload: {
          id: `run_${Date.now()}`,
          startedAt: Date.now(),
          currentSteps: compiledSteps,
          isFinished: false,
        },
      });
    },
    [state.collections, state.templates],
  );

  const appendCollectionToActiveRun = useCallback(
    (collectionId: string) => {
      if (!state.activeRun) return;
      const collection = state.collections.find((c) => c.id === collectionId);
      if (!collection) return;

      const isParallel = collection.executionMode === 'parallel';
      const seenIds = new Set(state.activeRun.currentSteps.map((s) => s.id));

      const newSteps: CompiledStep[] = collection.steps.map((s, i) => {
        const uniqueId = seenIds.has(s.id) ? `${collectionId}::${s.id}` : s.id;
        seenIds.add(uniqueId);
        return {
          ...s,
          id: uniqueId,
          isCompleted: false,
          isLocked: isParallel ? false : i !== 0,
          dependsOnStepId: !isParallel && i > 0
            ? (seenIds.has(collection.steps[i - 1].id)
              ? `${collectionId}::${collection.steps[i - 1].id}`
              : collection.steps[i - 1].id)
            : undefined,
          parentTemplateName: collection.name,
          executionMode: collection.executionMode,
        } as CompiledStep;
      });

      dispatch({
        type: 'APPEND_STEPS',
        payload: newSteps,
      });
    },
    [state.activeRun, state.collections],
  );

  const toggleStep = useCallback((stepId: string) => {
    dispatch({ type: 'TOGGLE_STEP', payload: stepId });
  }, []);

  const completeRun = useCallback(async (savedRunId?: string) => {
    if (!state.activeRun) return;

    const log: RunLog = {
      collectionId: state.activeRun.currentSteps[0]?.parentTemplateName ?? 'unknown',
      timestamp: Date.now(),
      durationMs: Date.now() - state.activeRun.startedAt,
    };

    dispatch({ type: 'COMPLETE_RUN', payload: { log, savedRunId } });

    // Immediate AsyncStorage commit for both logs and saved runs
    try {
      // Update run logs
      const logsRaw = await AsyncStorage.getItem(KEYS.RUN_LOGS);
      const existingLogs: RunLog[] = logsRaw ? JSON.parse(logsRaw) : [];
      await AsyncStorage.setItem(KEYS.RUN_LOGS, JSON.stringify([...existingLogs, log]));

      // If savedRunId provided, scrub it from saved runs
      if (savedRunId) {
        const savedRaw = await AsyncStorage.getItem(KEYS.SAVED_RUNS);
        const savedRuns: RunInstance[] = savedRaw ? JSON.parse(savedRaw) : [];
        const cleaned = savedRuns.filter((sr) => sr.id !== savedRunId);
        await AsyncStorage.setItem(KEYS.SAVED_RUNS, JSON.stringify(cleaned));
        console.log('[FlightManual] Completed saved run scrubbed from pending registry:', savedRunId);
      }
    } catch (e) {
      console.error('[FlightManual] completeRun persist failed:', e);
    }
  }, [state.activeRun]);

  const saveActiveRunAsTemplate = useCallback(
    async (title: string, description: string) => {
      if (!state.activeRun) return;

      const uniqueNames = [...new Set(state.activeRun.currentSteps.map((s) => s.parentTemplateName))];
      const collectionIds = uniqueNames
        .map((name) => state.collections.find((c) => c.name === name)?.id)
        .filter((id): id is string => !!id);

      if (collectionIds.length < 2) return;

      const template: Template = {
        id: `tpl_${Date.now()}`,
        title,
        description: description || undefined,
        templateIds: collectionIds,
      };

      dispatch({ type: 'SAVE_TEMPLATE', payload: template });

      try {
        const current = await safeGetItemWithFallback<Template[]>(KEYS.TEMPLATES, []);
        await safeSetItem(KEYS.TEMPLATES, [...current, template]);
      } catch (e) {
        console.error('[FlightManual] saveActiveRunAsTemplate failed:', e);
      }
    },
    [state.activeRun, state.collections],
  );

  const saveCustomCollection = useCallback(
    async (
      name: string,
      description: string,
      tags: string[],
      stepTexts: string[],
      executionMode: ExecutionMode,
    ) => {
      const id = `col_${Date.now()}`;

      const steps: Step[] = stepTexts.map((text, i) => ({
        id: `step_${id}_${i}`,
        text,
        isCompleted: false,
        isLocked: false,
        dependsOnStepId: i > 0 ? `step_${id}_${i - 1}` : undefined,
      }));

      const collection: Collection = {
        id,
        name,
        description: description || undefined,
        tags,
        executionMode,
        steps,
      };
      dispatch({ type: 'SAVE_COLLECTION', payload: collection });

      try {
        const current = await safeGetItemWithFallback<Collection[]>(KEYS.COLLECTIONS, []);
        await safeSetItem(KEYS.COLLECTIONS, [...current, collection]);
      } catch (e) {
        console.error('[FlightManual] saveCustomCollection failed:', e);
      }
    },
    [],
  );

  const updateCollection = useCallback(
    async (
      id: string,
      name: string,
      description: string,
      tags: string[],
      executionMode: ExecutionMode,
      stepTexts: string[],
    ) => {
      // Rebuild steps array from texts
      const steps: Step[] = stepTexts.map((text, i) => ({
        id: `step_${id}_${i}`,
        text,
        isCompleted: false,
        isLocked: false,
        dependsOnStepId: i > 0 ? `step_${id}_${i - 1}` : undefined,
      }));

      dispatch({
        type: 'UPDATE_COLLECTION',
        payload: { id, name, description, tags, executionMode, steps },
      });

      // Persist to AsyncStorage
      try {
        const updatedCollections = state.collections.map(col =>
          col.id === id
            ? { ...col, name, description, tags, executionMode, steps }
            : col
        );
        await safeSetItem(KEYS.COLLECTIONS, updatedCollections);
      } catch (e) {
        console.error('[FlightManual] updateCollection failed:', e);
      }
    },
    [state.collections],
  );

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      dispatch({ type: 'DELETE_TEMPLATE', payload: templateId });

      try {
        const current = await safeGetItemWithFallback<Template[]>(KEYS.TEMPLATES, []);
        const filtered = current.filter((t) => t.id !== templateId);
        await safeSetItem(KEYS.TEMPLATES, filtered);
      } catch (e) {
        console.error('[FlightManual] deleteTemplate failed:', e);
      }
    },
    [],
  );

  const deleteCollection = useCallback(
    async (collectionId: string) => {
      dispatch({ type: 'DELETE_COLLECTION', payload: collectionId });

      try {
        const current = await safeGetItemWithFallback<Collection[]>(KEYS.COLLECTIONS, []);
        const filtered = current.filter((c) => c.id !== collectionId);
        await safeSetItem(KEYS.COLLECTIONS, filtered);
      } catch (e) {
        console.error('[FlightManual] deleteCollection failed:', e);
      }
    },
    [],
  );

  // Save current run for later with custom name (uses dynamic config-based expiry)
  const saveCurrentRunForLater = useCallback((name: string) => {
    if (!state.activeRun) return;
    dispatch({ type: 'SAVE_RUN_FOR_LATER', payload: { run: state.activeRun, name } });
  }, [state.activeRun]);

  // Update a saved run (used when exiting a resumed run - autosaves progress in place)
  // CRITICAL: This persists the updated state immediately to AsyncStorage
  // to ensure the saved run database stays in sync even if the app is killed.
  // Plan 22: Fixed to ensure immediate physical storage write
  const updateSavedRun = useCallback(async (id: string, steps: CompiledStep[]) => {
    if (!state.activeRun?.savedRunId) return;

    const savedRunId = state.activeRun.savedRunId;
    const currentSteps = state.activeRun.currentSteps.map((s) => ({ ...s }));

    // 1. Update React state via reducer (immutable)
    dispatch({ type: 'UPDATE_SAVED_RUN', payload: { id: savedRunId, steps: currentSteps } });

    // 2. Immediate AsyncStorage commit — don't rely on useEffect cycle
    // This ensures hardware file-system persistence before navigation
    try {
      // Read raw string directly from AsyncStorage (no parsing yet)
      const rawString = await AsyncStorage.getItem(KEYS.SAVED_RUNS);
      const runs: RunInstance[] = rawString ? JSON.parse(rawString) : [];
      const updated = runs.map((sr) =>
        sr.id === savedRunId
          ? {
              ...sr,
              currentSteps,
              savedAt: Date.now(),
            }
          : sr
      );
      await safeSetItem(KEYS.SAVED_RUNS, updated);
      console.log('[FlightManual] Saved run state persisted to AsyncStorage immediately');
    } catch (e) {
      console.error('[FlightManual] updateSavedRun persist failed:', e);
    }
  }, [state.activeRun]);

  // Resume a saved run by ID (sets savedRunId for back-guard detection)
  const resumeSavedRun = useCallback((id: string) => {
    const savedRun = state.savedRuns.find(r => r.id === id);
    if (!savedRun) return;

    // Verify not expired before resuming
    if (savedRun.expiresAt && checkRunExpired(savedRun.expiresAt)) {
      console.log('[FlightManual] Cannot resume expired run');
      return;
    }

    dispatch({ type: 'RESUME_SPECIFIC_RUN', payload: savedRun });
  }, [state.savedRuns]);

  // Delete a saved run
  const deleteSavedRun = useCallback((runId: string) => {
    dispatch({ type: 'DELETE_SAVED_RUN', payload: runId });
  }, []);

  // Clear active run (used for abandoning fresh runs)
  const clearActiveRun = useCallback(() => {
    dispatch({ type: 'CLEAR_ACTIVE_RUN' });
  }, []);

  // Check if current run is expired
  const isRunExpired = useCallback(() => {
    if (!state.activeRun || !state.activeRun.expiresAt) return false;
    return Date.now() > state.activeRun.expiresAt;
  }, [state.activeRun]);

  // Get remaining hours before expiry for active run
  const getRunExpiryHours = useCallback(() => {
    if (!state.activeRun || !state.activeRun.expiresAt) return 0;
    const remainingMs = state.activeRun.expiresAt - Date.now();
    return Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
  }, [state.activeRun]);

  // Get remaining hours for a specific saved run
  const getSavedRunExpiryHours = useCallback((runId: string) => {
    const savedRun = state.savedRuns.find(r => r.id === runId);
    if (!savedRun || !savedRun.expiresAt) return 0;
    const remainingMs = savedRun.expiresAt - Date.now();
    return Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
  }, [state.savedRuns]);

  return (
    <FlightContext.Provider
      value={{
        state,
        viewMode,
        setViewMode,
        compileAndStartRun,
        toggleStep,
        completeRun,
        appendCollectionToActiveRun,
        saveActiveRunAsTemplate,
        saveCustomCollection,
        updateCollection,
        deleteTemplate,
        deleteCollection,
        saveCurrentRunForLater,
        updateSavedRun,
        resumeSavedRun,
        deleteSavedRun,
        clearActiveRun,
        isRunExpired,
        getRunExpiryHours,
        getSavedRunExpiryHours,
        exportData,
        importData,
      }}
    >
      {children}
    </FlightContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────
export function useFlightManual(): FlightContextValue {
  const ctx = useContext(FlightContext);
  if (!ctx) throw new Error('useFlightManual must be used within FlightManualProvider');
  return ctx;
}

// ─── Legacy exports for backward compatibility ──────────────
export { useFlightManual as useStore, FlightManualProvider as StoreProvider };
