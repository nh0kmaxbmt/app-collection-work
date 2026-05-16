# 02 — State Management Engine

## Source
`docs/gemini-archive/gemini-02-State Management Engine.txt`

## Feature Description
Central state store for the app. Manages templates, the active run instance, and history logs. Persists to storage and exposes actions to start runs, toggle steps, select branches, and complete runs with a clean reset.

## Requirements
1. Persist: templates, `activeRun` (RunInstance | null), `historyLogs` (RunLog[])
2. `loadTemplates()` — loads mock data including a "Gym Session" template with Legs/Core branches
3. `startRun(templateId)` — instantiates a template into `activeRun`, sets `startedAt`
4. `toggleStep(stepId)` — marks a step complete; evaluates dependencies to unlock the next linear step
5. `selectBranch(optionKey)` — injects conditional steps into `currentSteps` based on user selection
6. `completeRun()` — calculates duration, appends to `historyLogs`, clears `activeRun` to null

## Adaptation Notes (Expo / React Native)
- **Storage:** Use `@react-native-async-storage/async-storage` instead of `window.localStorage`. This package must be installed (`npx expo install @react-native-async-storage/async-storage`).
- **Context:** React Context + `useReducer` pattern works identically in RN.
- **JSON serialization:** `AsyncStorage` only stores strings — always `JSON.stringify` / `JSON.parse`.

---

## Sample Code: `src/core/store.ts`

