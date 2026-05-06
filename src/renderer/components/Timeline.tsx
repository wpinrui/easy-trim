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
  onResizeEdge: (id: string, edge: 'start' | 'end', newValue: number) => void;
  onSegmentClick: (id: string, modifiers: { ctrl: boolean; shift: boolean }) => void;
  onClearSelection: () => void;
};

const EDGE_HIT_PX = 6;
const TRACK_HEIGHT = 64;
const SCRUBBER_HEIGHT = 28;

type Drag =
  | { kind: 'create'; startX: number; currentX: number }
  | { kind: 'edge'; id: string; edge: 'start' | 'end' }
  | { kind: 'scrub' }
  | null;

export function Timeline({
  duration,
  currentTime,
  segments,
  selected,
  pendingIn,
  onSeek,
  onCreateSegment,
  onResizeEdge,
  onSegmentClick,
  onClearSelection
}: Props) {
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const sorted = useMemo(() => sortSegments(segments), [segments]);

  const xToTimeOnElement = (clientX: number, el: HTMLElement | null): number => {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };
  const xToTime = (clientX: number) => xToTimeOnElement(clientX, trackRef.current);
  const timeToPct = (t: number): number =>
    duration <= 0 ? 0 : Math.max(0, Math.min(100, (t / duration) * 100));

  const findEdgeUnderCursor = (
    clientX: number
  ): { id: string; edge: 'start' | 'end' } | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    for (const s of sorted) {
      const xs = (s.start / duration) * rect.width;
      const xe = (s.end / duration) * rect.width;
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
      const xs = (s.start / duration) * rect.width;
      const xe = (s.end / duration) * rect.width;
      if (x >= xs + EDGE_HIT_PX && x <= xe - EDGE_HIT_PX) return s;
      if (xe - xs < EDGE_HIT_PX * 2 && x >= xs && x <= xe) return s;
    }
    return null;
  };

  const onScrubberMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || duration <= 0) return;
    e.preventDefault();
    onSeek(xToTimeOnElement(e.clientX, scrubberRef.current));
    setDrag({ kind: 'scrub' });
  };

  const onTrackMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || duration <= 0) return;
    const edge = findEdgeUnderCursor(e.clientX);
    if (edge) {
      e.preventDefault();
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
          // Click on empty area without drag: clear selection.
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

  // Track-row hover cursor (no scrub here — that lives on the scrubber).
  const [hoverCursor, setHoverCursor] = useState<string>('default');
  const onTrackHoverMove = (e: React.MouseEvent) => {
    if (drag) return;
    if (findEdgeUnderCursor(e.clientX)) setHoverCursor('ew-resize');
    else if (findSegmentUnderCursor(e.clientX)) setHoverCursor('pointer');
    else setHoverCursor('crosshair');
  };

  const ticks = useMemo(() => {
    if (duration <= 0) return [];
    const target = 8;
    const niceSteps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
    const ideal = duration / target;
    const step = niceSteps.find((s) => s >= ideal) ?? niceSteps[niceSteps.length - 1];
    const arr: number[] = [];
    for (let t = 0; t <= duration + 1e-6; t += step) arr.push(t);
    return arr;
  }, [duration]);

  let createPreview: { start: number; end: number } | null = null;
  if (drag?.kind === 'create') {
    const a = xToTime(drag.startX);
    const b = xToTime(drag.currentX);
    createPreview = { start: Math.min(a, b), end: Math.max(a, b) };
  }

  const totalHeight = SCRUBBER_HEIGHT + TRACK_HEIGHT;

  return (
    <div
      style={{
        position: 'relative',
        height: totalHeight,
        background: '#1f1f1f',
        borderTop: '1px solid #3a3a3a',
        userSelect: 'none'
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Scrubber row: click + drag anywhere to seek */}
      <div
        ref={scrubberRef}
        onMouseDown={onScrubberMouseDown}
        style={{
          position: 'relative',
          height: SCRUBBER_HEIGHT,
          background: '#272727',
          borderBottom: '1px solid #303030',
          cursor: duration > 0 ? (drag?.kind === 'scrub' ? 'grabbing' : 'pointer') : 'default',
          fontSize: 10,
          color: '#888'
        }}
        title="Click or drag to scrub"
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
        {/* Filled progress region from 0 → currentTime to make the scrubber readable */}
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
          cursor: drag?.kind === 'edge' ? 'ew-resize' : hoverCursor
        }}
      >
        {sorted.map((s) => {
          const isSelected = selected.has(s.id);
          return (
            <div
              key={s.id}
              data-segment-id={s.id}
              style={{
                position: 'absolute',
                top: 8,
                bottom: 8,
                left: `${timeToPct(s.start)}%`,
                width: `${timeToPct(s.end) - timeToPct(s.start)}%`,
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

      {/* Playhead spans both rows */}
      {duration > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${timeToPct(currentTime)}%`,
            width: 2,
            background: '#ff4d4d',
            pointerEvents: 'none',
            transform: 'translateX(-1px)'
          }}
        >
          {/* Playhead "head" handle on the scrubber row */}
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
    </div>
  );
}
