import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { Tag } from '../../shared/types';

export class TagService {
  private static tags: Tag[] = [];
  private static isLoaded = false;

  /**
   * tags.json 파일을 로드하여 메모리에 캐싱합니다.
   */
  private static async loadTags() {
    if (this.isLoaded) return;
    
    try {
      // 개발 및 빌드 환경 모두 고려한 경로 설정
      const dataPath = app.isPackaged
        ? path.join(process.resourcesPath, 'data', 'tags.json')
        : path.join(app.getAppPath(), 'data', 'tags.json');

      const content = await fs.readFile(dataPath, 'utf-8');
      this.tags = JSON.parse(content);
      this.isLoaded = true;
    } catch (error) {
      console.error('TagService: tags.json 로드 실패', error);
      this.tags = [];
    }
  }

  /**
   * 키워드 기반 태그 검색 (추천 기능용)
   * @param keyword 검색어
   * @param limit 반환할 최대 태그 수
   */
  static async suggestTags(keyword: string, limit = 15): Promise<Tag[]> {
    if (!keyword || keyword.trim() === '') return [];
    if (!this.isLoaded) await this.loadTags();
    
    const searchLower = keyword.toLowerCase();
    const searchWithSpace = searchLower.replace(/_/g, ' ');

    return this.tags
      .filter(tag => tag.value.toLowerCase().replace(/_/g, ' ').includes(searchWithSpace))
      .sort((a, b) => {
        const aVal = a.value.toLowerCase().replace(/_/g, ' ');
        const bVal = b.value.toLowerCase().replace(/_/g, ' ');

        // 1. 완전 일치 우선
        const aExact = aVal === searchWithSpace;
        const bExact = bVal === searchWithSpace;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // 2. 검색어로 시작하는 태그 우선
        const aStarts = aVal.startsWith(searchWithSpace);
        const bStarts = bVal.startsWith(searchWithSpace);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // 3. 나머지는 count(인기) 순 정렬
        return (b.count || 0) - (a.count || 0);
      })
      .slice(0, limit);
  }
}