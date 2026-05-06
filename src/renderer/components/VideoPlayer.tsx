import {
  Button,
  Dropdown,
  Option,
  Tooltip
} from '@fluentui/react-components';
import {
  Play24Filled,
  Pause24Filled,
  Rewind24Filled,
  Speaker224Regular,
  SpeakerMute24Filled,
  FullScreenMaximize24Regular
} from '@fluentui/react-icons';
import { formatTime } from '../lib/format';

type Props = {
  src: string | null;
  videoRef: (el: HTMLVideoElement | null) => void;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  direction: 'forward' | 'backward' | 'paused';
  speed: number;
  setSpeed: (s: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  onPlayForward: () => void;
  onPlayBackward: () => void;
  onPause: () => void;
  onToggleFullscreen: () => void;
};

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function VideoPlayer({
  src,
  videoRef,
  currentTime,
  duration,
  isPlaying,
  direction,
  speed,
  setSpeed,
  muted,
  onToggleMute,
  onPlayForward,
  onPlayBackward,
  onPause,
  onToggleFullscreen
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        background: '#1a1a1a'
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000'
        }}
      >
        {src ? (
          <video
            ref={videoRef}
            src={src}
            style={{ maxHeight: '100%', maxWidth: '100%' }}
            controls={false}
            preload="metadata"
            onClick={() => (isPlaying ? onPause() : onPlayForward())}
          />
        ) : (
          <div style={{ color: '#888', fontSize: 14 }}>
            Click <strong>Open</strong> to load an MP4 to start.
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: '#262626',
          borderTop: '1px solid #3a3a3a'
        }}
      >
        <Tooltip content="Play backward (J)" relationship="label">
          <Button
            appearance={direction === 'backward' ? 'primary' : 'subtle'}
            icon={<Rewind24Filled />}
            onClick={onPlayBackward}
            disabled={!src}
          />
        </Tooltip>
        <Tooltip
          content={isPlaying ? 'Pause (K / Space)' : 'Play (L / Space)'}
          relationship="label"
        >
          <Button
            appearance={direction === 'forward' ? 'primary' : 'subtle'}
            icon={isPlaying ? <Pause24Filled /> : <Play24Filled />}
            onClick={isPlaying ? onPause : onPlayForward}
            disabled={!src}
          />
        </Tooltip>
        <span
          style={{
            fontFamily: 'Consolas, monospace',
            fontSize: 13,
            minWidth: 180,
            color: '#ddd'
          }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <div style={{ flex: 1 }} />
        <Tooltip content="Playback speed" relationship="label">
          <Dropdown
            value={`${speed}×`}
            selectedOptions={[String(speed)]}
            onOptionSelect={(_, data) => {
              const v = Number(data.optionValue);
              if (Number.isFinite(v)) setSpeed(v);
            }}
            style={{ minWidth: 96 }}
          >
            {SPEEDS.map((s) => (
              <Option key={s} value={String(s)} text={`${s}×`}>
                {s}×
              </Option>
            ))}
          </Dropdown>
        </Tooltip>
        <Tooltip content={muted ? 'Unmute' : 'Mute'} relationship="label">
          <Button
            appearance={muted ? 'primary' : 'subtle'}
            icon={muted ? <SpeakerMute24Filled /> : <Speaker224Regular />}
            onClick={onToggleMute}
            disabled={!src}
          />
        </Tooltip>
        <Tooltip content="Toggle fullscreen (F)" relationship="label">
          <Button
            appearance="subtle"
            icon={<FullScreenMaximize24Regular />}
            onClick={onToggleFullscreen}
            disabled={!src}
          />
        </Tooltip>
      </div>
    </div>
  );
}
