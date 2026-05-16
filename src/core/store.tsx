// src/core/store.tsx
import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Template, RunInstance, RunLog, Step } from './types';

// ─── Storage keys ───────────────────────────────────────────
const KEYS = {
  templates: 'flightmanual::templates',
  activeRun: 'flightmanual::active_run',
  runLogs: 'flightmanual::run_logs',
} as const;

// ─── Seed data (from gemini_manual-02-app-data.md) ─────────
const SEED_TEMPLATES: Template[] = [
  {
    id: 'tpl_gym_prep',
    name: 'Gym Session Prep',
    tags: ['fitness', 'daily'],
    baseSteps: [
      { id: 'step_1', text: 'Fill up 1.5L water bottle', isCompleted: false, isLocked: false },
      { id: 'step_2', text: 'Pack lifting belt and clean towel into gym bag', isCompleted: false, isLocked: true, dependsOnStepId: 'step_1' },
      { id: 'step_3', text: 'Verify wireless headphones are charged > 50%', isCompleted: false, isLocked: true, dependsOnStepId: 'step_2' },
    ],
    branchingStep: {
      question: 'What focus group are we destroying today?',
      options: {
        legs: [
          { id: 'branch_leg_1', text: 'Pre-pack squat shoes and knee sleeves', isCompleted: false, isLocked: true, dependsOnStepId: 'step_3' },
          { id: 'branch_leg_2', text: 'Consume non-stimulant pre-workout pump formula', isCompleted: false, isLocked: true, dependsOnStepId: 'branch_leg_1' },
        ],
        core: [
          { id: 'branch_core_1', text: 'Roll out yoga mat and grab resistance bands', isCompleted: false, isLocked: true, dependsOnStepId: 'step_3' },
          { id: 'branch_core_2', text: 'Take multi-vitamin dose with light carb snack', isCompleted: false, isLocked: true, dependsOnStepId: 'branch_core_1' },
        ],
      },
    },
  },
];

// Late-afternoon timestamps (~17:00) for testing the time-weighted engine
const SEED_LOGS: RunLog[] = [
  { templateId: 'tpl_gym_prep', timestamp: 1778950800000, durationMs: 420000 },
  { templateId: 'tpl_gym_prep', timestamp: 1779037200000, durationMs: 380000 },
  { templateId: 'tpl_gym_prep', timestamp: 1779123600000, durationMs: 510000 },
  { templateId: 'tpl_work_setup', timestamp: 1779094800000, durationMs: 210000 },
];

// ─── State shape ────────────────────────────────────────────
interface FlightState {
  templates: Template[];
  activeRun: RunInstance | null;
  historyLogs: RunLog[];
  isLoading: boolean;
}

// ─── Actions ────────────────────────────────────────────────
type Action =
  | { type: 'HYDRATE'; payload: { templates: Template[]; activeRun: RunInstance | null; historyLogs: RunLog[] } }
  | { type: 'START_RUN'; payload: RunInstance }
  | { type: 'SELECT_BRANCH'; payload: { optionKey: string; steps: Step[] } }
  | { type: 'TOGGLE_STEP'; payload: string }
  | { type: 'COMPLETE_RUN'; payload: RunLog };

// ─── Helpers ────────────────────────────────────────────────
function cloneSteps(steps: Step[]): Step[] {
  return steps.map((s) => ({ ...s }));
}

// ─── Reducer ────────────────────────────────────────────────
const initialState: FlightState = {
  templates: [],
  activeRun: null,
  historyLogs: [],
  isLoading: true,
};

function reducer(state: FlightState, action: Action): FlightState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...action.payload, isLoading: false };

    case 'START_RUN':
      return { ...state, activeRun: action.payload };

    case 'SELECT_BRANCH': {
      if (!state.activeRun) return state;
      const { optionKey, steps } = action.payload;
      const injected = cloneSteps(steps);
      // Unlock the first branch step
      if (injected.length > 0) injected[0].isLocked = false;
      return {
        ...state,
        activeRun: {
          ...state.activeRun,
          currentSteps: [...state.activeRun.currentSteps, ...injected],
          selectedBranch: optionKey,
        },
      };
    }

    case 'TOGGLE_STEP': {
      if (!state.activeRun) return state;
      const stepId = action.payload;
      const steps = state.activeRun.currentSteps.map((s) =>
        s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s,
      );
      // Unlock dependents when toggled ON
      const toggled = steps.find((s) => s.id === stepId);
      if (toggled?.isCompleted) {
        for (let i = 0; i < steps.length; i++) {
          if (steps[i].dependsOnStepId === stepId) {
            steps[i] = { ...steps[i], isLocked: false };
          }
        }
      }
      const allDone = steps.every((s) => s.isCompleted);
      return { ...state, activeRun: { ...state.activeRun, currentSteps: steps, isFinished: allDone } };
    }

    case 'COMPLETE_RUN':
      return {
        ...state,
        activeRun: null,
        historyLogs: [...state.historyLogs, action.payload],
      };

    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────
