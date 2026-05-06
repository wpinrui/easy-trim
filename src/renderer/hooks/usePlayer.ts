import { useCallback, useEffect, useRef, useState } from 'react';

export type PlaybackDirection = 'forward' | 'backward' | 'paused';

export function usePlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [direction, setDirection] = useState<PlaybackDirection>('paused');
  const [speed, setSpeed] = useState(1);

  // Apply forward speed to the video element.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
  }, [speed]);

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
        const v = videoRef.current;
        if (!v) {
          stopReverseLoop();
          return;
        }
        if (lastTickRef.current == null) lastTickRef.current = now;
        const dt = (now - lastTickRef.current) / 1000;
        lastTickRef.current = now;
        const next = Math.max(0, v.currentTime - rate * dt);
        v.currentTime = next;
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
    [stopReverseLoop]
  );

  useEffect(() => () => stopReverseLoop(), [stopReverseLoop]);

  const playForward = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    stopReverseLoop();
    v.playbackRate = speed;
    void v.play();
    setIsPlaying(true);
    setDirection('forward');
  }, [speed, stopReverseLoop]);

  const playBackward = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setIsPlaying(true);
    setDirection('backward');
    startReverseLoop(speed);
  }, [speed, startReverseLoop]);

  const pause = useCallback(() => {
    const v = videoRef.current;
    if (v) v.pause();
    stopReverseLoop();
    setIsPlaying(false);
    setDirection('paused');
  }, [stopReverseLoop]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) pause();
    else playForward();
  }, [isPlaying, pause, playForward]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || t, t));
  }, []);

  const step = useCallback(
    (deltaSeconds: number) => {
      const v = videoRef.current;
      if (!v) return;
      pause();
      seek(v.currentTime + deltaSeconds);
    },
    [pause, seek]
  );

  // When speed changes during reverse playback, restart the loop with the new rate.
  useEffect(() => {
    if (direction === 'backward') startReverseLoop(speed);
  }, [speed, direction, startReverseLoop]);

  // Sync to media events.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () => setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    const onEnd = () => {
      setIsPlaying(false);
      setDirection('paused');
    };
    const onPause = () => {
      // If paused due to reaching end / external action, sync our state.
      if (direction === 'forward') {
        setIsPlaying(false);
        setDirection('paused');
      }
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('seeking', onTime);
    v.addEventListener('seeked', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('durationchange', onMeta);
    v.addEventListener('ended', onEnd);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('seeking', onTime);
      v.removeEventListener('seeked', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('durationchange', onMeta);
      v.removeEventListener('ended', onEnd);
      v.removeEventListener('pause', onPause);
    };
    // We attach once per videoRef.current — re-running on every direction change is fine.
  }, [direction]);

  return {
    videoRef,
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
