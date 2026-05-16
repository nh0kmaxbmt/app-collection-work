// src/core/types.ts — V6 Mid-Flight Composable Pipeline

export type ExecutionMode = 'linear' | 'parallel';

export interface Step {
  id: string;
  text: string;
  isCompleted: boolean;
  isLocked: boolean;
  dependsOnStepId?: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  executionMode: ExecutionMode;
  steps: Step[];
}

export interface Template {
  id: string;
  title: string;
  description?: string;
  templateIds: string[];
}

export type CompiledStep = Step & {
  parentTemplateName: string;
  executionMode: ExecutionMode;
};

export interface RunInstance {
  id: string;
  startedAt: number;
  currentSteps: CompiledStep[];
  isFinished: boolean;
}

export interface RunLog {
  collectionId: string;
  timestamp: number;
  durationMs: number;
}
