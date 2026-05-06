import { useCallback, useState } from 'react';
import type { Segment } from '../../shared/types';
import {
  invertSegments,
  mergeSegments,
  newSegmentId,
  resizeSegmentEdge,
  sortSegments
} from '../lib/segments';

const HISTORY_LIMIT = 100;

type EditorState = {
  segments: Segment[];
  rotation: 0 | 90 | 180 | 270;
};

type History = {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
};

const emptyState: EditorState = { segments: [], rotation: 0 };
const empty: History = { past: [], present: emptyState, future: [] };

function pushPast(past: EditorState[], snapshot: EditorState): EditorState[] {
  const next = [...past, snapshot];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

export function useSegments(duration: number) {
  const [hist, setHist] = useState<History>(empty);
  const [pendingIn, setPendingIn] = useState<number | null>(null);

  const segments = hist.present.segments;
  const rotation = hist.present.rotation;

  /** Apply an update and record the previous state in history. */
  const commit = useCallback((updater: (prev: EditorState) => EditorState) => {
    setHist((prev) => {
      const next = updater(prev.present);
      if (next === prev.present) return prev;
      return { past: pushPast(prev.past, prev.present), present: next, future: [] };
    });
  }, []);

  /**
   * Snapshot current state into history without changing it.
   * Use before a continuous edit (e.g. an edge drag) so the whole drag
   * collapses into one undo step.
   */
  const beginEdit = useCallback(() => {
    setHist((prev) => ({
      past: pushPast(prev.past, prev.present),
      present: prev.present,
      future: []
    }));
  }, []);

  /** Update without recording history (use after beginEdit during a drag). */
  const updateWithoutHistory = useCallback((updater: (prev: EditorState) => EditorState) => {
    setHist((prev) => ({ ...prev, present: updater(prev.present) }));
  }, []);

  const undo = useCallback(() => {
    setHist((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: [prev.present, ...prev.future]
      };
    });
    setPendingIn(null);
  }, []);

  const redo = useCallback(() => {
    setHist((prev) => {
      if (prev.future.length === 0) return prev;
      const [next, ...rest] = prev.future;
      return {
        past: pushPast(prev.past, prev.present),
        present: next,
        future: rest
      };
    });
    setPendingIn(null);
  }, []);

  const addSegment = useCallback(
    (start: number, end: number) => {
      if (duration <= 0) return null;
      const a = Math.max(0, Math.min(duration, Math.min(start, end)));
      const b = Math.max(0, Math.min(duration, Math.max(start, end)));
      if (b - a < 0.05) return null;
      const seg: Segment = { id: newSegmentId(), start: a, end: b };
      let createdId: string | null = seg.id;
      commit((prev) => {
        const merged = mergeSegments([...prev.segments, seg]);
        const containing = merged.find((m) => m.start <= a && m.end >= b);
        if (containing) createdId = containing.id;
        return { ...prev, segments: merged };
      });
      return createdId;
    },
    [duration, commit]
  );

  const deleteSegments = useCallback(
    (ids: Set<string>) => {
      commit((prev) => ({ ...prev, segments: prev.segments.filter((s) => !ids.has(s.id)) }));
    },
    [commit]
  );

  /** Continuous resize from a drag — use after beginEdit. Does not push history. */
  const resizeEdge = useCallback(
    (id: string, edge: 'start' | 'end', newValue: number) => {
      updateWithoutHistory((prev) => ({
        ...prev,
        segments: resizeSegmentEdge(prev.segments, id, edge, newValue, duration)
      }));
    },
    [duration, updateWithoutHistory]
  );

  const invert = useCallback(() => {
    commit((prev) => ({ ...prev, segments: invertSegments(prev.segments, duration) }));
  }, [duration, commit]);

  const rotate = useCallback(() => {
    commit((prev) => ({ ...prev, rotation: ((prev.rotation + 90) % 360) as 0 | 90 | 180 | 270 }));
  }, [commit]);

  const setPendingInPoint = useCallback((t: number | null) => setPendingIn(t), []);

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
    setHist(empty);
    setPendingIn(null);
  }, []);

  return {
    segments,
    sortedSegments: sortSegments(segments),
    rotation,
    pendingIn,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
    setPendingInPoint,
    addSegment,
    deleteSegments,
    resizeEdge,
    beginEdit,
    invert,
    rotate,
    commitOutPoint,
    undo,
    redo,
    reset
  };
}
