import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sharp from 'sharp';
import { ImageService } from './services/imageService';
import { NaimetaService } from './services/naimetaService';
import { TagService } from './services/tagService';

// ESM 환경에서 __dirname 정의
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// sharp의 파일 캐시 기능을 전역적으로 비활성화합니다.
// 이 설정이 있어야 Windows에서 이미지를 읽은 후 파일 잠금이 즉시 해제됩니다.
sharp.cache(false);

function createWindow() {
  const preloadPath = path.resolve(__dirname, '../preload/preload.cjs');
  
  console.log('>>> [Main] Looking for preload at:', preloadPath);
  console.log('>>> [Main] Preload file exists:', fs.existsSync(preloadPath));

  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 커스텀 상단바 사용을 위해 기본 프레임 제거
    backgroundColor: '#1e1e1e', // 창이 뜨기 전 깜빡임 방지
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.resolve(__dirname, '../../dist/index.html'));
  }

  // 외부 링크(target="_blank") 요청 시 시스템 기본 브라우저로 연결
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' }; // 새 일렉트론 창이 뜨는 것을 방지
  });

  // 창 상태 변경 감시 및 전달
  mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized-status', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximized-status', false));
}

// 윈도우 컨트롤 IPC 핸들러
// createWindow 함수 외부에서 한 번만 등록하여 리스너 중복 방지 및 메모리 관리를 최적화합니다.
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.minimize();
});

ipcMain.handle('get-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win?.isMaximized() ?? false;
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win?.isMaximized()) win.unmaximize();
  else win?.maximize();
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.close();
});

ipcMain.handle('select-directory', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
  });
  
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('start-tag-removal', async (event, items, settings) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  await ImageService.processTagRemoval(items, settings, (progress) => {
    win?.webContents.send('process-progress', progress);
  });
});

ipcMain.handle('save-json-file', async (_event, { path: dirPath, fileName, data }) => {
  try {
    const fullPath = path.join(dirPath, fileName);
    // 객체를 들여쓰기 포함된 JSON 문자열로 변환하여 저장
    await fs.promises.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (error: any) {
    console.error('Main: 파일 저장 실패', error);
    throw error; // 프론트엔드 catch 블록으로 에러 전달
  }
});

// 태그 자동완성 제안 핸들러
ipcMain.handle('suggest-tags', async (_event, keyword) => {
  return await TagService.suggestTags(keyword);
});

ipcMain.handle('extract-image-metadata', async (_event, imagePath: string) => {
  try {
    const result = await NaimetaService.extractStealthMetadata(imagePath);
    // 태그 추출이 정상적으로 이루어지는지 콘솔 확인용
    // console.log('>>> [Main] Extracted metadata:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    // Stealth 메타데이터가 없는 경우 등 에러 발생 시 null 반환하여 프론트에서 처리 유도
    return null;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});