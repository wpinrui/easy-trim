import { useEffect, useMemo, useRef, useState } from 'react';
import type { Segment } from '../../shared/types';
import { sortSegments } from '../lib/segments';
import { formatDuration } from '../lib/format';

type Props = {
  duration: number;
  currentTime: number;
  segments: Segment[];
  selected: Set<string>;
  pendingIn: number | null;
  onSeek: (time: number) => void;
  onCreateSegment: (start: number, end: number) => void;
  onBeginEdit: () => void;
  onResizeEdge: (id: string, edge: 'start' | 'end', newValue: number) => void;
  onSegmentClick: (id: string, modifiers: { ctrl: boolean; shift: boolean }) => void;
  onClearSelection: () => void;
};

const EDGE_HIT_PX = 6;
const TRACK_HEIGHT = 64;
const SCRUBBER_HEIGHT = 28;
const SCROLLBAR_HEIGHT = 8;
const MIN_VIEW_LEN = 0.25; // seconds — limits max zoom
const ZOOM_FACTOR = 1.2;

type View = { start: number; end: number };

type Drag =
  | { kind: 'create'; startX: number; currentX: number }
  | { kind: 'edge'; id: string; edge: 'start' | 'end' }
  | { kind: 'scrub' }
  | { kind: 'pan'; startX: number; startView: View }
  | { kind: 'scrollbar-thumb'; startX: number; startView: View }
  | null;

