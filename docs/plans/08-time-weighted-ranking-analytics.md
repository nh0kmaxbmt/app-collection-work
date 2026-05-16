# 08 — Time-Weighted Ranking Analytics

## Source
`docs/gemini-archive/component/gemini-08-Time-Weighted Ranking Analytics.txt`

## Feature Description
Pure algorithmic function that scores templates based on historical run frequency within the user's current time window. Enables intelligent "suggested routine" ordering on the command palette.

## Requirements
1. Pure function `getWeightedTemplates(templates: Template[], logs: RunLog[]): Template[]`
2. Scoring logic:
   - Get current system hour (0–23)
   - Filter logs to examine entries per template
   - If a log falls within +/- 2 hours of the current hour, score that template higher
   - Sort descending by score
3. Handle fallback when `historyLogs` is empty (return templates as-is)

## Adaptation Notes (Expo / React Native)
None. Pure logic function — no platform APIs.

---

## Sample Code: `src/core/engine.ts`

```typescript
// src/core/engine.ts
import type { Template, RunLog } from './types';

/**
 * Scores templates by how often they've been run within a +/- 2-hour window
 * of the current time. Returns templates sorted by score (descending).
 *
 * Fallback: if no logs exist, returns templates in their original order.
 */
export function getWeightedTemplates(
  templates: Template[],
  logs: RunLog[],
): Template[] {
  if (logs.length === 0) return templates;

  const currentHour = new Date().getHours();

  // Build score map: templateId -> number
  const scores = new Map<string, number>();

  for (const log of logs) {
    const logHour = new Date(log.timestamp).getHours();

    // Calculate hour difference with wrap-around handling
    const hourDiff = Math.abs(currentHour - logHour);
    const wrappedDiff = Math.min(hourDiff, 24 - hourDiff);

    if (wrappedDiff <= 2) {
      const prev = scores.get(log.templateId) ?? 0;
      scores.set(log.templateId, prev + 1);
    }
  }

  // Stable sort: higher score first
  return [...templates].sort((a, b) => {
    const scoreA = scores.get(a.id) ?? 0;
    const scoreB = scores.get(b.id) ?? 0;
    return scoreB - scoreA;
  });
}
```
