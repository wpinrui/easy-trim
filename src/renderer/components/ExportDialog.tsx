import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  ProgressBar
} from '@fluentui/react-components';
import type { ExportProgress } from '../../shared/types';

type Props = {
  open: boolean;
  progress: ExportProgress | null;
  result: { ok: boolean; message: string; outPath?: string } | null;
  onCancel: () => void;
  onClose: () => void;
};

export function ExportDialog({ open, progress, result, onCancel, onClose }: Props) {
  const stageLabel: Record<ExportProgress['stage'], string> = {
    encoding: 'Encoding segments…',
    concatenating: 'Concatenating…',
    finalizing: 'Finalizing…'
  };
  const fraction = progress ? Math.max(0, Math.min(1, progress.percent / 100)) : 0;

  return (
    <Dialog open={open} modalType="alert">
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Export</DialogTitle>
          <DialogContent>
            {result ? (
              result.ok ? (
                <div>
                  <p>Export completed.</p>
                  <p style={{ fontSize: 12, color: '#bbb', wordBreak: 'break-all' }}>
                    {result.outPath}
                  </p>
                </div>
              ) : (
                <div>
                  <p>Export failed.</p>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 12,
                      color: '#ff8080',
                      maxHeight: 240,
                      overflow: 'auto'
                    }}
                  >
                    {result.message}
                  </pre>
                </div>
              )
            ) : (
              <div>
                <p>
                  {progress
                    ? `${stageLabel[progress.stage]}${
                        progress.segmentCount
                          ? ` (${(progress.segmentIndex ?? 0) + 1} / ${progress.segmentCount})`
                          : ''
                      }`
                    : 'Starting export…'}
                </p>
                <ProgressBar value={fraction} thickness="large" />
                <p style={{ fontSize: 12, color: '#bbb' }}>
                  {progress ? `${progress.percent.toFixed(0)}%` : ''}
                </p>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            {result ? (
              <Button appearance="primary" onClick={onClose}>
                Close
              </Button>
            ) : (
              <Button appearance="secondary" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