export function Timeline({
  duration,
  currentTime,
  segments,
  selected,
  pendingIn,
  onSeek,
  onCreateSegment,
  onBeginEdit,
  onResizeEdge,
  onSegmentClick,
  onClearSelection
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollbarRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [view, setView] = useState<View>({ start: 0, end: 0 });
  const sorted = useMemo(() => sortSegments(segments), [segments]);

  // Reset view when a new video loads (duration changes from previous).
  const lastDurationRef = useRef(0);
  useEffect(() => {
    if (duration !== lastDurationRef.current) {
      lastDurationRef.current = duration;
      setView({ start: 0, end: duration });
    }
  }, [duration]);

  const viewLen = Math.max(MIN_VIEW_LEN, view.end - view.start);

  const xToTimeOnElement = (clientX: number, el: HTMLElement | null): number => {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return view.start + ratio * viewLen;
  };
  const xToTime = (clientX: number) => xToTimeOnElement(clientX, trackRef.current);

  // Position percentage within the visible window.
  const timeToPct = (t: number): number => {
    if (viewLen <= 0) return 0;
    return ((t - view.start) / viewLen) * 100;
  };

  const findEdgeUnderCursor = (
    clientX: number
  ): { id: string; edge: 'start' | 'end' } | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    for (const s of sorted) {
      const xs = ((s.start - view.start) / viewLen) * rect.width;
      const xe = ((s.end - view.start) / viewLen) * rect.width;
      if (Math.abs(x - xs) <= EDGE_HIT_PX) return { id: s.id, edge: 'start' };
      if (Math.abs(x - xe) <= EDGE_HIT_PX) return { id: s.id, edge: 'end' };
    }
    return null;
  };

  const findSegmentUnderCursor = (clientX: number): Segment | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    for (const s of sorted) {
      const xs = ((s.start - view.start) / viewLen) * rect.width;
      const xe = ((s.end - view.start) / viewLen) * rect.width;
      if (x >= xs + EDGE_HIT_PX && x <= xe - EDGE_HIT_PX) return s;
      if (xe - xs < EDGE_HIT_PX * 2 && x >= xs && x <= xe) return s;
    }
    return null;
  };

  const clampView = (start: number, end: number): View => {
    const len = Math.max(MIN_VIEW_LEN, Math.min(duration || end - start, end - start));
    let s = start;
    let e = s + len;
    if (s < 0) {
      s = 0;
      e = len;
    }
    if (duration > 0 && e > duration) {
      e = duration;
      s = Math.max(0, e - len);
    }
    return { start: s, end: e };
  };

  const onScrubberMouseDown = (e: React.MouseEvent) => {
    if (duration <= 0) return;
    if (e.button === 2) {
      // Right-click: start pan
      e.preventDefault();
      setDrag({ kind: 'pan', startX: e.clientX, startView: view });
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    onSeek(xToTimeOnElement(e.clientX, scrubberRef.current));
    setDrag({ kind: 'scrub' });
  };

  const onTrackMouseDown = (e: React.MouseEvent) => {
    if (duration <= 0) return;
    if (e.button === 2) {
      // Right-click: start pan
      e.preventDefault();
      setDrag({ kind: 'pan', startX: e.clientX, startView: view });
      return;
    }
    if (e.button !== 0) return;
    const edge = findEdgeUnderCursor(e.clientX);
    if (edge) {
      e.preventDefault();
      onBeginEdit();
      setDrag({ kind: 'edge', id: edge.id, edge: edge.edge });
      return;
    }
    const seg = findSegmentUnderCursor(e.clientX);
    if (seg) {
      e.preventDefault();
      onSegmentClick(seg.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
      return;
    }
    setDrag({ kind: 'create', startX: e.clientX, currentX: e.clientX });
  };

  // Track global mousemove/mouseup while dragging.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      if (drag.kind === 'edge') {
        onResizeEdge(drag.id, drag.edge, xToTime(e.clientX));
      } else if (drag.kind === 'create') {
        setDrag({ ...drag, currentX: e.clientX });
      } else if (drag.kind === 'scrub') {
        onSeek(xToTimeOnElement(e.clientX, scrubberRef.current));
      } else if (drag.kind === 'pan') {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const dx = e.clientX - drag.startX;
        const dt = (dx / rect.width) * (drag.startView.end - drag.startView.start);
        setView(clampView(drag.startView.start - dt, drag.startView.end - dt));
      } else if (drag.kind === 'scrollbar-thumb') {
        const rect = scrollbarRef.current?.getBoundingClientRect();
        if (!rect || duration <= 0) return;
        const dx = e.clientX - drag.startX;
        const dt = (dx / rect.width) * duration;
        setView(clampView(drag.startView.start + dt, drag.startView.end + dt));
      }
    };
    const onUp = (e: MouseEvent) => {
      if (drag.kind === 'create') {
        const dx = Math.abs(e.clientX - drag.startX);
        if (dx >= 4) {
          const a = xToTime(drag.startX);
          const b = xToTime(e.clientX);
          onCreateSegment(Math.min(a, b), Math.max(a, b));
        } else {
          onClearSelection();
        }
      }
      setDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  // Ctrl+wheel zoom anchored on the playhead.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || duration <= 0) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const currentLen = view.end - view.start;
      let newLen = currentLen * factor;
      newLen = Math.max(MIN_VIEW_LEN, Math.min(duration, newLen));
      const anchor = currentTime;
      // Keep `anchor` at the same screen ratio it currently occupies.
      const ratio = currentLen > 0 ? (anchor - view.start) / currentLen : 0.5;
      const newStart = anchor - ratio * newLen;
      const newEnd = newStart + newLen;
      setView(clampView(newStart, newEnd));
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
    // clampView is defined inline; only inputs that matter here are view, currentTime, duration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentTime, duration]);

  // Track-row hover cursor.
  const [hoverCursor, setHoverCursor] = useState<string>('default');
  const onTrackHoverMove = (e: React.MouseEvent) => {
    if (drag) return;
    if (findEdgeUnderCursor(e.clientX)) setHoverCursor('ew-resize');
    else if (findSegmentUnderCursor(e.clientX)) setHoverCursor('pointer');
    else setHoverCursor('crosshair');
  };

  const ticks = useMemo(() => {
    if (duration <= 0 || viewLen <= 0) return [];
    const target = 8;
    const niceSteps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
    const ideal = viewLen / target;
    const step = niceSteps.find((s) => s >= ideal) ?? niceSteps[niceSteps.length - 1];
    const arr: number[] = [];
    const first = Math.ceil(view.start / step) * step;
    for (let t = first; t <= view.end + 1e-6; t += step) arr.push(t);
    return arr;
  }, [duration, view.start, view.end, viewLen]);

  let createPreview: { start: number; end: number } | null = null;
  if (drag?.kind === 'create') {
    const a = xToTime(drag.startX);
    const b = xToTime(drag.currentX);
    createPreview = { start: Math.min(a, b), end: Math.max(a, b) };
  }

  // Scrollbar metrics
  const scrollbarThumbStartPct =
    duration > 0 ? Math.max(0, Math.min(100, (view.start / duration) * 100)) : 0;
  const scrollbarThumbWidthPct =
    duration > 0 ? Math.max(2, Math.min(100, (viewLen / duration) * 100)) : 100;

  const onScrollbarTrackMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || duration <= 0) return;
    const rect = scrollbarRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = e.target as HTMLElement;
    if (target.dataset['role'] === 'thumb') {
      e.preventDefault();
      setDrag({ kind: 'scrollbar-thumb', startX: e.clientX, startView: view });
      return;
    }
    // Click on bare track: jump so the thumb centers on click.
    const ratio = (e.clientX - rect.left) / rect.width;
    const targetCenter = ratio * duration;
    const newStart = targetCenter - viewLen / 2;
    setView(clampView(newStart, newStart + viewLen));
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        height: SCRUBBER_HEIGHT + TRACK_HEIGHT + SCROLLBAR_HEIGHT,
        background: '#1f1f1f',
        borderTop: '1px solid #3a3a3a',
        userSelect: 'none',
        overflow: 'hidden'
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Scrubber row */}
      <div
        ref={scrubberRef}
        onMouseDown={onScrubberMouseDown}
        style={{
          position: 'relative',
          height: SCRUBBER_HEIGHT,
          background: '#272727',
          borderBottom: '1px solid #303030',
          cursor:
            drag?.kind === 'scrub'
              ? 'grabbing'
              : drag?.kind === 'pan'
                ? 'grabbing'
                : duration > 0
                  ? 'pointer'
                  : 'default',
          fontSize: 10,
          color: '#888',
          overflow: 'hidden'
        }}
        title="Click/drag = scrub · Right-click drag = pan · Ctrl+scroll = zoom"
      >
        {ticks.map((t) => (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: `${timeToPct(t)}%`,
              top: 0,
              bottom: 0,
              borderLeft: '1px solid #383838',
              paddingLeft: 3,
              pointerEvents: 'none'
            }}
          >
            {formatDuration(t)}
          </div>
        ))}
        {duration > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${timeToPct(currentTime)}%`,
              background: 'rgba(255, 77, 77, 0.18)',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>

      {/* Segment track row */}
      <div
        ref={trackRef}
        onMouseDown={onTrackMouseDown}
        onMouseMove={onTrackHoverMove}
        style={{
          position: 'relative',
          height: TRACK_HEIGHT,
          overflow: 'hidden',
          cursor:
            drag?.kind === 'edge'
              ? 'ew-resize'
              : drag?.kind === 'pan'
                ? 'grabbing'
                : hoverCursor
        }}
      >
        {sorted.map((s) => {
          const isSelected = selected.has(s.id);
          const leftPct = timeToPct(s.start);
          const rightPct = timeToPct(s.end);
          if (rightPct < 0 || leftPct > 100) return null;
          return (
            <div
              key={s.id}
              data-segment-id={s.id}
              style={{
                position: 'absolute',
                top: 8,
                bottom: 8,
                left: `${leftPct}%`,
                width: `${rightPct - leftPct}%`,
                background: isSelected
                  ? 'rgba(96, 205, 255, 0.55)'
                  : 'rgba(96, 205, 255, 0.28)',
                border: isSelected
                  ? '2px solid #60cdff'
                  : '1px solid rgba(96, 205, 255, 0.6)',
                borderRadius: 2,
                pointerEvents: 'none'
              }}
            />
          );
        })}

        {createPreview && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              bottom: 8,
              left: `${timeToPct(createPreview.start)}%`,
              width: `${timeToPct(createPreview.end) - timeToPct(createPreview.start)}%`,
              background: 'rgba(255, 213, 79, 0.35)',
              border: '1px dashed #ffd54f',
              pointerEvents: 'none'
            }}
          />
        )}

        {pendingIn != null && duration > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${timeToPct(pendingIn)}%`,
              width: 2,
              background: '#ffd54f',
              pointerEvents: 'none'
            }}
            title={`Pending in-point @ ${pendingIn.toFixed(2)}s`}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                background: '#ffd54f',
                color: '#1a1a1a',
                fontSize: 9,
                padding: '0 3px',
                fontWeight: 600
              }}
            >
              IN
            </div>
          </div>
        )}
      </div>

      {/* Playhead spans scrubber + track rows (not the scrollbar) */}
      {duration > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            height: SCRUBBER_HEIGHT + TRACK_HEIGHT,
            left: `${timeToPct(currentTime)}%`,
            width: 2,
            background: '#ff4d4d',
            pointerEvents: 'none',
            transform: 'translateX(-1px)',
            display: timeToPct(currentTime) < 0 || timeToPct(currentTime) > 100 ? 'none' : 'block'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: -5,
              width: 12,
              height: 12,
              background: '#ff4d4d',
              borderRadius: 2,
              boxShadow: '0 1px 2px rgba(0,0,0,0.6)'
            }}
          />
        </div>
      )}

      {/* Stylish thin scrollbar */}
      <div
        ref={scrollbarRef}
        onMouseDown={onScrollbarTrackMouseDown}
        style={{
          position: 'relative',
          height: SCROLLBAR_HEIGHT,
          background: '#181818',
          borderTop: '1px solid #2a2a2a',
          cursor: duration > 0 ? 'pointer' : 'default'
        }}
      >
        {duration > 0 && (
          <div
            data-role="thumb"
            style={{
              position: 'absolute',
              top: 1,
              bottom: 1,
              left: `${scrollbarThumbStartPct}%`,
              width: `${scrollbarThumbWidthPct}%`,
              minWidth: 10,
              background: drag?.kind === 'scrollbar-thumb' ? '#7aa6c8' : '#4a4a4a',
              borderRadius: 3,
              cursor: 'grab',
              transition: drag?.kind === 'scrollbar-thumb' ? 'none' : 'background 120ms'
            }}
            onMouseEnter={(e) => {
              if (drag?.kind !== 'scrollbar-thumb')
                (e.currentTarget as HTMLDivElement).style.background = '#5a5a5a';
            }}
            onMouseLeave={(e) => {
              if (drag?.kind !== 'scrollbar-thumb')
                (e.currentTarget as HTMLDivElement).style.background = '#4a4a4a';
            }}
          />
        )}
      </div>
    </div>
  );
}
