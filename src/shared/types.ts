/**
 * Danbooru 태그 구조 정의
 */
export interface Tag {
  label: string;
  value: string;
  count: number;
  type: string;
}

/**
 * 아티스트 스타일 믹스 세트 정의
 */
export interface ArtMixSet {
  id: number;
  tags: string;        // 세트에 포함된 태그들 (쉼표로 구분된 문자열)
  minWeight: number;   // 최소 가중치
  maxWeight: number;   // 최대 가중치
  probability: number; // 포함 확률 (0~100)
  weightStep: number;  // 가중치 변화 단위
}

/**
 * 씬 프리셋 블록 정의
 */
export interface PresetBlock {
  id: number;
  type: 'fixed' | 'sequential';
  content: string; // 텍스트 내용 (순차 블록의 경우 줄바꿈으로 구분)
}

export interface AppSettings {
  language: 'ko' | 'en' | 'ja';
  theme: 'dark' | 'light' | 'system';
  tagremover: {
    outputMode: 'source' | 'custom';