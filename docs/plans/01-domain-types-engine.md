# 01 — Domain Types Engine

## Source
`docs/gemini-archive/gemini-01-Domain Types Engine.txt`

## Feature Description
Strictly-typed TypeScript definitions for the FlightManual domain model. No external libraries. These types are the foundation shared by every other module.

## Requirements
- `Step` interface: id, text, isCompleted, isLocked, dependsOnStepId (optional)
- `BranchCondition` interface: allows a step to contain multiple choices, each mapping to an array of conditional `Step` objects
- `Template` interface: id, name, tags, baseSteps, optional branchingStep
- `RunInstance` interface: id, templateId, startedAt, currentSteps, isFinished
- `RunLog` interface: templateId, timestamp, durationMs
- Export all types clearly

## Adaptation Notes (Expo / React Native)
None. Pure TypeScript types — platform-agnostic.

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

export interface BranchCondition {
  question: string;
  options: { [key: string]: Step[] };
}

export interface Template {
  id: string;
  name: string;
  tags: string[];
  baseSteps: Step[];
  branchingStep?: BranchCondition;
}

export interface RunInstance {
  id: string;
  templateId: string;
  startedAt: number;
  currentSteps: Step[];
  isFinished: boolean;
}

export interface RunLog {
  templateId: string;
  timestamp: number;
  durationMs: number;
}
```
