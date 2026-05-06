import type { Segment } from '../../shared/types';

export function newSegmentId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clampSegment(s: Segment, duration: number): Segment {
  const start = Math.max(0, Math.min(duration, s.start));
  const end = Math.max(0, Math.min(duration, s.end));
  return { ...s, start: Math.min(start, end), end: Math.max(start, end) };
}

export function sortSegments(segs: Segment[]): Segment[] {
  return segs.slice().sort((a, b) => a.start - b.start);
}

export function mergeSegments(segs: Segment[]): Segment[] {
  const sorted = sortSegments(segs.filter((s) => s.end > s.start));
  const out: Segment[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

export function invertSegments(segs: Segment[], duration: number): Segment[] {
  const merged = mergeSegments(segs);
  const out: Segment[] = [];
  let cursor = 0;
  for (const s of merged) {
    if (s.start > cursor) {
      out.push({ id: newSegmentId(), start: cursor, end: s.start });
    }
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < duration) {
    out.push({ id: newSegmentId(), start: cursor, end: duration });
  }
  return out.filter((s) => s.end - s.start > 0.001);
}

/** Adjust a segment edge while preserving sort order and clamping to neighbors. */
export function resizeSegmentEdge(
  segs: Segment[],
  id: string,
  edge: 'start' | 'end',
  newValue: number,
  duration: number
): Segment[] {
  const idx = segs.findIndex((s) => s.id === id);
  if (idx < 0) return segs;
  const sorted = sortSegments(segs);
  const sortedIdx = sorted.findIndex((s) => s.id === id);
  const target = sorted[sortedIdx];
  const prevEnd = sortedIdx > 0 ? sorted[sortedIdx - 1].end : 0;
  const nextStart = sortedIdx < sorted.length - 1 ? sorted[sortedIdx + 1].start : duration;
  const minGap = 0.01;
  if (edge === 'start') {
    const v = Math.max(prevEnd, Math.min(target.end - minGap, newValue));
    sorted[sortedIdx] = { ...target, start: v };
  } else {
    const v = Math.min(nextStart, Math.max(target.start + minGap, newValue));
    sorted[sortedIdx] = { ...target, end: v };
  }
  return sorted;
}

export function totalSelectedDuration(segs: Segment[], selected: Set<string>): number {
  return segs.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + (s.end - s.start), 0);
}

export function totalDuration(segs: Segment[]): number {
  return segs.reduce((sum, s) => sum + (s.end - s.start), 0);
}
