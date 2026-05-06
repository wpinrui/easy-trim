import { useCallback, useEffect, useRef, useState } from 'react';

export type PlaybackDirection = 'forward' | 'backward' | 'paused';

export function usePlayer() {
  // Element is tracked in *state* (not just a ref) so effects re-run when the
  // <video> mounts after the user opens a file. A plain ref doesn't trigger
  // re-renders, which previously left the timeupdate listener unattached and
  // pinned currentTime at 0.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const videoRefCallback = useCallback((el: HTMLVideoElement | null) => {
    setVideoEl(el);
  }, []);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [direction, setDirection] = useState<PlaybackDirection>('paused');
  const [speed, setSpeed] = useState(1);

  // Apply forward speed to the video element when either changes.
  useEffect(() => {
    if (videoEl) videoEl.playbackRate = speed;
  }, [speed, videoEl]);

  // Reverse playback uses rAF, since Chromium does not honor negative playbackRate reliably.
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  const stopReverseLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTickRef.current = null;
  }, []);

  const startReverseLoop = useCallback(
    (rate: number) => {
      stopReverseLoop();
      const tick = (now: number) => {
        if (!videoEl) {
          stopReverseLoop();
          return;
        }
        if (lastTickRef.current == null) lastTickRef.current = now;
        const dt = (now - lastTickRef.current) / 1000;
        lastTickRef.current = now;
        const next = Math.max(0, videoEl.currentTime - rate * dt);
        videoEl.currentTime = next;
        if (next <= 0) {
          stopReverseLoop();
          setIsPlaying(false);
          setDirection('paused');
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [stopReverseLoop, videoEl]
  );

  useEffect(() => () => stopReverseLoop(), [stopReverseLoop]);

  const playForward = useCallback(() => {
    if (!videoEl) return;
    stopReverseLoop();
    videoEl.playbackRate = speed;
    void videoEl.play();
    setIsPlaying(true);
    setDirection('forward');
  }, [speed, stopReverseLoop, videoEl]);

  const playBackward = useCallback(() => {
    if (!videoEl) return;
    videoEl.pause();
    setIsPlaying(true);
    setDirection('backward');
    startReverseLoop(speed);
  }, [speed, startReverseLoop, videoEl]);

  const pause = useCallback(() => {
    if (videoEl) videoEl.pause();
    stopReverseLoop();
    setIsPlaying(false);
    setDirection('paused');
  }, [stopReverseLoop, videoEl]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) pause();
    else playForward();
  }, [isPlaying, pause, playForward]);

  const seek = useCallback(
    (t: number) => {
      if (!videoEl) return;
      videoEl.currentTime = Math.max(0, Math.min(videoEl.duration || t, t));
    },
    [videoEl]
  );

  const step = useCallback(
    (deltaSeconds: number) => {
      if (!videoEl) return;
      pause();
      seek(videoEl.currentTime + deltaSeconds);
    },
    [pause, seek, videoEl]
  );

  // When speed changes during reverse playback, restart the loop with the new rate.
  useEffect(() => {
    if (direction === 'backward') startReverseLoop(speed);
  }, [speed, direction, startReverseLoop]);

  // Sync to media events. Re-attaches when the <video> mounts/unmounts.
  useEffect(() => {
    if (!videoEl) return;
    const onTime = () => setCurrentTime(videoEl.currentTime);
    const onMeta = () => setDuration(Number.isFinite(videoEl.duration) ? videoEl.duration : 0);
    const onEnd = () => {
      setIsPlaying(false);
      setDirection('paused');
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      // Keep React state in sync if the video element pauses for any reason.
      setIsPlaying(false);
      setDirection((d) => (d === 'backward' ? d : 'paused'));
    };
    videoEl.addEventListener('timeupdate', onTime);
    videoEl.addEventListener('seeking', onTime);
    videoEl.addEventListener('seeked', onTime);
    videoEl.addEventListener('loadedmetadata', onMeta);
    videoEl.addEventListener('durationchange', onMeta);
    videoEl.addEventListener('ended', onEnd);
    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('pause', onPause);
    // Initialize from current state in case the video has already loaded by the time we attach.
    onMeta();
    onTime();
    return () => {
      videoEl.removeEventListener('timeupdate', onTime);
      videoEl.removeEventListener('seeking', onTime);
      videoEl.removeEventListener('seeked', onTime);
      videoEl.removeEventListener('loadedmetadata', onMeta);
      videoEl.removeEventListener('durationchange', onMeta);
      videoEl.removeEventListener('ended', onEnd);
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('pause', onPause);
    };
  }, [videoEl]);

  return {
    videoRefCallback,
    currentTime,
    duration,
    isPlaying,
    direction,
    speed,
    setSpeed,
    playForward,
    playBackward,
    pause,
    togglePlayPause,
    seek,
    step
  };
}