interface FlightContextValue {
  state: FlightState;
  startRun: (templateId: string) => void;
  selectBranch: (optionKey: string) => void;
  toggleStep: (stepId: string) => void;
  completeRun: () => void;
}

const FlightContext = createContext<FlightContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────
export function FlightManualProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate on mount
  useEffect(() => {
    (async () => {
      try {
        const [tplJson, runJson, logsJson] = await Promise.all([
          AsyncStorage.getItem(KEYS.templates),
          AsyncStorage.getItem(KEYS.activeRun),
          AsyncStorage.getItem(KEYS.runLogs),
        ]);
        dispatch({
          type: 'HYDRATE',
          payload: {
            templates: tplJson ? JSON.parse(tplJson) : SEED_TEMPLATES,
            activeRun: runJson && runJson !== '' ? JSON.parse(runJson) : null,
            historyLogs: logsJson ? JSON.parse(logsJson) : SEED_LOGS,
          },
        });
      } catch (e) {
        // Check if it's an AsyncStorage native module error
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (errorMessage.includes('Native module is null')) {
          console.warn('[FlightManual] AsyncStorage not available, using in-memory storage only');
          console.warn('[FlightManual] Run: npx expo run:ios or npx expo run:android to rebuild');
        } else {
          console.error('[FlightManual] Hydration failed:', e);
        }
        // Fallback to seed data
        dispatch({
          type: 'HYDRATE',
          payload: { templates: SEED_TEMPLATES, activeRun: null, historyLogs: SEED_LOGS },
        });
      }
    })();
  }, []);

  // Persist on change
  useEffect(() => {
    if (state.isLoading) return;
    (async () => {
      try {
        // Store null as empty string, convert back on hydration
        const activeRunValue = state.activeRun ? JSON.stringify(state.activeRun) : '';
        await Promise.all([
          AsyncStorage.setItem(KEYS.templates, JSON.stringify(state.templates)),
          AsyncStorage.setItem(KEYS.activeRun, activeRunValue),
          AsyncStorage.setItem(KEYS.runLogs, JSON.stringify(state.historyLogs)),
        ]);
      } catch (e) {
        // Silent fail for persist errors - app continues with in-memory state
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (errorMessage.includes('Native module is null')) {
          // Only log once per session
          if (Math.random() < 0.01) {
            console.warn('[FlightManual] AsyncStorage persistence unavailable - rebuild dev client with: npx expo run:ios');
          }
        }
      }
    })();
  }, [state.templates, state.activeRun, state.historyLogs, state.isLoading]);

  // ─── Actions ──────────────────────────────────────────────
  const startRun = useCallback(
    (templateId: string) => {
      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return;
      const steps = cloneSteps(template.baseSteps).map((s, i) => ({
        ...s,
        isLocked: i !== 0,
      }));
      const instance: RunInstance = {
        id: `run_${Date.now()}`,
        templateId,
        startedAt: Date.now(),
        currentSteps: steps,
        isFinished: false,
      };
      dispatch({ type: 'START_RUN', payload: instance });
    },
    [state.templates],
  );

  const selectBranch = useCallback(
    (optionKey: string) => {
      if (!state.activeRun) return;
      if (state.activeRun.selectedBranch) return; // already chosen
      const template = state.templates.find((t) => t.id === state.activeRun!.templateId);
      if (!template?.branchingStep) return;
      const branchSteps = template.branchingStep.options[optionKey];
      if (!branchSteps) return;
      dispatch({ type: 'SELECT_BRANCH', payload: { optionKey, steps: branchSteps } });
    },
    [state.activeRun, state.templates],
  );

  const toggleStep = useCallback((stepId: string) => {
    dispatch({ type: 'TOGGLE_STEP', payload: stepId });
  }, []);

  const completeRun = useCallback(() => {
    if (!state.activeRun) return;
    const log: RunLog = {
      templateId: state.activeRun.templateId,
      timestamp: Date.now(),
      durationMs: Date.now() - state.activeRun.startedAt,
    };
    dispatch({ type: 'COMPLETE_RUN', payload: log });
  }, [state.activeRun]);

  return (
    <FlightContext.Provider value={{ state, startRun, selectBranch, toggleStep, completeRun }}>
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
