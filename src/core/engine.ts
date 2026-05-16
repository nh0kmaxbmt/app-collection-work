// src/core/engine.ts
import type { Collection, RunLog } from './types';

/**
 * Scores collections by how often they've been run within a +/- 2-hour window
 * of the current time. Returns collections sorted by score (descending).
 *
 * Fallback: if no logs exist, returns collections in their original order.
 */
export function getWeightedCollections(
  collections: Collection[],
  logs: RunLog[],
): Collection[] {
  if (logs.length === 0) return collections;

  const currentHour = new Date().getHours();

  // Build score map: collectionId -> number
  const scores = new Map<string, number>();

  for (const log of logs) {
    const logHour = new Date(log.timestamp).getHours();

    // Calculate hour difference with wrap-around handling
    const hourDiff = Math.abs(currentHour - logHour);
    const wrappedDiff = Math.min(hourDiff, 24 - hourDiff);

    if (wrappedDiff <= 2) {
      const prev = scores.get(log.collectionId) ?? 0;
      scores.set(log.collectionId, prev + 1);
    }
  }

  // Stable sort: higher score first
  return [...collections].sort((a, b) => {
    const scoreA = scores.get(a.id) ?? 0;
    const scoreB = scores.get(b.id) ?? 0;
    return scoreB - scoreA;
  });
}
