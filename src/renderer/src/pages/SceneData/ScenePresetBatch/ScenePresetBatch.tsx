import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageContainer from '../../../components/layout/PageContainer';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { useAppStore } from '../../../store/useAppStore';
import { PresetBlock } from '../../../shared/types';
import { TagInput } from '../../../components/common/TagInput';
import './ScenePresetBatch.css';

// Helper type for items with original index
interface BlockItem {
  value: string;
  originalIndex: number;
}

const ScenePresetBatch: React.FC = () => {
  const { t } = useTranslation();
  const {
    scenePresetBlocks: blocks,
    setScenePresetBlocks: setBlocks,
    settings,
    updateScenePresetSettings
  } = useAppStore();

  const { outputDir } = settings.scenePreset;

  // 드래그 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [canDrag, setCanDrag] = useState(false);

  // 모달 상태
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    isDestructive?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // 조합 계산
  const totalCombinations = useMemo(() => {
    return blocks.reduce((acc, block) => {
      if (block.type === 'sequential') {
        const lines = block.content.split('\n').filter(l => l.trim() !== '');
        return acc * (lines.length || 1);
      }
      return acc;
    }, 1);
  }, [blocks]);

  const addBlock = (type: 'fixed' | 'sequential') => {
    setBlocks([...blocks, { id: Date.now(), type, content: '' }]);
  };

  const removeBlock = (id: number) => {
    const filtered = blocks.filter(b => b.id !== id);
    setBlocks(filtered.length > 0 ? filtered : [{ id: Date.now(), type: 'fixed', content: '' }]);
  };

  const updateBlock = (id: number, content: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));
  };

  const handleReset = () => {
    setModal({
      isOpen: true,
      title: t('common.resetInputs'),
      message: t('common.confirmReset'),
      isDestructive: true,
      onConfirm: () => {
        setBlocks([{ id: Date.now(), type: 'fixed', content: '' }]);
        closeModal();
      },
      onCancel: closeModal
    });
  };

  const handleBrowse = async () => {
    const path = await window.electronAPI?.selectDirectory();
    if (path) updateScenePresetSettings({ outputDir: path });
  };

  const handleGenerate = async () => {
    if (!outputDir) {
      setModal({ isOpen: true, title: t('common.warning'), message: t('common.outputDirPlaceholder'), onConfirm: closeModal });
      return;
    }

    // Cartesian Product 로직
    // Modify arraysToCombine to store objects with value and originalIndex
    const arraysToCombine: BlockItem[][] = blocks.map(block => {
      if (block.type === 'fixed') return [{ value: block.content, originalIndex: 0 }];
      return block.content.split('\n')
        .filter(l => l.trim() !== '')
        .map((line, idx) => ({ value: line, originalIndex: idx }));
    });

    // 조합 생성 함수
    // Modify combine to handle BlockItem objects
    const combine = (acc: BlockItem[][], curr: BlockItem[]) => {
      return acc.flatMap(a => curr.map(c => [...a, c]));
    };

    const combinations: BlockItem[][] = arraysToCombine.reduce(combine, [[]]);
    
    const rootTimestamp = Date.now();
    const baseName = `ScenePreset_${rootTimestamp}`;
    
    const scenes = combinations.map((combo, i) => ({
      id: (rootTimestamp + i + 1).toString(),
      name: (() => {
        const nameParts: string[] = [];
        let hasExplicitNameInAnyBlock = false; // Flag to check if any block has an explicit name

        combo.forEach((blockItem, blockIndex) => {
          // 고정 블록은 네이밍 구성 요소에서 제외
          if (blocks[blockIndex].type === 'fixed') return;

          const match = blockItem.value.match(/^`([^`]+)`/);
          if (match && match[1]) {
            nameParts.push(match[1]);
            hasExplicitNameInAnyBlock = true;
          } else {
            // If no explicit name, use the original index within its block
            // Pad with 2 zeros for consistency, e.g., 01, 02, 03...
            nameParts.push((blockItem.originalIndex + 1).toString().padStart(2, '0'));
          }
        });

        // If at least one block had an explicit name, use the combined name parts.
        // Otherwise, fall back to the default preset_XXX naming.
        if (hasExplicitNameInAnyBlock) {
          return nameParts.join('_');
        }
        return `preset_${(i + 1).toString().padStart(3, '0')}`;
      })(),
      scenePrompt: combo
        .map(item => item.value.replace(/^`[^`]+`/, '').trim()) // 프롬프트에서 ``로 감싸진 이름 부분 제거
        .filter(s => s !== '')
        .join(', '),
      queueCount: 0,
      images: [],
      createdAt: rootTimestamp + i + 1
    }));

    const output = {
      id: rootTimestamp.toString(),
      name: baseName,
      scenes,
      createdAt: rootTimestamp
    };

    try {
      await window.electronAPI.saveJsonFile({ path: outputDir, fileName: `${baseName}.json`, data: output });
      setModal({ isOpen: true, title: t('common.generateResult'), message: `${baseName}.json 저장이 완료되었습니다.`, onConfirm: closeModal });
    } catch (error: any) { // 저장 실패 시 모달 표시
      console.error('파일 저장 실패:', error);
      const errorMessage = error.message || String(error);
      setModal({
        isOpen: true,
        title: t('common.warning'),
        message: t('common.saveError', { error: errorMessage }),
        isDestructive: true,
        onConfirm: closeModal
      });
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newBlocks = [...blocks];
    const draggedItem = newBlocks[draggedIndex];
    newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    setBlocks(newBlocks);
  };

  return (
    <PageContainer 
      title={t('sideBar.scenePresetBatch')}
      info={t('scenePresetBatch.pageInfo')}
      footer={
          <div className="footer-container">
            <div className="footer-left-group">
              <div className="combination-info">
                {t('scenePresetBatch.totalScenes', { count: totalCombinations })}
              </div>
            </div>
            <div className="footer-right-group">
              <div className="footer-input-group path-picker-mini">
                <label>{t('common.outputDirLabel')}</label>
                <div className="path-picker">
                  <input type="text" className="option-control" readOnly value={outputDir} placeholder={t('common.outputDirPlaceholder')} />
                  <button className="btn-browse" onClick={handleBrowse}>{t('settings.browse')}</button>
                </div>
              </div>
              <button className="run-btn" onClick={handleGenerate} disabled={totalCombinations === 0 || !outputDir}>
                {t('common.runButton')}
              </button>
            </div>  
          </div>
      }
    >
      <div className="scene-preset-content">
        <div className="blocks-list">
          {blocks.map((block, index) => {
            const lineCount = block.type === 'sequential' 
              ? block.content.split('\n').filter(l => l.trim() !== '').length 
              : 1;

            return (
              <div 
                key={block.id} 
                className={`preset-block-card ${block.type} ${draggedIndex === index ? 'dragging' : ''}`}
                draggable={canDrag}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={() => setDraggedIndex(null)}
              >
                <div 
                  className="block-header"
                  onMouseEnter={() => setCanDrag(true)}
                  onMouseLeave={() => setCanDrag(false)}
                >
                  <div className="block-title-group">
                    <span className={`block-badge ${block.type}`}>
                      {block.type === 'fixed' ? t('scenePresetBatch.blockFixed') : t('scenePresetBatch.blockSequential')}
                    </span>
                    <span className="block-index">#{index + 1}</span>
                    {block.type === 'sequential' && (
                      <span className="item-count-label">
                        ({t('scenePresetBatch.itemsCount', { count: lineCount })})
                      </span>
                    )}
                  </div>
                  <button className="btn-icon remove-btn" onClick={() => removeBlock(block.id)}>×</button>
                </div>
                
                <div className="block-body" onMouseEnter={() => setCanDrag(false)}>
                  <TagInput
                    value={block.content}
                    onChange={(val) => updateBlock(block.id, val)}
                    placeholder={block.type === 'fixed' 
                      ? t('scenePresetBatch.placeholderFixed') 
                      : t('scenePresetBatch.placeholderSequential')
                    }
                  />
                </div>
              </div>
            );
          })}

          <div className="add-block-wrapper">
            <div className="action-group-left">
              <button className="btn-standard btn-large" onClick={() => addBlock('fixed')}>
                {t('scenePresetBatch.addFixed')}
              </button>
              <button className="btn-standard btn-large" onClick={() => addBlock('sequential')}>
                {t('scenePresetBatch.addSequential')}
              </button>
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

export default ScenePresetBatch;