```typescript
// src/core/store.ts
import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Template, RunInstance, RunLog, Step } from './types';

// --- Storage keys ---
const STORAGE_KEYS = {
  templates: '@flightmanual/templates',
  activeRun: '@flightmanual/activeRun',
  historyLogs: '@flightmanual/historyLogs',
} as const;

// --- Mock data ---
function createMockTemplates(): Template[] {
  return [
    {
      id: 'gym-session',
      name: 'Gym Session',
      tags: ['fitness', 'daily'],
      baseSteps: [
        { id: 'gym-1', text: 'Fill water bottle', isCompleted: false, isLocked: true },
        { id: 'gym-2', text: 'Put on workout gear', isCompleted: false, isLocked: true, dependsOnStepId: 'gym-1' },
        { id: 'gym-3', text: 'Drive to gym', isCompleted: false, isLocked: true, dependsOnStepId: 'gym-2' },
      ],
      branchingStep: {
        question: 'Select routine:',
        options: {
          Legs: [
            { id: 'legs-1', text: 'Warm-up: 5 min treadmill', isCompleted: false, isLocked: true },
            { id: 'legs-2', text: 'Squats — 4×8', isCompleted: false, isLocked: true, dependsOnStepId: 'legs-1' },
            { id: 'legs-3', text: 'Romanian Deadlifts — 3×10', isCompleted: false, isLocked: true, dependsOnStepId: 'legs-2' },
            { id: 'legs-4', text: 'Lunges — 3×12 each leg', isCompleted: false, isLocked: true, dependsOnStepId: 'legs-3' },
            { id: 'legs-5', text: 'Calf Raises — 4×15', isCompleted: false, isLocked: true, dependsOnStepId: 'legs-4' },
          ],
          Core: [
            { id: 'core-1', text: 'Warm-up: 5 min jump rope', isCompleted: false, isLocked: true },
            { id: 'core-2', text: 'Plank — 3×60s', isCompleted: false, isLocked: true, dependsOnStepId: 'core-1' },
            { id: 'core-3', text: 'Bicycle Crunches — 3×20', isCompleted: false, isLocked: true, dependsOnStepId: 'core-2' },
            { id: 'core-4', text: 'Russian Twists — 3×15', isCompleted: false, isLocked: true, dependsOnStepId: 'core-3' },
            { id: 'core-5', text: 'Leg Raises — 3×12', isCompleted: false, isLocked: true, dependsOnStepId: 'core-4' },
          ],
        },
      },
    },
  ];
}

// --- State shape ---
interface AppState {
  templates: Template[];
  activeRun: RunInstance | null;
  historyLogs: RunLog[];
  isLoading: boolean;
}

// --- Actions ---
type Action =
  | { type: 'SET_TEMPLATES'; payload: Template[] }
  | { type: 'START_RUN'; payload: RunInstance }
  | { type: 'TOGGLE_STEP'; payload: string } // stepId
  | { type: 'SELECT_BRANCH'; payload: string } // optionKey
  | { type: 'COMPLETE_RUN'; payload: RunLog }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'HYDRATE'; payload: Partial<AppState> };

// --- Initial state ---
const initialState: AppState = {
  templates: [],
  activeRun: null,
  historyLogs: [],
  isLoading: true,
};

// --- Deep-clone helper (template steps must be cloned per-run) ---
function cloneSteps(steps: Step[]): Step[] {
  return steps.map((s) => ({ ...s }));
}

// --- Reducer ---
function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload };

    case 'START_RUN':
      return { ...state, activeRun: action.payload };

    case 'TOGGLE_STEP': {
      if (!state.activeRun) return state;
      const steps = state.activeRun.currentSteps.map((s) => {
        if (s.id !== action.payload) return s;
        return { ...s, isCompleted: !s.isCompleted };
      });

      // Unlock the next step whose dependency just completed
      const toggled = steps.find((s) => s.id === action.payload);
      const updated = steps.map((s) => {
        if (s.dependsOnStepId === action.payload && toggled?.isCompleted) {
          return { ...s, isLocked: false };
        }
        return s;
      });

      const allDone = updated.every((s) => s.isCompleted);
      return {
        ...state,
        activeRun: { ...state.activeRun, currentSteps: updated, isFinished: allDone },
      };
    }

    case 'SELECT_BRANCH': {
      if (!state.activeRun) return state;
      const template = state.templates.find((t) => t.id === state.activeRun!.templateId);
      if (!template?.branchingStep) return state;

      const branchSteps = template.branchingStep.options[action.payload];
      if (!branchSteps) return state;

      // Unlock the first branch step
      const injected = cloneSteps(branchSteps);
      if (injected.length > 0) injected[0].isLocked = false;

      return {
        ...state,
        activeRun: { ...state.activeRun, currentSteps: [...state.activeRun.currentSteps, ...injected] },
      };
    }

    case 'COMPLETE_RUN': {
      return {
        ...state,
        activeRun: null,
        historyLogs: [...state.historyLogs, action.payload],
      };
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'HYDRATE':
      return { ...state, ...action.payload, isLoading: false };

    default:
      return state;
  }
}

// --- Context ---
interface StoreContextValue {
  state: AppState;
  loadTemplates: () => Promise<void>;
  startRun: (templateId: string) => void;
  toggleStep: (stepId: string) => void;
  selectBranch: (optionKey: string) => void;
  completeRun: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// --- Provider ---
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const [templatesJson, activeRunJson, logsJson] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.templates),
          AsyncStorage.getItem(STORAGE_KEYS.activeRun),
          AsyncStorage.getItem(STORAGE_KEYS.historyLogs),
        ]);
        dispatch({
          type: 'HYDRATE',
          payload: {
            templates: templatesJson ? JSON.parse(templatesJson) : createMockTemplates(),
            activeRun: activeRunJson ? JSON.parse(activeRunJson) : null,
            historyLogs: logsJson ? JSON.parse(logsJson) : [],
          },
        });
      } catch {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  // Persist on state change
  useEffect(() => {
    if (state.isLoading) return;
    Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(state.templates)),
      AsyncStorage.setItem(STORAGE_KEYS.activeRun, JSON.stringify(state.activeRun)),
      AsyncStorage.setItem(STORAGE_KEYS.historyLogs, JSON.stringify(state.historyLogs)),
    ]).catch(() => {});
  }, [state.templates, state.activeRun, state.historyLogs, state.isLoading]);

  // --- Actions ---
  const loadTemplates = async () => {
    const templates = createMockTemplates();
    dispatch({ type: 'SET_TEMPLATES', payload: templates });
  };

  const startRunFn = (templateId: string) => {
    const template = state.templates.find((t) => t.id === templateId);
    if (!template) return;

    const instance: RunInstance = {
      id: `run-${Date.now()}`,
      templateId,
      startedAt: Date.now(),
      currentSteps: cloneSteps(template.baseSteps).map((s, i) => ({
        ...s,
        isLocked: i !== 0, // only first step unlocked
      })),
      isFinished: false,
    };
    dispatch({ type: 'START_RUN', payload: instance });
  };

  const toggleStepFn = (stepId: string) => {
    dispatch({ type: 'TOGGLE_STEP', payload: stepId });
  };

  const selectBranchFn = (optionKey: string) => {
    dispatch({ type: 'SELECT_BRANCH', payload: optionKey });
  };

  const completeRunFn = () => {
    if (!state.activeRun) return;
    const log: RunLog = {
      templateId: state.activeRun.templateId,
      timestamp: Date.now(),
      durationMs: Date.now() - state.activeRun.startedAt,
    };
    dispatch({ type: 'COMPLETE_RUN', payload: log });
  };

  return (
    <StoreContext.Provider
      value={{
        state,
        loadTemplates,
        startRun: startRunFn,
        toggleStep: toggleStepFn,
        selectBranch: selectBranchFn,
        completeRun: completeRunFn,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

// --- Hook ---
export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
```
