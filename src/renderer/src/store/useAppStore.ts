import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, ArtMixSet, PresetBlock } from '../../../shared/types';
import i18n from '../i18n';

interface SceneData {
  id: string;
  name: string;
  scenePrompt: string;
  [key: string]: any;
}

interface PresetJson {
  id: string;
  name: string;
  scenes: SceneData[];
  createdAt: number;
}

interface AppState {
  settings: AppSettings;
  // TagRemover 전용 상태
  tagRemoverItems: { name: string; path: string }[];
  tagRemoverProgress: number;
  isTagRemoving: boolean;
  // RandomWeight 전용 상태 (메모리에만 유지)
  randomWeightSets: ArtMixSet[];
  randomWeightGenerateCount: number;
  // ScenePresetBatch 전용 상태
  scenePresetBlocks: PresetBlock[];

  setLanguage: (lang: AppSettings['language']) => void;
  setTheme: (theme: AppSettings['theme']) => void;
  updateTagRemoverSettings: (updates: Partial<AppSettings['tagremover']>) => void;
  updateRandomWeightSettings: (updates: { outputDir: string }) => void;
  updateScenePresetSettings: (updates: { outputDir: string }) => void;
  setTagRemoverItems: (items: { name: string; path: string }[]) => void;
  setScenePresetSourceJson: (json: PresetJson | null) => void;
  setScenePresetEditModules: (modules: any[]) => void;
  scenePresetSourceJson: PresetJson | null; // ScenePresetEdit의 원본 JSON 데이터
  scenePresetEditModules: any[]; // ScenePresetEdit의 편집 모듈 리스트
  updateScenePresetEditSettings: (updates: { outputDir: string }) => void;
  setTagRemoverProgress: (progress: number) => void;
  setIsTagRemoving: (isRunning: boolean) => void;
  setRandomWeightSets: (sets: ArtMixSet[]) => void;
  setRandomWeightGenerateCount: (count: number) => void;
  setScenePresetBlocks: (blocks: PresetBlock[]) => void;
}

type EditModule = any; // ScenePresetEdit.tsx에서 정의된 EditModule 타입을 여기에 맞게 가져오거나 재정의해야 합니다.

export const useAppStore = create<AppState>()(persist((set) => ({
  settings: {
    language: 'ko',
    theme: 'system',
    tagremover: {
      outputMode: 'source',
      outputDir: '',
      outputFormat: 'same',
      prefix: 'cleaned_',
      conflictResolution: 'rename',
    },
    randomWeight: {
      outputDir: '',
    },
    scenePreset: {
      outputDir: '',
    },
    scenePresetEdit: { // ScenePresetEdit 전용 설정 추가
      outputDir: '',
    }
  },
  scenePresetSourceJson: null, // 초기값 설정
  scenePresetEditModules: [], // 초기값 설정
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    set((state) => ({ settings: { ...state.settings, language } }));
  },
  setTheme: (theme) => set((state) => ({ settings: { ...state.settings, theme } })),
  updateTagRemoverSettings: (updates) => set((state) => ({
    settings: {
      ...state.settings,
      tagremover: { ...state.settings.tagremover, ...updates }
    }
  })),
  updateRandomWeightSettings: (updates) => set((state) => ({
    settings: {
      ...state.settings,
      randomWeight: { ...state.settings.randomWeight, ...updates }
    }
  })),
  updateScenePresetSettings: (updates) => set((state) => ({
    settings: {
      ...state.settings,
      scenePreset: { ...state.settings.scenePreset, ...updates }
    }
  })),
  updateScenePresetEditSettings: (updates) => set((state) => ({ // ScenePresetEdit 설정 업데이트 액션
    settings: {
      ...state.settings,
      scenePresetEdit: { ...state.settings.scenePresetEdit, ...updates }
    }
  })),
  setScenePresetSourceJson: (json) => set({ scenePresetSourceJson: json }),
  setScenePresetEditModules: (modules) => set({ scenePresetEditModules: modules }),

  tagRemoverItems: [],
  tagRemoverProgress: 0,
  isTagRemoving: false,
  setTagRemoverItems: (items) => set({ tagRemoverItems: items }),
  setTagRemoverProgress: (progress) => set({ tagRemoverProgress: progress }),
  setIsTagRemoving: (isRunning) => set({ isTagRemoving: isRunning }),

  randomWeightSets: [{ id: Number(`${Date.now()}000`), tags: '', minWeight: 1.0, maxWeight: 1.0, probability: 100, weightStep: 0.01 }],
  randomWeightGenerateCount: 30,
  setRandomWeightSets: (sets) => set({ randomWeightSets: sets }),
  setRandomWeightGenerateCount: (count) => set({ randomWeightGenerateCount: count }),

  scenePresetBlocks: [{ id: Number(`${Date.now()}001`), type: 'fixed', content: '' }],
  setScenePresetBlocks: (blocks) => set({ scenePresetBlocks: blocks }),

}), {
  name: 'nai-tag-manager-settings', // 로컬 스토리지 키
  partialize: (state) => ({ 
    settings: state.settings,
    randomWeightSets: state.randomWeightSets,
    randomWeightGenerateCount: state.randomWeightGenerateCount,
    scenePresetBlocks: state.scenePresetBlocks,
    scenePresetSourceJson: state.scenePresetSourceJson, // persist에 추가
    scenePresetEditModules: state.scenePresetEditModules, // persist에 추가
  }),
  // 로컬 스토리지에서 상태를 불러올 때, 기본값과 병합하여 스키마 변경에 대응
  merge: (persistedState, currentState) => {
    const mergedSettings = {
      ...currentState.settings, // 현재(기본) 설정으로 시작
      ...(persistedState as any).settings, // 저장된 설정으로 덮어쓰기
      scenePreset: {
        ...currentState.settings.scenePreset,
        ...((persistedState as any).settings?.scenePreset || {}),
      },
      scenePresetEdit: { // scenePresetEdit 설정도 깊게 병합
        ...currentState.settings.scenePresetEdit,
        ...((persistedState as any).settings?.scenePresetEdit || {}),
      },
      randomWeight: { // randomWeight 설정은 깊게 병합하여 누락된 필드 처리
        ...currentState.settings.randomWeight,
        ...((persistedState as any).settings?.randomWeight || {}), // 저장된 설정이 없으면 빈 객체 사용
      },
      scenePresetSourceJson: (persistedState as any).scenePresetSourceJson || currentState.scenePresetSourceJson,
      scenePresetEditModules: (persistedState as any).scenePresetEditModules || currentState.scenePresetEditModules,
    };
    return {
      ...currentState,
      ...(persistedState as any), // persistedState의 다른 최상위 필드 (현재는 없음)
      settings: mergedSettings,
    };
  },
}));