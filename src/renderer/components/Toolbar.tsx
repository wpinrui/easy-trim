import { Toolbar, ToolbarButton, ToolbarDivider, Tooltip } from '@fluentui/react-components';
import {
  FolderOpen24Regular,
  ArrowSwap24Regular,
  Save24Regular,
  ArrowRotateClockwise24Regular
} from '@fluentui/react-icons';

type Props = {
  onOpen: () => void;
  onInvert: () => void;
  onExport: () => void;
  onRotate: () => void;
  videoLoaded: boolean;
  segmentCount: number;
  rotation: 0 | 90 | 180 | 270;
  fileName: string | null;
};

export function AppToolbar({
  onOpen,
  onInvert,
  onExport,
  onRotate,
  videoLoaded,
  segmentCount,
  rotation,
  fileName
}: Props) {
  return (
    <Toolbar
      aria-label="Main toolbar"
      style={{
        background: '#2b2b2b',
        borderBottom: '1px solid #3a3a3a',
        padding: '4px 8px',
        gap: 4
      }}
    >
      <Tooltip content="Open MP4… (Ctrl+O)" relationship="label">
        <ToolbarButton
          appearance="subtle"
          icon={<FolderOpen24Regular />}
          onClick={onOpen}
        >
          Open
        </ToolbarButton>
      </Tooltip>
      <ToolbarDivider />
      <Tooltip content="Invert segments (replace with their complement)" relationship="label">
        <ToolbarButton
          appearance="subtle"
          icon={<ArrowSwap24Regular />}
          onClick={onInvert}
          disabled={!videoLoaded}
        >
          Invert
        </ToolbarButton>
      </Tooltip>
      <Tooltip content={`Rotate 90° clockwise (R) — current: ${rotation}°`} relationship="label">
        <ToolbarButton
          appearance="subtle"
          icon={<ArrowRotateClockwise24Regular />}
          onClick={onRotate}
          disabled={!videoLoaded}
        >
          Rotate
        </ToolbarButton>
      </Tooltip>
      <Tooltip content="Export selected segments… (Ctrl+E)" relationship="label">
        <ToolbarButton
          appearance="primary"
          icon={<Save24Regular />}
          onClick={onExport}
          disabled={!videoLoaded || segmentCount === 0}
        >
          Export…
        </ToolbarButton>
      </Tooltip>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: '#bbb', paddingRight: 8 }}>
        {fileName ?? 'No video loaded'}
      </span>
    </Toolbar>
  );
}
