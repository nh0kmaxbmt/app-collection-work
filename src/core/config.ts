// src/core/config.ts — Centralized Application Configuration
// This module provides a single source of truth for all app-wide settings,
// particularly expiration durations that vary between production and testing environments.

/**
 * Application-wide configuration constants and helpers.
 * All timing-sensitive values should be defined here to enable
 * rapid testing and environment-specific behavior.
 */
export const APP_CONFIG = {
  /**
   * Test mode flag for accelerated expiration verification.
   * Set to true to use 30-second expiry windows for rapid UI testing.
   * Set to false for production 24-hour expiry windows.
   *
   * @default false (Production mode with 24-hour expiry)
   */
  IS_TEST_MODE: false,

  /**
   * Expiration duration constants in milliseconds.
   * - PRODUCTION: 24 hours (86,400,000 ms) — Standard user-facing expiry
   * - TESTING: 30 seconds (30,000 ms) — Rapid cycle verification for QA
   */
  EXPIRY_DURATIONS: {
    PRODUCTION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    TESTING: 30 * 1000,              // 30 seconds in milliseconds
  } as const,

  /**
   * Recurring routine configuration constants.
   * Controls the grace window for late-night completions.
   */
  RECURRING_CONFIG: {
    /**
     * Grace window end hour (0-23).
     * Times between 12:00 AM (0) and this hour are considered part of the previous day.
     * @default 4 (4:00 AM)
     */
    GRACE_WINDOW_END_HOUR: 4,
  } as const,

  /**
   * AsyncStorage key constants for centralized key management.
   * Changing these values will break existing persisted data.
   */
  STORAGE_KEYS: {
    COLLECTIONS: 'flightmanual::collections',
    TEMPLATES: 'flightmanual::templates',
    ACTIVE_RUN: 'flightmanual::active_run',
    SAVED_RUNS: 'flightmanual::saved_runs',
    RUN_LOGS: 'flightmanual::run_logs',
    VIEW_MODE: 'flightmanual::view_mode',
  } as const,

  /**
   * Retrieves the appropriate expiration duration based on the current mode.
   * In test mode, returns 30 seconds for rapid verification.
   * In production mode, returns 24 hours for standard user experience.
   *
   * @returns Expiration duration in milliseconds
   *
   * @example
   * const expiresAt = Date.now() + APP_CONFIG.getExpiryDuration();
   * console.log(`Run expires at ${new Date(expiresAt).toISOString()}`);
   */
  getExpiryDuration(): number {
    return this.IS_TEST_MODE
      ? this.EXPIRY_DURATIONS.TESTING
      : this.EXPIRY_DURATIONS.PRODUCTION;
  },

  /**
   * Formats a duration in milliseconds to a human-readable string.
   * Useful for logging and debugging expiration calculations.
   *
   * @param ms - Duration in milliseconds
   * @returns Formatted string (e.g., "24h 0m 0s" or "0h 0m 30s")
   */
  formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  },

  /**
   * Calculates remaining time before expiration as a human-readable string.
   *
   * @param expiresAt - Expiration timestamp in milliseconds
   * @returns Human-readable remaining time (e.g., "23h 59m 30s" or "Expired")
   */
  getRemainingTime(expiresAt: number | undefined): string {
    if (!expiresAt) return 'N/A';

    const remaining = expiresAt - Date.now();

    if (remaining <= 0) return 'Expired';

    return this.formatDuration(remaining);
  },

  /**
   * Calculates remaining hours before expiration (rounded up).
   * Used for display in the saved runs UI.
   *
   * @param expiresAt - Expiration timestamp in milliseconds
   * @returns Remaining hours (0 if expired or undefined)
   */
  getRemainingHours(expiresAt: number | undefined): number {
    if (!expiresAt) return 0;

    const remainingMs = expiresAt - Date.now();

    if (remainingMs <= 0) return 0;

    return Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
  },

  /**
   * Gets the "logical date" for recurring routines.
   *
   * The logical date accounts for a grace window where late-night usage
   * (12:00 AM to GRACE_WINDOW_END_HOUR) is considered part of the previous day.
   * This allows users who stay up past midnight to have completions count
   * toward the day they woke up on.
   *
   * @param dateInput - Optional date to calculate logical date for (defaults to now)
   * @returns Logical date string in YYYY-MM-DD format
   *
   * @example
   * // At 2:00 AM on May 29, returns "2025-05-28" (previous day)
   * APP_CONFIG.getLogicalDate()
   * // At 9:00 AM on May 29, returns "2025-05-29" (current day)
   * APP_CONFIG.getLogicalDate()
   */
  getLogicalDate(dateInput: Date | undefined = undefined): string {
    const date = dateInput ? new Date(dateInput) : new Date();
    const hour = date.getHours();

    // Grace window: 12AM-4AM counts as previous day
    if (hour >= 0 && hour < this.RECURRING_CONFIG.GRACE_WINDOW_END_HOUR) {
      date.setDate(date.getDate() - 1);
    }

    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  },

  /**
   * Checks if a new logical day has started since the last check.
   * Used to determine if recurring routines need to be reset.
   *
   * @param lastCheckedDateString - The last logical date string to compare against
   * @returns true if a new logical day has started, false otherwise
   *
   * @example
   * const lastDate = "2025-05-28";
   * // At 2:00 AM on May 29 (logical date still "2025-05-28"), returns false
   * // At 5:00 AM on May 29 (logical date "2025-05-29"), returns true
   * APP_CONFIG.isNewLogicalDay(lastDate);
   */
  isNewLogicalDay(lastCheckedDateString: string): boolean {
    const currentLogicalDate = this.getLogicalDate();
    return currentLogicalDate !== lastCheckedDateString;
  },

} as const;

// Type assertion for readonly config
export type AppConfig = typeof APP_CONFIG;

/**
 * Development helper to log current configuration state.
 * Call this during app initialization to verify mode.
 */
export function logConfigState(): void {
  const duration = APP_CONFIG.getExpiryDuration();
  const formatted = APP_CONFIG.formatDuration(duration);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[FlightManual] Configuration State');
  console.log('[FlightManual] Mode:', APP_CONFIG.IS_TEST_MODE ? 'TESTING (30s expiry)' : 'PRODUCTION (24h expiry)');
  console.log('[FlightManual] Expiry Duration:', formatted);
  console.log('[FlightManual] Current Timestamp:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════════');
}

/**
 * Checks if a timestamp has expired based on current config.
 *
 * @param expiresAt - Expiration timestamp to check
 * @returns true if expired, false otherwise
 */
export function isExpired(expiresAt: number | undefined): boolean {
  if (!expiresAt) return false;
  return Date.now() > expiresAt;
}
