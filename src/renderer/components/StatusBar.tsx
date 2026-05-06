import { formatTime } from '../lib/format';

type Props = {
  duration: number;
  segmentCount: number;
  selectedCount: number;
  selectedDuration: number;
  pendingIn: number | null;
};

export function StatusBar({
  duration,
  segmentCount,
  selectedCount,
  selectedDuration,
  pendingIn
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        padding: '4px 12px',
        fontSize: 12,
        color: '#bbb',
        background: '#262626',
        borderTop: '1px solid #3a3a3a',
        height: 26
      }}
    >
      <span>Duration: {formatTime(duration)}</span>
      <span>Segments: {segmentCount}</span>
      <span>Selected: {selectedCount}</span>
      <span>Selected total: {formatTime(selectedDuration)}</span>
      {pendingIn != null && (
        <span style={{ color: '#ffd54f' }}>Pending IN @ {formatTime(pendingIn)} (press O to commit)</span>
      )}
      <div style={{ flex: 1 }} />
      <span style={{ color: '#777' }}>
        Drag on timeline = create · I/O = mark · Click/Ctrl/Shift = select · Del = delete · F = fullscreen
      </span>
    </div>
  );
}
