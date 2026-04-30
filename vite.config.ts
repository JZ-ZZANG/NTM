import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM 환경에서 __dirname 정의
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [
    react(),
    electron([
      {
        // 메인 프로세스 엔트리
        entry: path.join(__dirname, 'src/main/index.ts'),
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron/main'),
            rollupOptions: {
              // Electron과 네이티브 모듈을 번들링에서 제외합니다.
              external: ['electron', 'sharp'],
              output: {
                // 메인 프로세스도 CJS로 출력하면 __dirname 처리가 더 안정적입니다.
                format: 'cjs',
                entryFileNames: '[name].js',
              },
            },
          },
        },
      },
      {
        // 프리로드 스크립트 엔트리 (별도 빌드 필요)
        entry: path.join(__dirname, 'src/main/preload.ts'),
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron/preload'),
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
              },
            },
            lib: {
              entry: path.resolve(__dirname, 'src/main/preload.ts'),
              formats: ['cjs'],
              // 라이브러리 모드에서 파일 이름을 고정합니다.
              fileName: () => 'preload.cjs',
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});