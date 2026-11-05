import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    title: 'Counterline POS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const targetUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
  mainWindow.loadURL(targetUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('pos:print-receipt', async (_event, options: { silent?: boolean }) => {
  if (!mainWindow) return { ok: false };
  return new Promise((resolve) => {
    mainWindow?.webContents.print(
      {
        silent: Boolean(options?.silent),
        printBackground: true,
        margins: { marginType: 'none' },
      },
      (success, failureReason) => {
        resolve({ ok: success, error: failureReason });
      }
    );
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
