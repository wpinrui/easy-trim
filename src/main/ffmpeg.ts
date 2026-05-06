import { ipcMain, BrowserWindow, app } from 'electron';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import type { ExportProgress, ExportRequest, ExportResult } from '../shared/types';

const require = createRequire(import.meta.url);

function resolveFfmpegPath(): string {
  // ffmpeg-static exports the path to the bundled binary as default export.
  // In production it lives inside app.asar.unpacked.
  let ffmpegPath: string = require('ffmpeg-static');
  if (app.isPackaged) {
    ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
  }
  return ffmpegPath;
}

let activeProcess: ChildProcessWithoutNullStreams | null = null;
let cancelled = false;

function emitProgress(win: BrowserWindow | null, p: ExportProgress) {
  win?.webContents.send('export-progress', p);
}

function spawnFfmpeg(args: string[]): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(resolveFfmpegPath(), args, { windowsHide: true });
    activeProcess = proc;
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => {
      activeProcess = null;
      reject(err);
    });
    proc.on('close', (code) => {
      activeProcess = null;
      if (cancelled) {
        reject(new Error('cancelled'));
      } else if (code === 0) {
        resolve({ stderr });
      } else {
        reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
      }
    });
  });
}

function spawnFfmpegWithProgress(
  args: string[],
  totalDurationSec: number,
  onProgress: (fractionOfThisRun: number) => void
): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(resolveFfmpegPath(), args, { windowsHide: true });
    activeProcess = proc;
    let stderr = '';
    let stdoutBuf = '';
    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';
      for (const line of lines) {
        const m = line.match(/^out_time_ms=(\d+)/);
        if (m && totalDurationSec > 0) {
          const seconds = Number(m[1]) / 1_000_000;
          const f = Math.max(0, Math.min(1, seconds / totalDurationSec));
          onProgress(f);
        }
      }
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => {
      activeProcess = null;
      reject(err);
    });
    proc.on('close', (code) => {
      activeProcess = null;
      if (cancelled) {
        reject(new Error('cancelled'));
      } else if (code === 0) {
        resolve({ stderr });
      } else {
        reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
      }
    });
  });
}

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'easy-trim-'));
}

async function rimraf(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

function mergeSegments(
  segments: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  const sorted = segments
    .filter((s) => s.end > s.start)
    .slice()
    .sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

export function registerFfmpegHandlers() {
  ipcMain.handle('export-segments', async (event, req: ExportRequest): Promise<ExportResult> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    cancelled = false;

    const segs = mergeSegments(req.segments);
    if (segs.length === 0) {
      return { ok: false, error: 'No segments to export.' };
    }

    const totalDuration = segs.reduce((sum, s) => sum + (s.end - s.start), 0);
    const tempDir = await makeTempDir();
    const tsFiles: string[] = [];

    try {
      // Phase 1: encode each segment to MPEG-TS
      let elapsed = 0;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const segDur = seg.end - seg.start;
        const outFile = path.join(tempDir, `seg${i}.ts`);
        tsFiles.push(outFile);

        emitProgress(win, {
          percent: (elapsed / totalDuration) * 90,
          stage: 'encoding',
          segmentIndex: i,
          segmentCount: segs.length
        });

        const args = [
          '-hide_banner',
          '-loglevel',
          'error',
          '-progress',
          'pipe:1',
          '-ss',
          String(seg.start),
          '-to',
          String(seg.end),
          '-i',
          req.inputPath,
          '-c:v',
          'libx264',
          '-crf',
          '21',
          '-preset',
          'medium',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-avoid_negative_ts',
          'make_zero',
          '-f',
          'mpegts',
          '-y',
          outFile
        ];

        const startElapsed = elapsed;
        await spawnFfmpegWithProgress(args, segDur, (f) => {
          const overall = ((startElapsed + f * segDur) / totalDuration) * 90;
          emitProgress(win, {
            percent: overall,
            stage: 'encoding',
            segmentIndex: i,
            segmentCount: segs.length
          });
        });
        elapsed += segDur;
      }

      // Phase 2: concat via concat protocol with stream copy.
      emitProgress(win, { percent: 92, stage: 'concatenating' });
      const concatInput = `concat:${tsFiles.join('|')}`;
      const concatArgs = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        concatInput,
        '-c',
        'copy',
        '-bsf:a',
        'aac_adtstoasc',
        '-movflags',
        '+faststart',
        '-y',
        req.outputPath
      ];
      await spawnFfmpeg(concatArgs);

      emitProgress(win, { percent: 100, stage: 'finalizing' });
      return { ok: true, outPath: req.outputPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    } finally {
      await rimraf(tempDir);
    }
  });

  ipcMain.handle('cancel-export', async () => {
    cancelled = true;
    if (activeProcess && !activeProcess.killed) {
      activeProcess.kill('SIGKILL');
    }
  });
}
