# 10 — The V3 Core Context Store

## Source
`docs/gemini-archive/component/gemini-10-The V3 Core Context Store.txt`
Schema context: `docs/gemini-archive/manual/gemini_manual-03-app-data-insert.md` Part 3

## Feature Description
Upgraded state engine that replaces the single-select branch model with a dynamic multi-select matrix. Adds `saveCustomTemplate()` for user-generated templates and `toggleBranchOption()` for reversible branch injection/removal.

## Requirements
1. Manage `templates`, `activeRun`, `historyLogs` — seed with Gym Session Prep if empty
2. **`saveCustomTemplate(name, tags, stepTexts)`** — maps step texts into `Step[]` objects, auto-assigns sequential `dependsOnStepId` for linear gating, generates unique IDs, pushes to templates, persists
3. **`toggleBranchOption(optionKey, branchSteps)`** — replaces single `selectBranch`:
   - If optionKey NOT in `selectedBranches`: append it, inject branch steps with `branchSource: optionKey`, fix `dependsOnStepId` to chain from last base step
   - If optionKey IS in `selectedBranches`: remove it, filter out all steps where `branchSource === optionKey`
4. Production-ready with clean re-renders

## V3 Schema Changes (from manual-03)
```typescript
// Step now has branchSource
export interface Step {
  id: string;
  text: string;
  isCompleted: boolean;
  isLocked: boolean;
  dependsOnStepId?: string;
  branchSource?: string; // tracks which option injected this task
}

// RunInstance.selectedBranches is now string[]
export interface RunInstance {
  // ...
  selectedBranches: string[]; // was selectedBranch?: string
}
```

## Adaptation Notes (Expo / React Native)
- Same `@react-native-async-storage/async-storage` dependency
- `useCallback` on all actions to prevent unnecessary re-renders
- `toggleBranchOption` must handle unlocking the first injected step correctly when adding, and re-evaluate lock states when removing

---

## Sample Code: `src/core/store.ts`

