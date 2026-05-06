import { useCallback, useEffect, useRef, useState } from 'react';
import { AppToolbar } from './components/Toolbar';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { StatusBar } from './components/StatusBar';
import { ExportDialog } from './components/ExportDialog';
import { usePlayer } from './hooks/usePlayer';
import { useSegments } from './hooks/useSegments';
import { useSelection } from './hooks/useSelection';
import { totalSelectedDuration } from './lib/segments';
import type { ExportProgress } from '../shared/types';

export function App() {
  const player = usePlayer();
  const segs = useSegments(player.duration);
  const sel = useSelection(segs.segments);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const fullscreenWrapperRef = useRef<HTMLDivElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<{
    ok: boolean;
    message: string;
    outPath?: string;
  } | null>(null);

  const handleOpen = useCallback(async () => {
    const result = await window.api.openVideo();
    if (!result) return;
    setVideoSrc(result.url);
    setVideoPath(result.path);
    setFileName(result.name);
    segs.reset();
    sel.clear();
  }, [segs, sel]);

  const handleInvert = useCallback(() => {
    segs.invert();
    sel.clear();
  }, [segs, sel]);

  const toggleFullscreen = useCallback(() => {
    const wrap = fullscreenWrapperRef.current;
    if (!wrap) return;
    if (document.fullscreenElement === wrap) {
      void document.exitFullscreen();
    } else {
      void wrap.requestFullscreen();
    }
  }, []);

  // Export flow
  const startExport = useCallback(async () => {
    if (!videoPath || segs.segments.length === 0) return;
    const defaultName = (fileName ?? 'output.mp4').replace(/\.[^.]+$/, '') + '_trimmed.mp4';
    const outPath = await window.api.chooseExportPath(defaultName);
    if (!outPath) return;
    setExportOpen(true);
    setExportProgress(null);
    setExportResult(null);
    const off = window.api.onExportProgress((p) => setExportProgress(p));
    try {
      const res = await window.api.exportSegments({
        inputPath: videoPath,
        segments: segs.segments.map((s) => ({ start: s.start, end: s.end })),
        outputPath: outPath,
        rotation: segs.rotation
      });
      if (res.ok) {
        setExportResult({ ok: true, message: 'Export complete', outPath: res.outPath });
      } else {
        setExportResult({ ok: false, message: res.error });
      }
    } catch (err) {
      setExportResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err)
      });
    } finally {
      off();
    }
  }, [videoPath, segs.segments, segs.rotation, fileName]);

  const cancelExport = useCallback(async () => {
    await window.api.cancelExport();
  }, []);

  // Global keyboard shortcuts.
  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;

      // Ctrl chords first.
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'o' || e.key === 'O') {
          e.preventDefault();
          void handleOpen();
          return;
        }
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          void startExport();
          return;
        }
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          sel.selectAll();
          return;
        }
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) segs.redo();
          else segs.undo();
          return;
        }
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          segs.redo();
          return;
        }
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          player.togglePlayPause();
          break;
        case 'j':
        case 'J':
          e.preventDefault();
          player.playBackward();
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          player.pause();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          player.playForward();
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          // Multiple I presses just shift the pending in-point; existing segments untouched.
          segs.setPendingInPoint(player.currentTime);
          break;
        case 'o':
        case 'O':
          e.preventDefault();
          segs.commitOutPoint(player.currentTime);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          segs.rotate();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Delete':
        case 'Backspace':
          if (sel.selected.size > 0) {
            e.preventDefault();
            segs.deleteSegments(sel.selected);
            sel.clear();
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (document.fullscreenElement) {
            void document.exitFullscreen();
          }
          segs.setPendingInPoint(null);
          sel.clear();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          player.step(e.shiftKey ? -1 : -1 / 30);
          break;
        case 'ArrowRight':
          e.preventDefault();
          player.step(e.shiftKey ? 1 : 1 / 30);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleOpen, player, segs, sel, startExport, toggleFullscreen]);

  const handleSegmentClick = useCallback(
    (id: string, m: { ctrl: boolean; shift: boolean }) => {
      if (m.shift) sel.rangeTo(id);
      else if (m.ctrl) sel.toggle(id);
      else sel.replaceWith(id);
    },
    [sel]
  );

  const selectedTotalSec = totalSelectedDuration(segs.segments, sel.selected);

  // Push dirty state to main so it can warn on quit.
  useEffect(() => {
    window.api.setDirty(segs.segments.length > 0);
  }, [segs.segments.length]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#202020'
      }}
    >
      <AppToolbar
        onOpen={handleOpen}
        onInvert={handleInvert}
        onExport={startExport}
        onRotate={segs.rotate}
        videoLoaded={!!videoSrc}
        segmentCount={segs.segments.length}
        rotation={segs.rotation}
        fileName={fileName}
      />

      <div
        ref={fullscreenWrapperRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          background: '#1a1a1a'
        }}
      >
        <VideoPlayer
          videoRef={player.videoRefCallback}
          src={videoSrc}
          currentTime={player.currentTime}
          duration={player.duration}
          isPlaying={player.isPlaying}
          direction={player.direction}
          speed={player.speed}
          setSpeed={player.setSpeed}
          muted={player.muted}
          rotation={segs.rotation}
          onToggleMute={player.toggleMute}
          onPlayForward={player.playForward}
          onPlayBackward={player.playBackward}
          onPause={player.pause}
          onToggleFullscreen={toggleFullscreen}
        />
        <Timeline
          duration={player.duration}
          currentTime={player.currentTime}
          segments={segs.segments}
          selected={sel.selected}
          pendingIn={segs.pendingIn}
          onSeek={player.seek}
          onCreateSegment={(a, b) => segs.addSegment(a, b)}
          onBeginEdit={segs.beginEdit}
          onResizeEdge={segs.resizeEdge}
          onSegmentClick={handleSegmentClick}
          onClearSelection={sel.clear}
        />
      </div>

      <StatusBar
        duration={player.duration}
        segmentCount={segs.segments.length}
        selectedCount={sel.selected.size}
        selectedDuration={selectedTotalSec}
        pendingIn={segs.pendingIn}
      />

      <ExportDialog
        open={exportOpen}
        progress={exportProgress}
        result={exportResult}
        onCancel={() => void cancelExport()}
        onClose={() => {
          setExportOpen(false);
          setExportProgress(null);
          setExportResult(null);
        }}
      />
    </div>
  );
}
