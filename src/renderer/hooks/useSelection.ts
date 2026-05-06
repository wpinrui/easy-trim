import { useCallback, useEffect, useRef, useState } from 'react';
import type { Segment } from '../../shared/types';
import { sortSegments } from '../lib/segments';

export function useSelection(segments: Segment[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  // Drop ids that no longer exist after segment edits.
  useEffect(() => {
    setSelected((prev) => {
      const valid = new Set<string>();
      const ids = new Set(segments.map((s) => s.id));
      for (const id of prev) if (ids.has(id)) valid.add(id);
      if (valid.size === prev.size) return prev;
      return valid;
    });
  }, [segments]);

  const replaceWith = useCallback((id: string) => {
    setSelected(new Set([id]));
    anchorRef.current = id;
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchorRef.current = id;
  }, []);

  const rangeTo = useCallback(
    (id: string) => {
      const sorted = sortSegments(segments);
      const anchorIdx =
        anchorRef.current != null ? sorted.findIndex((s) => s.id === anchorRef.current) : -1;
      const targetIdx = sorted.findIndex((s) => s.id === id);
      if (targetIdx < 0) return;
      if (anchorIdx < 0) {
        replaceWith(id);
        return;
      }
      const lo = Math.min(anchorIdx, targetIdx);
      const hi = Math.max(anchorIdx, targetIdx);
      const next = new Set<string>();
      for (let i = lo; i <= hi; i++) next.add(sorted[i].id);
      setSelected(next);
    },
    [segments, replaceWith]
  );

  const clear = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(segments.map((s) => s.id)));
    anchorRef.current = segments[0]?.id ?? null;
  }, [segments]);

  return { selected, replaceWith, toggle, rangeTo, clear, selectAll, setSelected };
}
