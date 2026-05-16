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