```typescript
// src/core/store.ts — V3 Multi-Select Engine
import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Template, RunInstance, RunLog, Step } from './types';

const KEYS = {
  templates: 'flightmanual::templates',
  activeRun: 'flightmanual::active_run',
  runLogs: 'flightmanual::run_logs',
} as const;

// ─── Seed data ──────────────────────────────────────────────
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

const SEED_LOGS: RunLog[] = [
  { templateId: 'tpl_gym_prep', timestamp: 1778950800000, durationMs: 420000 },
  { templateId: 'tpl_gym_prep', timestamp: 1779037200000, durationMs: 380000 },
  { templateId: 'tpl_gym_prep', timestamp: 1779123600000, durationMs: 510000 },
];

// ─── State ──────────────────────────────────────────────────
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
  | { type: 'TOGGLE_BRANCH'; payload: { optionKey: string; branchSteps: Step[] } }
  | { type: 'TOGGLE_STEP'; payload: string }
  | { type: 'COMPLETE_RUN'; payload: RunLog }
  | { type: 'SAVE_TEMPLATE'; payload: Template };

const initialState: FlightState = { templates: [], activeRun: null, historyLogs: [], isLoading: true };

function cloneSteps(steps: Step[]): Step[] {
  return steps.map((s) => ({ ...s }));
}

// ─── Reducer ────────────────────────────────────────────────
function reducer(state: FlightState, action: Action): FlightState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...action.payload, isLoading: false };

    case 'START_RUN':
      return { ...state, activeRun: action.payload };

    case 'TOGGLE_BRANCH': {
      if (!state.activeRun) return state;
      const { optionKey, branchSteps } = action.payload;
      const isSelected = state.activeRun.selectedBranches.includes(optionKey);

      if (!isSelected) {
        // Inject: append branch steps with branchSource set
        const injected = cloneSteps(branchSteps).map((s) => ({
          ...s,
          branchSource: optionKey,
          isLocked: true, // will unlock after dependency check below
        }));
        // Chain first injected step to last base step
        const lastBaseStep = [...state.activeRun.currentSteps].reverse().find((s) => !s.branchSource);
        if (lastBaseStep && injected.length > 0) {
          injected[0].dependsOnStepId = lastBaseStep.id;
        }
        // Unlock first injected step if its dependency is already completed
        if (injected.length > 0 && lastBaseStep?.isCompleted) {
          injected[0].isLocked = false;
        }
        return {
          ...state,
          activeRun: {
            ...state.activeRun,
            selectedBranches: [...state.activeRun.selectedBranches, optionKey],
            currentSteps: [...state.activeRun.currentSteps, ...injected],
          },
        };
      } else {
        // Remove: filter out steps from this branch
        const filtered = state.activeRun.currentSteps.filter(
          (s) => s.branchSource !== optionKey,
        );
        return {
          ...state,
          activeRun: {
            ...state.activeRun,
            selectedBranches: state.activeRun.selectedBranches.filter((k) => k !== optionKey),
            currentSteps: filtered,
          },
        };
      }
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

    case 'SAVE_TEMPLATE':
      return { ...state, templates: [...state.templates, action.payload] };

    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────
interface FlightContextValue {
  state: FlightState;
  startRun: (templateId: string) => void;
  toggleBranchOption: (optionKey: string, branchSteps: Step[]) => void;
  toggleStep: (stepId: string) => void;
  completeRun: () => void;
  saveCustomTemplate: (name: string, tags: string[], stepTexts: string[]) => void;
}

const FlightContext = createContext<FlightContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────
export function FlightManualProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate
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
            activeRun: runJson ? JSON.parse(runJson) : null,
            historyLogs: logsJson ? JSON.parse(logsJson) : SEED_LOGS,
          },
        });
      } catch (e) {
        console.error('[FlightManual] Hydration failed:', e);
        dispatch({
          type: 'HYDRATE',
          payload: { templates: SEED_TEMPLATES, activeRun: null, historyLogs: SEED_LOGS },
        });
      }
    })();
  }, []);

  // Persist
  useEffect(() => {
    if (state.isLoading) return;
    (async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem(KEYS.templates, JSON.stringify(state.templates)),
          AsyncStorage.setItem(KEYS.activeRun, JSON.stringify(state.activeRun)),
          AsyncStorage.setItem(KEYS.runLogs, JSON.stringify(state.historyLogs)),
        ]);
      } catch (e) {
        console.error('[FlightManual] Persist failed:', e);
      }
    })();
  }, [state.templates, state.activeRun, state.historyLogs, state.isLoading]);

  // ─── Actions ──────────────────────────────────────────────
  const startRun = useCallback((templateId: string) => {
    const template = state.templates.find((t) => t.id === templateId);
    if (!template) return;
    const steps = cloneSteps(template.baseSteps).map((s, i) => ({
      ...s,
      isLocked: i !== 0,
    }));
    dispatch({
      type: 'START_RUN',
      payload: {
        id: `run_${Date.now()}`,
        templateId,
        startedAt: Date.now(),
        currentSteps: steps,
        selectedBranches: [],
        isFinished: false,
      },
    });
  }, [state.templates]);

  const toggleBranchOption = useCallback((optionKey: string, branchSteps: Step[]) => {
    dispatch({ type: 'TOGGLE_BRANCH', payload: { optionKey, branchSteps } });
  }, []);

  const toggleStep = useCallback((stepId: string) => {
    dispatch({ type: 'TOGGLE_STEP', payload: stepId });
  }, []);

  const completeRun = useCallback(() => {
    if (!state.activeRun) return;
    dispatch({
      type: 'COMPLETE_RUN',
      payload: {
        templateId: state.activeRun.templateId,
        timestamp: Date.now(),
        durationMs: Date.now() - state.activeRun.startedAt,
      },
    });
  }, [state.activeRun]);

  const saveCustomTemplate = useCallback((name: string, tags: string[], stepTexts: string[]) => {
    const id = `tpl_${Date.now()}`;
    const baseSteps: Step[] = stepTexts.map((text, i) => ({
      id: `step_${id}_${i}`,
      text,
      isCompleted: false,
      isLocked: i !== 0,
      dependsOnStepId: i > 0 ? `step_${id}_${i - 1}` : undefined,
    }));
    const template: Template = { id, name, tags, baseSteps };
    dispatch({ type: 'SAVE_TEMPLATE', payload: template });
  }, []);

  return (
    <FlightContext.Provider
      value={{ state, startRun, toggleBranchOption, toggleStep, completeRun, saveCustomTemplate }}
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
```
