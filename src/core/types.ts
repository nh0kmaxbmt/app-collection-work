// src/core/types.ts — V8.1 Dashboard View Modes & Backup Support

export type ExecutionMode = 'linear' | 'parallel';

export type DashboardViewMode = 'list' | 'cloud';

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

// Backup/Restore Data Structure
export interface FlightManualBackup {
  version: string;
  exportedAt: number;
  collections: Collection[];
  templates: Template[];
  historyLogs: RunLog[];
}

// App-wide Settings State
export interface AppSettings {
  viewMode: DashboardViewMode;
}
