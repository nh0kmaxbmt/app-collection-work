// src/core/types.ts — V3 Multi-Select Engine

export interface Step {
  id: string;
  text: string;
  isCompleted: boolean;
  isLocked: boolean;
  dependsOnStepId?: string;
  branchSource?: string; // tracks which option injected this task
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
  selectedBranches: string[]; // V3: now an array for multi-selection
  isFinished: boolean;
}

export interface RunLog {
  templateId: string;
  timestamp: number;
  durationMs: number;
}
