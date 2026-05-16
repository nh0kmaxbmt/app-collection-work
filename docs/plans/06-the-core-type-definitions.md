# 06 — The Core Type Definitions

## Source
`docs/gemini-archive/component/gemini-06-The Core Type Definitions.txt`

## Feature Description
Strictly-typed TypeScript definitions for the FlightManual domain model, updated for React Native/Expo. These types are the foundation shared by every other module.

## Requirements
1. `Step` — id, text, isCompleted, isLocked, dependsOnStepId (optional)
2. `BranchingStep` — question, options: Record<string, Step[]>
3. `Template` — id, name, tags, baseSteps, branchingStep (optional)
4. `RunInstance` — id, templateId, startedAt, currentSteps, **selectedBranch** (optional string tracking which branch was chosen), isFinished
5. `RunLog` — templateId, timestamp, durationMs
- No external libraries. Export all interfaces.

## Adaptation Notes (Expo / React Native)
None. Pure TypeScript types — platform-agnostic.

## Key Difference from Plan 01
`RunInstance` now includes `selectedBranch?: string` to track which branch option the user selected during execution. This prevents duplicate branch injections.

---

## Sample Code: `src/core/types.ts`

```typescript
// src/core/types.ts

export interface Step {
  id: string;
  text: string;
  isCompleted: boolean;
  isLocked: boolean;
  dependsOnStepId?: string;
}

export interface BranchingStep {
  question: string;
  options: Record<string, Step[]>;
}

export interface Template {
  id: string;
  name: string;
  tags: string[];
  baseSteps: Step[];
  branchingStep?: BranchingStep;
}

export interface RunInstance {
  id: string;
  templateId: string;
  startedAt: number;
  currentSteps: Step[];
  selectedBranch?: string;
  isFinished: boolean;
}

export interface RunLog {
  templateId: string;
  timestamp: number;
  durationMs: number;
}
```
