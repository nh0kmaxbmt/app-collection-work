// src/core/types.ts — V9.2 Multi-Instance Saved Runs & Enhanced Features with Structural Scope Tracking

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
  isRecurring?: boolean; // Flag to enable auto-spawning daily routine behavior
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
  collectionId?: string; // References the primary collection that launched this run
  startedAt: number;
  currentSteps: CompiledStep[];
  isFinished: boolean;
  customName?: string; // User-defined name for saved runs (optional for active runs)
  expiresAt?: number; // 24-hour expiry timestamp (required for saved runs)
  savedRunId?: string; // Tracks if this run was resumed from a saved run
  logicalDate?: string; // The logical date (YYYY-MM-DD) when this run was spawned
  completedAtLogicalDate?: string; // The logical date when 100% completion was reached
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
  savedRuns?: RunInstance[]; // Include saved runs in backups
}

// App-wide Settings State
export interface AppSettings {
  viewMode: DashboardViewMode;
}
