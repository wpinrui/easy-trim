import { useCallback, useState } from 'react';
import type { Segment } from '../../shared/types';
import {
  invertSegments,
  mergeSegments,
  newSegmentId,
  resizeSegmentEdge,
  sortSegments
} from '../lib/segments';

export function useSegments(duration: number) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [pendingIn, setPendingIn] = useState<number | null>(null);

  const addSegment = useCallback(
    (start: number, end: number) => {
      if (duration <= 0) return null;
      const a = Math.max(0, Math.min(duration, Math.min(start, end)));
      const b = Math.max(0, Math.min(duration, Math.max(start, end)));
      if (b - a < 0.05) return null;
      const seg: Segment = { id: newSegmentId(), start: a, end: b };
      let createdId: string | null = seg.id;
      setSegments((prev) => {
        const merged = mergeSegments([...prev, seg]);
        // Find which merged segment now contains the inserted span; use its id.
        const containing = merged.find((m) => m.start <= a && m.end >= b);
        if (containing) createdId = containing.id;
        return merged;
      });
      return createdId;
    },
    [duration]
  );

  const deleteSegments = useCallback((ids: Set<string>) => {
    setSegments((prev) => prev.filter((s) => !ids.has(s.id)));
  }, []);

  const resizeEdge = useCallback(
    (id: string, edge: 'start' | 'end', newValue: number) => {
      setSegments((prev) => resizeSegmentEdge(prev, id, edge, newValue, duration));
    },
    [duration]
  );

  const invert = useCallback(() => {
    setSegments((prev) => invertSegments(prev, duration));
  }, [duration]);

  const setPendingInPoint = useCallback((t: number | null) => setPendingIn(t), []);

  /** Commit pending in-point with current time as the out-point. */
  const commitOutPoint = useCallback(
    (currentTime: number) => {
      if (pendingIn == null) return null;
      const start = Math.min(pendingIn, currentTime);
      const end = Math.max(pendingIn, currentTime);
      setPendingIn(null);
      if (end - start < 0.05) return null;
      return addSegment(start, end);
    },
    [pendingIn, addSegment]
  );

  const reset = useCallback(() => {
    setSegments([]);
    setPendingIn(null);
  }, []);

  return {
    segments,
    sortedSegments: sortSegments(segments),
    pendingIn,
    setPendingInPoint,
    addSegment,
    deleteSegments,
    resizeEdge,
    invert,
    commitOutPoint,
    reset
  };
}
