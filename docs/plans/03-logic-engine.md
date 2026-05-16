# 03 — Logic Engine

## Source
`docs/gemini-archive/gemini-03-Logic Engine.txt`

## Feature Description
Pure function that scores and sorts templates based on the user's past run history, weighting templates higher if they've been frequently executed within a +/- 2-hour window of the current time.

## Requirements
- Pure function `getWeightedTemplates(templates: Template[], logs: RunLog[]): Template[]`
- Analyze the last 5–10 logs from `historyLogs`
- Compare the current hour with log timestamps
- Score templates higher if run frequently within a +/- 2-hour window of now
- Return templates sorted by score (highest first)

## Adaptation Notes (Expo / React Native)
None. Pure logic function — no platform APIs used.

---

## Sample Code: `src/core/engine.ts`

```typescript
// src/core/engine.ts
import type { Template, RunLog } from './types';

/**
 * Scores each template based on how often it has been run within a +/- 2-hour
 * window of the current time. Returns templates sorted by score descending.
 *
 * Scoring rules:
 *  - Only the most recent 10 logs are considered.
 *  - Each log that falls within a +/- 2-hour window of the current hour
 *    contributes +1 to that template's score.
 *  - Templates with no matching logs receive a score of 0.
 */
export function getWeightedTemplates(
  templates: Template[],
  logs: RunLog[],
): Template[] {
  const now = new Date();
  const currentHour = now.getHours();

  // Take the most recent 10 logs
  const recentLogs = logs.slice(-10);

  // Build a score map: templateId -> number
  const scores = new Map<string, number>();

  for (const log of recentLogs) {
    const logDate = new Date(log.timestamp);
    const logHour = logDate.getHours();

    // Check if log falls within +/- 2 hours of current time
    const hourDiff = Math.abs(currentHour - logHour);
    // Handle wrap-around (e.g., 23 vs 1)
    const wrappedDiff = Math.min(hourDiff, 24 - hourDiff);

    if (wrappedDiff <= 2) {
      const current = scores.get(log.templateId) ?? 0;
      scores.set(log.templateId, current + 1);
    }
  }

  // Sort templates: higher score first, stable sort for equal scores
  return [...templates].sort((a, b) => {
    const scoreA = scores.get(a.id) ?? 0;
    const scoreB = scores.get(b.id) ?? 0;
    return scoreB - scoreA;
  });
}
```
