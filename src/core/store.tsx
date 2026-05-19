// src/core/store.tsx — V8.4 Multi-Instance Saved Runs & Enhanced Features
import { createContext, useContext, useReducer, useEffect, useCallback, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const KEYS = {
  collections: 'flightmanual::collections',
  templates: 'flightmanual::templates',
  activeRun: 'flightmanual::active_run',
  savedRuns: 'flightmanual::saved_runs',
  runLogs: 'flightmanual::run_logs',
  viewMode: 'flightmanual::view_mode',
} as const;

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

// ─── Actions ────────────────────────────────────────────────
type Action =
  | { type: 'HYDRATE'; payload: { collections: Collection[]; templates: Template[]; activeRun: RunInstance | null; savedRuns: RunInstance[]; historyLogs: RunLog[] } }
  | { type: 'START_RUN'; payload: RunInstance }
  | { type: 'TOGGLE_STEP'; payload: string }
  | { type: 'COMPLETE_RUN'; payload: RunLog }
  | { type: 'APPEND_STEPS'; payload: CompiledStep[] }
  | { type: 'SAVE_TEMPLATE'; payload: Template }
  | { type: 'SAVE_COLLECTION'; payload: Collection }
  | { type: 'UPDATE_COLLECTION'; payload: { id: string; name: string; description: string; tags: string[]; executionMode: ExecutionMode; steps: Step[] } }
  | { type: 'DELETE_TEMPLATE'; payload: string }
  | { type: 'DELETE_COLLECTION'; payload: string }
  | { type: 'SAVE_RUN_FOR_LATER'; payload: { run: RunInstance; name: string } }
  | { type: 'RESUME_SPECIFIC_RUN'; payload: RunInstance }
  | { type: 'DELETE_SAVED_RUN'; payload: string }
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
async function safeGetItem<T>(key: string, fallback: T): Promise<T> {
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

    case 'COMPLETE_RUN':
      return {
        ...state,
        activeRun: null,
        historyLogs: [...state.historyLogs, action.payload],
      };

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
      const runWithName: RunInstance = {
        ...run,
        customName: name,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
      };
      return {
        ...state,
        activeRun: null,
        savedRuns: [...state.savedRuns, runWithName],
      };
    }

    case 'RESUME_SPECIFIC_RUN':
      return {
        ...state,
        activeRun: action.payload,
        savedRuns: state.savedRuns.filter(r => r.id !== action.payload.id),
      };

    case 'DELETE_SAVED_RUN':
      return {
        ...state,
        savedRuns: state.savedRuns.filter(r => r.id !== action.payload),
      };

    case 'CLEAR_EXPIRED_RUNS': {
      const now = Date.now();
      return {
        ...state,
        savedRuns: state.savedRuns.filter(run => run.expiresAt > now),
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
  completeRun: () => void;
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
  resumeSpecificRun: (runId: string) => void;
  deleteSavedRun: (runId: string) => void;
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

  // Hydrate view mode from storage
  useEffect(() => {
    (async () => {
      try {
        const savedViewMode = await safeGetItem<DashboardViewMode>(KEYS.viewMode, 'list');
        setViewModeState(savedViewMode);
      } catch (e) {
        console.error('[FlightManual] Failed to load view mode:', e);
      }
    })();
  }, []);

  // Hydrate with safe AsyncStorage fallback and 24-hour expiry cleanup for saved runs
  useEffect(() => {
    (async () => {
      try {
        const collections = await safeGetItem<Collection[]>(KEYS.collections, SEED_COLLECTIONS);
        const templates = await safeGetItem<Template[]>(KEYS.templates, []);
        let activeRun = await safeGetItem<RunInstance | null>(KEYS.activeRun, null);
        let savedRuns = await safeGetItem<RunInstance[]>(KEYS.savedRuns, []);
        const historyLogs = await safeGetItem<RunLog[]>(KEYS.runLogs, SEED_LOGS);

        const now = Date.now();

        // Garbage collection: Check if active run has expired (24-hour limit)
        if (activeRun && activeRun.expiresAt) {
          if (now > activeRun.expiresAt) {
            console.log('[FlightManual] Active run expired, clearing...');
            activeRun = null;
            await safeRemoveItem(KEYS.activeRun);
          }
        }

        // Garbage collection: Filter out expired saved runs
        const validSavedRuns = savedRuns.filter(run => {
          if (now > run.expiresAt) {
            console.log(`[FlightManual] Saved run "${run.customName}" expired, removing...`);
            return false;
          }
          return true;
        });

        // Persist cleaned saved runs if any were removed
        if (validSavedRuns.length !== savedRuns.length) {
          await safeSetItem(KEYS.savedRuns, validSavedRuns);
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
          await safeRemoveItem(KEYS.activeRun);
        } else {
          await safeSetItem(KEYS.activeRun, state.activeRun);
        }

        // Persist saved runs array
        await safeSetItem(KEYS.savedRuns, state.savedRuns);

        await Promise.all([
          safeSetItem(KEYS.collections, state.collections),
          safeSetItem(KEYS.templates, state.templates),
          safeSetItem(KEYS.runLogs, state.historyLogs),
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
      await safeSetItem(KEYS.viewMode, mode);
    } catch (e) {
      console.error('[FlightManual] Failed to persist view mode:', e);
    }
  }, []);

  // ─── Export/Import Data Management ────────────────────────
  const exportData = useCallback(async (): Promise<string> => {
    const backup: FlightManualBackup = {
      version: '8.4.0',
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
        const validSavedRuns = backup.savedRuns.filter(run => run.expiresAt > now);
        // Set saved runs through a separate dispatch
        for (const run of validSavedRuns) {
          dispatch({ type: 'SAVE_RUN_FOR_LATER', payload: { run, name: run.customName } });
        }
      }

      // Persist to AsyncStorage
      await Promise.all([
        safeSetItem(KEYS.collections, backup.collections),
        safeSetItem(KEYS.templates, backup.templates),
        safeSetItem(KEYS.runLogs, backup.historyLogs),
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
          customName: '',
          expiresAt: 0, // Not set for active runs
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

  const completeRun = useCallback(() => {
    if (!state.activeRun) return;
    dispatch({
      type: 'COMPLETE_RUN',
      payload: {
        collectionId: 'combined_run',
        timestamp: Date.now(),
        durationMs: Date.now() - state.activeRun.startedAt,
      },
    });
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
        const current = await safeGetItem<Template[]>(KEYS.templates, []);
        await safeSetItem(KEYS.templates, [...current, template]);
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
        const current = await safeGetItem<Collection[]>(KEYS.collections, []);
        await safeSetItem(KEYS.collections, [...current, collection]);
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
        await safeSetItem(KEYS.collections, updatedCollections);
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
        const current = await safeGetItem<Template[]>(KEYS.templates, []);
        const filtered = current.filter((t) => t.id !== templateId);
        await safeSetItem(KEYS.templates, filtered);
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
        const current = await safeGetItem<Collection[]>(KEYS.collections, []);
        const filtered = current.filter((c) => c.id !== collectionId);
        await safeSetItem(KEYS.collections, filtered);
      } catch (e) {
        console.error('[FlightManual] deleteCollection failed:', e);
      }
    },
    [],
  );

  // Save current run for later with custom name
  const saveCurrentRunForLater = useCallback((name: string) => {
    if (!state.activeRun) return;
    dispatch({ type: 'SAVE_RUN_FOR_LATER', payload: { run: state.activeRun, name } });
  }, [state.activeRun]);

  // Resume a specific saved run
  const resumeSpecificRun = useCallback((runId: string) => {
    const savedRun = state.savedRuns.find(r => r.id === runId);
    if (!savedRun) return;

    // Verify not expired before resuming
    if (Date.now() > savedRun.expiresAt) {
      console.log('[FlightManual] Cannot resume expired run');
      return;
    }

    dispatch({ type: 'RESUME_SPECIFIC_RUN', payload: savedRun });
  }, [state.savedRuns]);

  // Delete a saved run
  const deleteSavedRun = useCallback((runId: string) => {
    dispatch({ type: 'DELETE_SAVED_RUN', payload: runId });
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
    if (!savedRun) return 0;
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
        resumeSpecificRun,
        deleteSavedRun,
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
