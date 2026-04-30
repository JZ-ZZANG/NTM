import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TagInput } from '../../../components/common/TagInput';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import PageContainer from '../../../components/layout/PageContainer';
import { ArtMixSet } from '../../../shared/types';
import { useAppStore } from '../../../store/useAppStore';
import './RandomWeight.css';

const RandomWeight: React.FC = () => {
  const { t } = useTranslation();
  const { 
    randomWeightSets: mixSets, 
    randomWeightGenerateCount: generateCount, 
    setRandomWeightSets: setMixSets, 
    setRandomWeightGenerateCount: setGenerateCount,
    settings,
    updateRandomWeightSettings
  } = useAppStore();

  // 드래그 앤 드롭 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [canDrag, setCanDrag] = useState(false);

  const [bulkStep, setBulkStep] = useState(0.01);
  // 모달 통합 관리 상태
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    isDestructive?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const { outputDir } = settings.randomWeight;

  // 고유한 숫자 ID 생성을 위한 도우미 (타임스탬프 + 3자리 난수)
  // JavaScript의 MAX_SAFE_INTEGER 범위 내에서 숫자로 유지됩니다.
  const generateId = () => {
    return Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
  };

  const addSet = () => {
    setMixSets([...mixSets, { id: generateId(), tags: '', minWeight: 1.0, maxWeight: 1.0, probability: 100, weightStep: 0.01 }]);
  };

  const removeSet = (id: number) => {
    const filtered = mixSets.filter(set => set.id !== id);
    setMixSets(filtered.length > 0 ? filtered : [{ id: generateId(), tags: '', minWeight: 1.0, maxWeight: 1.0, probability: 100, weightStep: 0.01 }]);
  };

  const updateSet = (id: number, updates: Partial<ArtMixSet>) => {
    const updated = mixSets.map(set => set.id === id ? { ...set, ...updates } : set);
    setMixSets(updated);
  };

  const handleBrowse = async () => {
    const path = await window.electronAPI?.selectDirectory();
    if (path) updateRandomWeightSettings({ outputDir: path });
  };

  const applyStepToAll = () => {
    setMixSets(mixSets.map(set => ({ ...set, weightStep: bulkStep })));
  };

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  const handleReset = () => {
    setModal({
      isOpen: true,
      title: t('common.resetInputs'),
      message: t('common.confirmReset'),
      isDestructive: true,
      onConfirm: () => {
        setMixSets([{ id: generateId(), tags: '', minWeight: 1.0, maxWeight: 1.0, probability: 100, weightStep: 0.01 }]);
        setGenerateCount(30);
        closeModal();
      },
      onCancel: closeModal
    });
  };

  const handleGenerate = async () => {
    if (!outputDir) {
      setModal({
        isOpen: true,
        title: t('common.warning'),
        message: t('common.outputDirPlaceholder'),
        onConfirm: closeModal
      });
      return;
    }

    const rootTimestamp = Date.now();
    const baseName = `RandomWeight_${rootTimestamp}`;
    const scenes = [];

    for (let i = 0; i < generateCount; i++) {
      // 확률에 따라 포함될 세트 결정
      const activeSets = mixSets.filter(set => Math.random() * 100 <= set.probability);
      
      // 각 세트별 가중치 랜덤 결정 및 NAI 문법으로 변환
      const promptParts = activeSets.map(set => {
        let finalWeight: number;
        if (set.minWeight === set.maxWeight) {
          finalWeight = set.minWeight;
        } else {
          // 1. 범위 내 랜덤값 생성
          const raw = Math.random() * (set.maxWeight - set.minWeight) + set.minWeight;
          // 2. 최소값 기준으로 단위(Step)에 맞춰 반올림 (단위가 0이면 기본값 0.01 사용)
          const step = set.weightStep > 0 ? set.weightStep : 0.01;
          const offset = raw - set.minWeight;
          finalWeight = set.minWeight + Math.round(offset / step) * step;
          // 3. 범위를 벗어나지 않도록 클램핑 (0.7~0.9 범위에 단위 1.0인 경우 등 대응)
          finalWeight = Math.max(set.minWeight, Math.min(set.maxWeight, finalWeight));
        }
        
        const weightString = finalWeight.toFixed(2);
        return `${weightString}::${set.tags} ::`;
      });

      scenes.push({
        id: (rootTimestamp + i + 1).toString(),
        name: `scene${(i + 1).toString().padStart(2, '0')}`,
        scenePrompt: promptParts.join(', '),
        queueCount: 0,
        images: [],
        createdAt: rootTimestamp + i + 1
      });
    }

    const output = {
      id: rootTimestamp.toString(),
      name: baseName,
      scenes: scenes,
      createdAt: rootTimestamp
    };

    if (!window.electronAPI?.saveJsonFile) {
      setModal({
        isOpen: true,
        title: t('common.warning'),
        message: t('common.saveError', { error: 'window.electronAPI.saveJsonFile is undefined' }),
        isDestructive: true,
        onConfirm: closeModal
      });
      return;
    }

    try {
      const fileName = `${baseName}.json`;
      await window.electronAPI.saveJsonFile({
        path: outputDir,
        fileName: fileName,
        data: output
      });
      
      setModal({
        isOpen: true,
        title: t('common.generateResult'),
        message: `${fileName} 저장이 완료되었습니다.`,
        onConfirm: closeModal
      });
    } catch (error: any) {
      console.error('파일 저장 실패:', error);
      const errorMessage = error.message || String(error);
      setModal({
        isOpen: true,
        title: t('common.warning'),
        message: t('randomWeight.saveError', { error: errorMessage }),
        isDestructive: true,
        onConfirm: closeModal
      });
    }
  };

  // 드래그 시작
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  // 드래그 중 다른 요소 위로 올라갔을 때 (실시간 순서 변경)
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // 드롭 허용
    if (draggedIndex === null || draggedIndex === index) return;

    const newSets = [...mixSets];
    const draggedItem = newSets[draggedIndex];
    
    newSets.splice(draggedIndex, 1);
    newSets.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setMixSets(newSets);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <PageContainer 
      title={t('sideBar.randomWeight')}
      info={t('randomWeight.pageInfo')} // 기존 아이콘 내용을 제목 옆으로 이동
      footer={
        <div className="footer-container">
          <div className="footer-left-group">
            <div className="footer-input-group">
              <label>{t('randomWeight.genCount')}</label>
              <input 
                type="number" 
                value={generateCount} 
                onChange={(e) => setGenerateCount(Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="option-control gen-count-input"
                min="1"
              />
            </div>
          </div>

          <div className="footer-right-group">
            <div className="footer-input-group path-picker-mini">
              <label>{t('common.outputDirLabel')}</label>
              <div className="path-picker">
                <input 
                  type="text" 
                  className="option-control"
                  readOnly 
                  value={outputDir} 
                  placeholder={t('common.outputDirPlaceholder')} 
                />
                <button className="btn-browse" onClick={handleBrowse}>{t('settings.browse')}</button>
              </div>
            </div>
            <button className="run-btn" onClick={handleGenerate} disabled={mixSets.some(s => s.tags.trim() === '') || generateCount <= 0 || !outputDir}>
              {t('common.runButton')}
            </button>
          </div>
        </div>
      }
    >
      <div className="random-weight-content">
        <div className="mix-sets-list">
          {mixSets.map((set, index) => (
            <div 
              key={set.id} 
              className={`mix-set-card ${draggedIndex === index ? 'dragging' : ''}`}
              draggable={canDrag}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div 
                className="set-header"
                onMouseEnter={() => setCanDrag(true)}
                onMouseLeave={() => setCanDrag(false)}
              >
                <span className="set-title">{t('randomWeight.setName')} #{index + 1}</span>
                <button className="btn-icon remove-btn" onClick={() => removeSet(set.id)} title={t('randomWeight.removeSet')}>×</button>
              </div>
              
              <div className="set-body" onMouseEnter={() => setCanDrag(false)}>
                <div className="tags-section">
                  <TagInput 
                    value={set.tags}
                    onChange={(val) => updateSet(set.id, { tags: val })}
                    placeholder={t('randomWeight.tagsPlaceholder')}
                  />
                </div>

                <div className="settings-section">
                  <div className="setting-item">
                    <label>{t('randomWeight.weightRange')}</label>
                    <div className="range-inputs">
                      <input 
                        type="number" 
                        step="0.05" 
                        value={set.minWeight} 
                        className="option-control"
                        onChange={(e) => updateSet(set.id, { minWeight: Number(e.target.value) })}
                        onFocus={(e) => e.target.select()}
                      />
                      <span>~</span>
                      <input 
                        type="number" 
                        step="0.05" 
                        value={set.maxWeight} 
                        className="option-control"
                        onChange={(e) => updateSet(set.id, { maxWeight: Number(e.target.value) })}
                        onFocus={(e) => e.target.select()}
                      />
                      <span className="step-separator">/</span>
                      <div className="step-input-wrapper" title={t('randomWeight.weightStep')}>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0.01"
                          value={set.weightStep} 
                          className="option-control step-input"
                          onChange={(e) => updateSet(set.id, { weightStep: Number(e.target.value) })}
                          onFocus={(e) => e.target.select()}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="setting-item">
                    <label>{t('randomWeight.probabilityLabel')}: {set.probability}%</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={set.probability} 
                      onChange={(e) => updateSet(set.id, { probability: Number(e.target.value) })}
                      className="prob-slider"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="add-set-wrapper">
            <div className="action-group-left">
              <button className="btn-standard btn-large" onClick={addSet}>
                {t('randomWeight.addSet')}
              </button>
              <div className="bulk-apply-container">
                <div className="bulk-apply-tool">
                  <input 
                    type="number" 
                    step="0.01" 
                    value={bulkStep} 
                    onChange={(e) => setBulkStep(Number(e.target.value))}
                    className="option-control bulk-step-input"
                    placeholder={t('randomWeight.bulkApplyPlaceholder')}
                  />
                  <button className="btn-apply" onClick={applyStepToAll}>
                    {t('randomWeight.applyStepToAll')}
                  </button>
                </div>
              </div>
            </div>
            <button className="btn-reset" onClick={handleReset}>
              {t('common.resetInputs')}
            </button>
          </div>
        </div>

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

export default RandomWeight;