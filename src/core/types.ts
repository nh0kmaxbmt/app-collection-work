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
