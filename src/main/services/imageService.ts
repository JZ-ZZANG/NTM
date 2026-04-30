import sharp from 'sharp';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { AppSettings, ProcessProgress } from '../../shared/types';

interface Task {
  src: string;
  dest: string;
}

export class ImageService {
  private static async buildFolderTasks(dir: string, baseDir: string, destRoot: string, settings: AppSettings['tagremover']): Promise<Task[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let tasks: Task[] = [];
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        tasks = tasks.concat(await this.buildFolderTasks(fullPath, baseDir, destRoot, settings));
      } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
        const relativePath = path.relative(baseDir, fullPath);
        const parsed = path.parse(relativePath);
        
        const ext = settings.outputFormat === 'same' ? parsed.ext : `.${settings.outputFormat}`;
        const destRelativePath = path.join(parsed.dir, parsed.name + ext);
        
        tasks.push({
          src: fullPath,
          dest: path.join(destRoot, destRelativePath)
        });
      }
    }
    return tasks;
  }

  private static getUniquePath(destPath: string): string {
    if (!existsSync(destPath)) return destPath;
    const parsed = path.parse(destPath);
    let counter = 2;
    let newPath = destPath;
    while (existsSync(newPath)) {
      newPath = path.join(parsed.dir, `${parsed.name} (${counter})${parsed.ext}`);
      counter++;
    }
    return newPath;
  }

  static async processTagRemoval(
    items: { name: string, path: string }[],
    settings: AppSettings['tagremover'],
    onProgress: (progress: ProcessProgress) => void
  ) {
    const tasks: Task[] = [];

    // 1. 작업 리스트 빌드
    for (const item of items) {
      try {
        const stats = await fs.stat(item.path);
        const targetBaseDir = settings.outputMode === 'source' ? path.dirname(item.path) : settings.outputDir;

        if (stats.isDirectory()) {
          // 폴더: 상위 폴더명에만 prefix 적용
          const destRoot = path.join(targetBaseDir, `${settings.prefix}${item.name}`);
          tasks.push(...(await this.buildFolderTasks(item.path, item.path, destRoot, settings)));
        } else if (/\.(jpe?g|png|webp)$/i.test(item.name)) {
          // 파일: 파일명에 prefix 적용
          const parsed = path.parse(item.name);
          const ext = settings.outputFormat === 'same' ? parsed.ext : `.${settings.outputFormat}`;
          tasks.push({
            src: item.path,
            dest: path.join(targetBaseDir, `${settings.prefix}${parsed.name}${ext}`)
          });
        }
      } catch (e) {
        console.error(`Task build error: ${item.path}`, e);
      }
    }

    const total = tasks.length;
    if (total === 0) return;

    // 2. 이미지 처리 실행
    for (let i = 0; i < total; i++) {
      const task = tasks[i];
      try {
        let finalDest = task.dest;

        // 이름 충돌 처리
        if (existsSync(finalDest)) {
          if (settings.conflictResolution === 'skip') {
            continue;
          } else if (settings.conflictResolution === 'rename') {
            finalDest = this.getUniquePath(finalDest);
          }
        }

        await fs.mkdir(path.dirname(finalDest), { recursive: true });

        // 출력 포맷 결정 (jpg는 sharp 표준인 jpeg로 변환)
        let format = settings.outputFormat === 'same' 
          ? path.extname(task.src).toLowerCase().slice(1)
          : settings.outputFormat;
        
        if (format === 'jpg') format = 'jpeg';
        const finalFormat = format as any;

        // [태그 제거 핵심 로직: Raw Buffer Re-encoding]
        // 이미지를 픽셀 단위의 Raw Buffer로 분해한 뒤 새롭게 인코딩합니다.
        
        // 1. 원본에서 Raw 픽셀 데이터(RGBA) 추출
        const { data, info } = await sharp(task.src)
          .ensureAlpha() // 4채널로 통일하여 데이터 누락 방지
          .raw()
          .toBuffer({ resolveWithObject: true });

        // 2. 추출된 픽셀 데이터를 바탕으로 새 이미지 생성
        await sharp(data, {
          raw: {
            width: info.width,
            height: info.height,
            channels: info.channels
          }
        })
          .flatten({ background: '#ffffff' }) // 흰색 배경과 합성 (A채널 값 초기화)
          .removeAlpha() // 알파 채널 자체를 제거하여 RGB로 변환 (선택 사항이나 가장 확실함)
          .toFormat(finalFormat)
          .toFile(finalDest);

      } catch (error) {
        console.error(`Processing error ${task.src}:`, error);
      }

      onProgress({
        total,
        current: i + 1,
        percentage: Math.round(((i + 1) / total) * 100)
      });
    }
  }
}