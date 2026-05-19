import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import PageContainer from '../../../components/layout/PageContainer';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { useAppStore } from '../../../store/useAppStore';
import { TagInput } from '../../../components/common/TagInput';
import './Image2Scene.css';

interface SceneData {
  id: string;
  name: string;
  scenePrompt: string;
  queueCount: number;
  images: any[];
  createdAt: number;
  width: number;
  height: number;
  [key: string]: any;
}

interface PresetJson {
  id: string;
  name: string;
  scenes: SceneData[];
  createdAt: number;
}

type EditModule = { 
  id: number; 
  type: 'remove'; 
  findText: string; 
  sceneId?: string; // 특정 씬에서만 제거할 경우 사용
  sceneName?: string; // UI 표시용
  isAuto?: boolean; // 자동 추출 여부
};

// 태그 분리 헬퍼 (가중치 구문 1.2::tag1, tag2:: 지원)
const splitTags = (prompt: string): string[] => {
  const regex = /(\d+(?:\.\d+)?::.*?::|[^,\n]+)/g;
  return (prompt.match(regex) || []).map(t => t.trim()).filter(Boolean);
};

const Image2Scene: React.FC = () => {
  const {
    settings,
    updateImage2SceneSettings,
    image2SceneSourceJson,
    setImage2SceneSourceJson,
    image2SceneEditModules,
    setImage2SceneEditModules,
  } = useAppStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { t } = useTranslation();

  // 모달 통합 관리 상태
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    isDestructive?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // 태그 제거 범위 선택 모달 상태
  const [removalModal, setRemovalModal] = useState<{
    isOpen: boolean;
    tag: string;
    sceneId: string;
    sceneName: string;
  } | null>(null);

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // 파일 로드 핸들러
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || isLoading) return;

    setIsLoading(true);

    try {
      // 기존에 로드된 파일이 있다면 초기화
      setImage2SceneSourceJson(null);
      setImage2SceneEditModules([]);

      const imageRegex = /\.(jpe?g|png|webp)$/i;
      const imageFiles = acceptedFiles.filter(f => imageRegex.test(f.name));

      if (imageFiles.length === 0) {
        setModal({
          isOpen: true,
          title: t('common.warning'),
          message: t('image2Scene.noImageWarning'),
          onConfirm: closeModal
        });
        setIsLoading(false);
        return;
      }

      const extractedScenes: SceneData[] = [];
      const allPromptUnits: string[][] = [];
      
      const baseTimestamp = Date.now();
      // 1. 모든 이미지에서 프롬프트 추출
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const path = (file as any).path || file.name;
        const data = await window.electronAPI.extractImageMetadata(path);
        if (data) {
          const comment = data.Comment || data;
          const prompt = comment?.v4_prompt?.caption?.base_caption || comment?.prompt || '';
          
          const tags = splitTags(prompt);
          allPromptUnits.push(tags);

          // 메타데이터 내부 혹은 루트의 width/height 참조
          const width = data.width || comment?.width || 0;
          const height = data.height || comment?.height || 0;

          extractedScenes.push({
            id: (baseTimestamp + i).toString(),
            name: file.name.replace(/\.[^/.]+$/, ""),
            scenePrompt: prompt,
            queueCount: 0,
            images: [],
            createdAt: baseTimestamp + i,
            width: Number(width),
            height: Number(height)
          });
        }
      }

      if (extractedScenes.length > 0) {
        // 2. 모든 리스트에 공통으로 존재하는 태그 추출
        const commonTags = allPromptUnits.length > 1 
          ? allPromptUnits[0].filter(tag => allPromptUnits.every(units => units.includes(tag)))
          : [];

        // 폴더 이름 추출
        const firstFile = imageFiles[0] as any;
        let folderName = t('image2Scene.defaultFolderName');
        if (firstFile.path) {
          const parts = firstFile.path.split(/[\\/]/);
          if (parts.length >= 2) folderName = parts[parts.length - 2];
        } else if (firstFile.webkitRelativePath) {
          folderName = firstFile.webkitRelativePath.split('/')[0];
        }

        // 3. 공통 태그를 기본 제거 모듈로 등록
        const initialModules: EditModule[] = commonTags.map((tag, idx) => ({
          id: Date.now() + idx,
          type: 'remove',
          findText: tag,
          isAuto: true
        }));

        setImage2SceneEditModules(initialModules);

        // 4. JSON 양식으로 변환하여 저장
        setImage2SceneSourceJson({
          id: `img-preset-${Date.now()}`,
          name: folderName,
          scenes: extractedScenes,
          createdAt: Date.now()
        });
      } else {
        setModal({
          isOpen: true,
          title: t('common.warning'),
          message: t('image2Scene.noMetadataWarning'),
          onConfirm: closeModal
        });
      }
    } catch (e: any) {
      setModal({
        isOpen: true,
        title: t('common.warning'),
        message: String(e),
        isDestructive: true,
        onConfirm: closeModal
      });
    } finally {
      setIsLoading(false);
    }
  }, [t, setImage2SceneSourceJson, isLoading, setImage2SceneEditModules]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: isLoading
  });

  // -----------------------------------------------------------------------
  // toggleGlobalRemoval: findText 기준으로 전역 모듈 토글
  // id 기반 find → filter 조합은 중복 모듈이 생긴 경우 하나만 제거해서
  // 유령 모듈이 남을 수 있으므로, findText 기준으로 한 번에 전부 제거
  // -----------------------------------------------------------------------
  const toggleGlobalRemoval = (tag: string) => {
    const hasGlobal = image2SceneEditModules.some(m => m.findText === tag && !m.sceneId);
    if (hasGlobal) {
      // findText가 같은 전역 모듈을 모두 제거 (중복 방어)
      setImage2SceneEditModules(image2SceneEditModules.filter(m => !(m.findText === tag && !m.sceneId)));
    } else {
      setImage2SceneEditModules([...image2SceneEditModules, { id: Date.now(), type: 'remove', findText: tag }]);
    }
  };

  const removeLocalModule = (id: number) => {
    setImage2SceneEditModules(image2SceneEditModules.filter(m => m.id !== id));
  };

  const handleRequestRemoval = (tag: string, sceneId: string, sceneName: string) => {
    setRemovalModal({ isOpen: true, tag, sceneId, sceneName });
  };

  const handleReset = () => {
    setModal({
      isOpen: true,
      title: t('common.resetInputs'),
      message: t('common.confirmReset'),
      isDestructive: true,
      onConfirm: () => {
        // 초기 로드 시와 동일하게 첫 번째 이미지의 순서를 기준으로 공통 태그 재추출
        if (image2SceneSourceJson && image2SceneSourceJson.scenes.length > 0) {
          const allPromptUnits = image2SceneSourceJson.scenes.map(s => splitTags(s.scenePrompt));
          
          // 첫 번째 이미지(index 0)의 태그 순서를 보존하며 공통 태그 필터링
          const commonTags = allPromptUnits.length > 1 
            ? allPromptUnits[0].filter(tag => allPromptUnits.every(units => units.includes(tag)))
            : allPromptUnits[0];

          const initialModules: EditModule[] = commonTags.map((tag, idx) => ({
            id: Date.now() + idx,
            type: 'remove',
            findText: tag,
            isAuto: true
          }));
          setImage2SceneEditModules(initialModules);
        } else {
          setImage2SceneEditModules([]);
        }
        closeModal();
      },
      onCancel: closeModal
    });
  };

  // -----------------------------------------------------------------------
  // [버그 수정] confirmRemoval
  // 'single' 선택 시, 이미 전역 제거 모듈이 존재하면 로컬 추가를 막음
  // → 전역/로컬 중복 모듈 생성 방지
  // -----------------------------------------------------------------------
  const confirmRemoval = (scope: 'all' | 'single') => {
    if (!removalModal) return;
    const { tag, sceneId, sceneName } = removalModal;

    if (scope === 'all') {
      // 전역 제거가 이미 있으면 무시
      if (!image2SceneEditModules.some(m => m.findText === tag && !m.sceneId)) {
        // 동일 태그의 로컬 제거 규칙이 있다면 전역으로 승격하며 중복 제거
        const filtered = image2SceneEditModules.filter(m => !(m.findText === tag && m.sceneId));
        setImage2SceneEditModules([...filtered, { id: Date.now(), type: 'remove', findText: tag }]);
      }
    } else {
      // [수정] 전역 제거가 이미 있거나, 동일 씬 로컬 제거가 이미 있으면 추가하지 않음
      const hasGlobal = image2SceneEditModules.some(m => m.findText === tag && !m.sceneId);
      const hasLocal  = image2SceneEditModules.some(m => m.findText === tag && m.sceneId === sceneId);
      if (!hasGlobal && !hasLocal) {
        setImage2SceneEditModules([...image2SceneEditModules, { id: Date.now(), type: 'remove', findText: tag, sceneId, sceneName }]);
      }
    }
    setRemovalModal(null);
  };

  // -----------------------------------------------------------------------
  // [버그 수정] useMemo - modulesWithStats
  // matchCount는 항상 원본 sourceJson 기준으로 계산 (기존 동일)
  // globalList / partialList 분류를 matchCount 기준에서 → sceneId 유무 기준으로 변경
  //   이전: globalList = !sceneId && matchCount === total  (수동 추가 전역 태그가 partialList로 빠지는 버그)
  //   수정: globalList = !sceneId  (sceneId 없으면 무조건 전역 목록)
  //         partialList = !!sceneId (sceneId 있으면 무조건 씬별 목록)
  // -----------------------------------------------------------------------
  const { processedScenes, modulesWithStats } = useMemo(() => {
    if (!image2SceneSourceJson) return { processedScenes: [], modulesWithStats: [] };
    
    // 전체 제거 태그 목록 (순서 유지)
    const globalRemovals = image2SceneEditModules.filter(m => !m.sceneId).map(m => m.findText);

    const currentScenes = image2SceneSourceJson.scenes.map((scene) => {
      // 각 이미지의 원본 태그 순서를 가져옴
      const originalTags = splitTags(scene.scenePrompt);
      
      // 1. 글로벌 규칙 적용 (원본 순서 유지하며 제거)
      let filtered = originalTags.filter(t => !globalRemovals.includes(t));

      // 2. 특정 씬 규칙 적용
      const localRemovals = image2SceneEditModules
        .filter((m) => m.sceneId === scene.id)
        .map((m) => m.findText);
      
      filtered = filtered.filter(t => !localRemovals.includes(t));
      
      return { ...scene, scenePrompt: filtered.join(', ') };
    });

    const stats = image2SceneEditModules.map((mod) => {
      let matchCount = 0;
      if (mod.sceneId) {
        // 로컬 제거: 해당 씬 1개에만 적용
        matchCount = 1;
      } else {
        // 전역 제거: 원본 기준으로 이 태그를 가진 씬 수 카운트
        matchCount = image2SceneSourceJson.scenes.filter((s) =>
          splitTags(s.scenePrompt).includes(mod.findText)
        ).length;
      }
      return { ...mod, matchCount };
    });

    // 원본 텍스트(scenes[0]) 기준 태그 순서로 정렬
    // 원본에 없는 태그(수동 추가 등)는 뒤에 삽입 순서 유지
    const referenceOrder = splitTags(image2SceneSourceJson.scenes[0]?.scenePrompt ?? '');
    const getOrder = (findText: string) => {
      const idx = referenceOrder.indexOf(findText);
      return idx === -1 ? Infinity : idx;
    };
    const sortedStats = [...stats].sort((a, b) => getOrder(a.findText) - getOrder(b.findText));

    return { processedScenes: currentScenes, modulesWithStats: sortedStats };
  }, [image2SceneSourceJson, image2SceneEditModules]);

  const { outputDir } = settings.image2Scene;

  const handleBrowse = async () => {
    const path = await window.electronAPI?.selectDirectory();
    if (path) updateImage2SceneSettings({ outputDir: path });
  };

  const handleSave = async () => {
    if (!image2SceneSourceJson || !window.electronAPI || !outputDir) return;

    const result = {
      ...image2SceneSourceJson,
      scenes: processedScenes,
      name: `ScenePreset_from_Images_${Date.now()}`
    };

    try {
      await window.electronAPI.saveJsonFile({ path: outputDir, fileName: `${result.name}.json`, data: result });
      setModal({ isOpen: true, title: t('common.generateResult'), message: `${result.name}.json ${t('common.generateResult')}`, onConfirm: closeModal });
    } catch (err: any) {
      setModal({ isOpen: true, title: t('common.warning'), message: t('common.saveError', { error: String(err) }), isDestructive: true, onConfirm: closeModal });
    }
  };

  return (
    <>
    <PageContainer
      title={t('sideBar.image2Scene')}
      info={t('image2Scene.pageInfo')}
      footer={
        <div className="footer-container">
          <div className="footer-left-group"></div>
          <div className="footer-right-group">
            <div className="footer-input-group path-picker-mini">
              <label>{t('common.outputDirLabel')}</label>
              <div className="path-picker">
                <input type="text" className="option-control" readOnly value={outputDir} placeholder={t('common.outputDirPlaceholder')} />
                <button className="btn-browse" onClick={handleBrowse}>{t('settings.browse')}</button>
              </div>
            </div>
            <button className="run-btn" onClick={handleSave} disabled={!image2SceneSourceJson || !outputDir || processedScenes.length === 0}>
              {t('common.runButton')}
            </button>
          </div>
        </div>
      }
    >
      <div className="image2scene-content">
        {!image2SceneSourceJson ? (
          <div {...getRootProps()} className={`file-loader-zone ${isDragActive ? 'active' : ''} ${isLoading ? 'disabled' : ''}`}>
            <input {...getInputProps()} {...({ webkitdirectory: "", directory: "" } as any)} />
            <div className="empty-msg">{t('image2Scene.dropzoneMsg')}</div>
          </div>
        ) : (
          <>
            <div className="file-info-bar">
              <span>{t('image2Scene.fileLoaded', { name: image2SceneSourceJson.name, count: image2SceneSourceJson.scenes.length })}</span>
              <button className="btn-standard" onClick={() => setImage2SceneSourceJson(null)}>{t('image2Scene.changeFile')}</button>
            </div>

            <div className={`edit-toolbox ${isCollapsed ? 'collapsed' : ''}`}>
              <div className="edit-toolbox-header">
                <h4>{t('image2Scene.toolboxTitle')}</h4>
                <button 
                  className={`btn-standard toggle-btn ${isCollapsed ? 'collapsed' : ''}`}
                  onClick={() => setIsCollapsed(!isCollapsed)}
                >
                  {isCollapsed ? t('common.expand') : t('common.collapse')}
                </button>
              </div>

              {!isCollapsed && (
                <>
                  {(() => {
                    const total = image2SceneSourceJson.scenes.length;
                    // 전역 제거 중 모든 씬에 공통인 태그 → 전체 제거 란
                    // 전역 제거 중 일부 씬에만 있는 태그, 씬별 로컬 제거 → 일부 태그 란
                    const globalList  = modulesWithStats.filter(m => !m.sceneId && m.matchCount === total);
                    const partialList = modulesWithStats.filter(m => m.sceneId || (!m.sceneId && m.matchCount < total));

                    return (
                      <>
                        <div className="removed-tags-pool global">
                          <h5>{t('image2Scene.globalTagsTitle')}</h5>
                          <div className="tags-grid custom-scrollbar">
                            {globalList.length === 0 ? (
                              <div className="empty-msg-mini">{t('image2Scene.noDeleteTags')}</div>
                            ) : (
                              globalList.map((mod) => (
                                <button
                                  key={mod.id}
                                  className="tag-chip"
                                  onClick={() => toggleGlobalRemoval(mod.findText)}
                                >
                                  <span className="tag-text">{mod.findText}</span>
                                  <span className="chip-match-count">{mod.matchCount}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="removed-tags-pool partial">
                          <h5>{t('image2Scene.partialTagsTitle')}</h5>
                          <div className="tags-grid custom-scrollbar">
                            {partialList.length === 0 ? (
                              <div className="empty-msg-mini">{t('image2Scene.noDeleteTags')}</div>
                            ) : (
                              partialList.map((mod) => (
                                <button
                                  key={mod.id}
                                  className="tag-chip"
                                  onClick={() => removeLocalModule(mod.id)}
                                >
                                  <span className="tag-text">{mod.findText}</span>
                                  {mod.sceneName && <span className="chip-scene-name">@{mod.sceneName}</span>}
                                  {!mod.sceneId && <span className="chip-match-count">{mod.matchCount}</span>}
                                </button>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="action-group-container">
                          <div className="action-group-left"></div>
                          <button className="btn-reset" onClick={handleReset}>
                            {t('common.resetInputs')}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>

            {isCollapsed && (
              <div className="items-list">
                {processedScenes.map((scene, i) => (
                  <div key={scene.id} className="scene-edit-card">
                    <div className="scene-card-header"><span>{i + 1}. {scene.name}</span></div>
                    <div className="prompt-preview chips-mode">
                      {splitTags(scene.scenePrompt).map((tag, idx) => (
                        <button key={idx} className="tag-chip" onClick={() => handleRequestRemoval(tag, scene.id, scene.name)}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <ConfirmModal
          isOpen={modal.isOpen}
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={modal.onCancel}
          isDestructive={modal.isDestructive}
        />
      </div>
    </PageContainer>

      {removalModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content">
            <h3>{t('image2Scene.removalModalTitle')}</h3>
            <p>{t('image2Scene.removalModalQuestion', { tag: removalModal.tag })}</p>
            <div className="modal-info-box">{t('image2Scene.removalModalCurrentScene', { name: removalModal.sceneName })}</div>
            <div className="modal-actions-vertical">
              <button className="btn-standard" onClick={() => confirmRemoval('all')}>{t('image2Scene.removalAll')}</button>
              <button className="btn-standard" onClick={() => confirmRemoval('single')}>{t('image2Scene.removalSingle')}</button>
              <button className="btn-reset" onClick={() => setRemovalModal(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Image2Scene;