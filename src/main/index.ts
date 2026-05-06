import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { registerFfmpegHandlers } from './ffmpeg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = !app.isPackaged;

// Dirty flag set by the renderer whenever it has unsaved segments.
let isDirty = false;
let allowClose = false;

ipcMain.on('set-dirty', (_event, dirty: boolean) => {
  isDirty = !!dirty;
});

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: '#202020',
    title: 'Easy Trim',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Allow <video> to load `file:///` URLs of user-picked local media.
      // Same approach used in the chopchop editor; safe here because the renderer
      // only loads bundled HTML/JS plus user-chosen media (no remote content).
      webSecurity: false
    }
  });

  win.setMenuBarVisibility(false);

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  win.on('close', (e) => {
    if (allowClose || !isDirty) return;
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Quit anyway', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Easy Trim',
      message: 'You have unsaved segments.',
      detail: 'Quitting now will discard them. Continue?',
      noLink: true
    });
    if (choice === 0) {
      allowClose = true;
      win.close();
    }
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

ipcMain.handle('open-video', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    title: 'Open MP4 video',
    properties: ['openFile'],
    filters: [{ name: 'MP4 video', extensions: ['mp4', 'm4v', 'mov'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  return {
    path: filePath,
    url: pathToFileURL(filePath).href,
    name: path.basename(filePath)
  };
});

ipcMain.handle('choose-export-path', async (event, defaultName: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  const result = await dialog.showSaveDialog(win, {
    title: 'Export trimmed video',
    defaultPath: defaultName,
    filters: [{ name: 'MP4 video', extensions: ['mp4'] }]
  });
  return result.canceled || !result.filePath ? null : result.filePath;
});

registerFfmpegHandlers();

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
