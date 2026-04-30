import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import PageContainer from '../../../components/layout/PageContainer';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { useAppStore } from '../../../store/useAppStore';
import { TagInput } from '../../../components/common/TagInput';
import './ScenePresetEdit.css';

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

type EditModule = 
  | { id: number; type: 'remove'; findText: string }
  | { id: number; type: 'replace'; findText: string; replaceText: string }
  | { id: number; type: 'add'; addTags: string; insertPos: { type: 'front' | 'back', index: number } };

const ScenePresetEdit: React.FC = () => {
  const {
    settings,
    updateScenePresetEditSettings,
    scenePresetSourceJson, // Zustand store에서 가져옴
    setScenePresetSourceJson, // Zustand store에서 가져옴
    scenePresetEditModules, // Zustand store에서 가져옴
    setScenePresetEditModules, // Zustand store에서 가져옴
  } = useAppStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // 파일 로드 핸들러
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // 기존에 로드된 파일이 있다면 초기화
    setScenePresetSourceJson(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.scenes) throw new Error('Invalid Format');
        setScenePresetSourceJson(json); // Zustand store에 저장
      } catch (err) {
        setModal({
          isOpen: true,
          title: t('common.warning'),
          message: '올바른 씬 프리셋 JSON 파일이 아닙니다.',
          onConfirm: closeModal
        });
      }
    }; 
    reader.readAsText(file);
  }, [t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    multiple: false
  });

  const addModule = (type: EditModule['type']) => {
    const newId = Date.now();
    if (type === 'remove') setScenePresetEditModules([...scenePresetEditModules, { id: newId, type: 'remove', findText: '' }]);
    else if (type === 'replace') setScenePresetEditModules([...scenePresetEditModules, { id: newId, type: 'replace', findText: '', replaceText: '' }]);
    else setScenePresetEditModules([...scenePresetEditModules, { id: newId, type: 'add', addTags: '', insertPos: { type: 'front', index: 0 } }]);
  };

  const updateModule = (id: number, updates: any) => {
    setScenePresetEditModules(scenePresetEditModules.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const removeModuleStep = (id: number) => {
    setScenePresetEditModules(scenePresetEditModules.filter(m => m.id !== id));
  };

  const handleReset = () => {
    setModal({
      isOpen: true,
      title: t('common.resetInputs'),
      message: t('common.confirmReset'),
      isDestructive: true,
      onConfirm: () => {
        setScenePresetEditModules([]);
        closeModal();
      },
      onCancel: closeModal
    });
  };

  // 모듈 순차 적용 및 각 단계별 통계 계산
  const { processedScenes, modulesWithStats } = useMemo(() => { // useMemo의 의존성 배열에 scenePresetSourceJson, scenePresetEditModules 추가
    if (!scenePresetSourceJson) return { processedScenes: [], modulesWithStats: [] };
    
    let currentScenes = scenePresetSourceJson.scenes.map(s => ({ ...s }));
    const stats = [];

    for (const mod of scenePresetEditModules) {
      let matchCount = 0;
      const query = (mod as any).findText?.trim();
      
      if (query) {
        matchCount = currentScenes.filter(s => s.scenePrompt.includes(query)).length;
      }

      currentScenes = currentScenes.map(scene => {
        let prompt = scene.scenePrompt;
        if (mod.type === 'remove' && mod.findText.trim()) {
          const regex = new RegExp(mod.findText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          prompt = prompt.replace(regex, '').replace(/,\s*,/g, ',').replace(/^,\s*|\s*,$/g, '');
        } else if (mod.type === 'replace' && mod.findText.trim()) {
          const regex = new RegExp(mod.findText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          prompt = prompt.replace(regex, mod.replaceText.trim());
        } else if (mod.type === 'add' && mod.addTags.trim()) {
          const tags = prompt.split(',').map(t => t.trim()).filter(Boolean);
          const toAdd = mod.addTags.split(',').map(t => t.trim()).filter(Boolean);
          let idx = mod.insertPos.type === 'front' ? mod.insertPos.index : tags.length - mod.insertPos.index;
          idx = Math.max(0, Math.min(tags.length, idx));
          tags.splice(idx, 0, ...toAdd);
          prompt = tags.join(', ');
        }
        return { ...scene, scenePrompt: prompt };
      });

      stats.push({ ...mod, matchCount });
    }

    return { processedScenes: currentScenes, modulesWithStats: stats }; // useMemo의 의존성 배열에 scenePresetSourceJson, scenePresetEditModules 추가
  }, [scenePresetSourceJson, scenePresetEditModules]);

  const { outputDir } = settings.scenePresetEdit; // 저장 위치 가져오기

  const handleBrowse = async () => {
    const path = await window.electronAPI?.selectDirectory();
    if (path) updateScenePresetEditSettings({ outputDir: path });
  };

  const handleSave = async () => { // sourceJson 대신 scenePresetSourceJson 사용
    if (!scenePresetSourceJson || !window.electronAPI || !outputDir) return;

    const result = {
      ...scenePresetSourceJson,
      scenes: processedScenes,
      name: `${scenePresetSourceJson.name}_edited_${Date.now()}`
    };

    try {
      await window.electronAPI.saveJsonFile({ path: outputDir, fileName: `${result.name}.json`, data: result });
      setModal({ isOpen: true, title: t('common.generateResult'), message: `${result.name}.json ${t('common.generateResult')}`, onConfirm: closeModal });
    } catch (err: any) {
      setModal({ isOpen: true, title: t('common.warning'), message: t('common.saveError', { error: String(err) }), isDestructive: true, onConfirm: closeModal });
    }
  };

  return (
    <PageContainer
      title={t('sideBar.scenePresetEdit')}
      info={t('scenePresetEdit.pageInfo')}
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
            <button className="run-btn" onClick={handleSave} disabled={!scenePresetSourceJson || !outputDir || processedScenes.length === 0}>
              {t('common.runButton')}
            </button>
          </div>
        </div>
      }
    >
      <div className="scene-preset-edit-content">
        {!scenePresetSourceJson ? (
          <div {...getRootProps()} className={`file-loader-zone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <div className="empty-msg">{t('scenePresetEdit.emptyMessage')}</div>
          </div>
        ) : (
          <>
            <div className="file-info-bar">
              <span>{t('scenePresetEdit.fileLoaded', { name: scenePresetSourceJson.name, count: scenePresetSourceJson.scenes.length })}</span>
              <button className="btn-standard" onClick={() => setScenePresetSourceJson(null)}>{t('scenePresetEdit.changeFile')}</button>
            </div>

            <div className={`edit-toolbox ${isCollapsed ? 'collapsed' : ''}`}>
              <div className="edit-toolbox-header">
                <h4>{t('scenePresetEdit.toolboxTitle')}</h4>
                <button 
                  className={`btn-standard toggle-btn ${isCollapsed ? 'collapsed' : ''}`}
                  onClick={() => setIsCollapsed(!isCollapsed)}
                >
                  {isCollapsed ? t('common.expand') : t('common.collapse')}
                </button>
              </div>

              {!isCollapsed && (
                <>
                  <div className="module-cards-container">
                    {modulesWithStats.map((mod, index) => (
                      <div key={mod.id} className="module-card">
                        <div className="module-info">{t('scenePresetEdit.stepIndex', { index: index + 1 })}</div>
                        <div className="module-inputs">
                          {mod.type === 'remove' && (
                            <>
                              <span>{t('scenePresetEdit.removeModule')}</span>
                              <input type="text" className="option-control" value={mod.findText} 
                                     onChange={e => updateModule(mod.id, { findText: e.target.value })} placeholder={t('scenePresetEdit.findKeyword')} />
                              {mod.findText.trim() && <span className="match-indicator">{mod.matchCount} {t('scenePresetEdit.matchCount')}</span>}
                            </>
                          )}
                          {mod.type === 'replace' && (
                            <>
                              <span>{t('scenePresetEdit.replaceModule')}</span>
                              <input type="text" className="option-control" value={mod.findText} 
                                     onChange={e => updateModule(mod.id, { findText: e.target.value })} placeholder={t('scenePresetEdit.findKeyword')} />
                              <span>→</span>
                              <input type="text" className="option-control" value={mod.replaceText} 
                                     onChange={e => updateModule(mod.id, { replaceText: e.target.value })} placeholder={t('scenePresetEdit.replaceKeyword')} />
                              {mod.findText.trim() && <span className="match-indicator">{mod.matchCount} {t('scenePresetEdit.matchCount')}</span>}
                            </>
                          )}
                          {mod.type === 'add' && (
                            <>
                              <span>{t('scenePresetEdit.addModule')}</span>
                              <TagInput value={mod.addTags} onChange={val => updateModule(mod.id, { addTags: val })} />
                              <div className="pos-controls">
                                <select className="option-control" value={mod.insertPos.type} onChange={e => updateModule(mod.id, { insertPos: { ...mod.insertPos, type: e.target.value as any } })}>
                                  <option value="front">{t('scenePresetEdit.posFront')}</option>
                                  <option value="back">{t('scenePresetEdit.posBack')}</option>
                                </select>
                                <input type="number" className="option-control small-num-input" value={mod.insertPos.index} min="0"
                                       onChange={e => updateModule(mod.id, { insertPos: { ...mod.insertPos, index: parseInt(e.target.value) || 0 } })} />
                                <span>{t('scenePresetEdit.posNth')}</span>
                              </div>
                            </>
                          )}
                        </div>
                        <button className="btn-icon" onClick={() => removeModuleStep(mod.id)}>×</button>
                      </div>
                    ))}
                  </div>
                  <div className="action-group-container">
                    <div className="action-group-left">
                      <button className="btn-standard" onClick={() => addModule('remove')}>+ {t('scenePresetEdit.removeModule')}</button>
                      <button className="btn-standard" onClick={() => addModule('replace')}>+ {t('scenePresetEdit.replaceModule')}</button>
                      <button className="btn-standard" onClick={() => addModule('add')}>+ {t('scenePresetEdit.addModule')}</button>
                    </div>
                    <button className="btn-reset" onClick={handleReset}>{t('common.resetInputs')}</button>
                  </div>
                </>
              )}
            </div>

            {isCollapsed && (
              <div className="items-list"> {/* 미리보기 영역: 툴박스가 접혔을 때만 표시 */}
                {processedScenes.map((scene, i) => (
                  <div key={scene.id} className="scene-edit-card">
                    <div className="scene-card-header"><span>{i + 1}. {scene.name}</span></div>
                    <div className="prompt-preview">{scene.scenePrompt}</div>
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
  );
};

export default ScenePresetEdit;