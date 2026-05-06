export type Segment = {
  id: string;
  start: number;
  end: number;
};

export type OpenVideoResult = {
  path: string;
  url: string;
  name: string;
} | null;

export type ExportRequest = {
  inputPath: string;
  segments: Array<{ start: number; end: number }>;
  outputPath: string;
};

export type ExportProgress = {
  percent: number;
  stage: 'encoding' | 'concatenating' | 'finalizing';
  segmentIndex?: number;
  segmentCount?: number;
};

export type ExportResult = { ok: true; outPath: string } | { ok: false; error: string };

export type Api = {
  openVideo: () => Promise<OpenVideoResult>;
  chooseExportPath: (defaultName: string) => Promise<string | null>;
  exportSegments: (req: ExportRequest) => Promise<ExportResult>;
  onExportProgress: (cb: (p: ExportProgress) => void) => () => void;
  cancelExport: () => Promise<void>;
  setDirty: (dirty: boolean) => void;
};
