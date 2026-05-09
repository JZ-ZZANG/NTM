import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import PageContainer from '../../components/layout/PageContainer';
import { useAppStore } from '../../store/useAppStore';
import './TagRemover.css';

interface DroppedItem {
  name: string;
  path: string;
}

const TagRemover: React.FC = () => {
  const { t } = useTranslation();
  const { 
    settings, 
    updateTagRemoverSettings,
    tagRemoverItems: items,
    tagRemoverProgress: progress,
    isTagRemoving,
    setTagRemoverItems: setItems,
    setTagRemoverProgress: setProgress,
    setIsTagRemoving
  } = useAppStore();

  const { outputMode, outputDir, prefix, conflictResolution, outputFormat } = settings.tagRemover;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageRegex = /\.(jpe?g|png|webp)$/i;
    
    const newItems = acceptedFiles
      .filter((f: any) => {
        // 확장자가 없으면 폴더로 간주하고 유지, 확장자가 있으면 이미지인지 체크
        const hasExtension = f.name.includes('.');
        return !hasExtension || imageRegex.test(f.name);
      })
      .map((f: any) => ({
        name: f.name,
        path: f.path || f.name,
      }));
    setItems(newItems);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    getFilesFromEvent: async (event) => {
      const dataTransfer = (event as any).dataTransfer || (event as any).target;
      return Array.from(dataTransfer?.files || []) as File[];
    }
  });

  const handleBrowse = async () => {
    const path = await window.electronAPI?.selectDirectory();
    if (path) updateTagRemoverSettings({ outputDir: path });
  };

  const handleStart = async () => {
    if (items.length === 0 || isTagRemoving || (outputMode === 'custom' && !outputDir)) return;
    
    setProgress(0);
    setIsTagRemoving(true);

    const unsubscribe = window.electronAPI?.onProgress((p) => {
      setProgress(p.percentage);
    });

    try {
      await window.electronAPI?.startTagRemoval(items, settings.tagRemover);
      
      // 작업 완료 후 리스트 및 진행 상황 초기화
      setItems([]);
      setProgress(0);
    } catch (error) {
      console.error('Task failed:', error);
    } finally {
      setIsTagRemoving(false);
      if (unsubscribe) unsubscribe();
    }
  };

  return (
    <PageContainer 
      title={t('sideBar.tagRemover')}
      info={t('tagRemover.pageInfo')}
      footer={
        <div className="footer-container">
          <div className="progress-container">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            <div className="progress-text">{progress}%</div>
          </div>
          <button 
            className="run-btn" 
            onClick={handleStart} 
            disabled={items.length === 0 || isTagRemoving || (outputMode === 'custom' && !outputDir)}
          >
            {t('common.runButton')}
          </button>
        </div>
      }
    >
      <div className="tag-remover-container">
        <div className="tag-remover-options">
          <div className="options-row">
            <div className="option-group">
              <label>{t('tagRemover.prefix')}</label>
              <input 
                type="text" 
                className="option-control"
                value={prefix} 
                onChange={(e) => updateTagRemoverSettings({ prefix: e.target.value })}
                placeholder={t('tagRemover.prefixPlaceholder')}
              />
            </div>

            <div className="option-group">
              <label>{t('tagRemover.conflict.label')}</label>
              <select 
                className="option-control"
                value={conflictResolution}
                onChange={(e) => updateTagRemoverSettings({ conflictResolution: e.target.value as any })}
              >
                <option value="rename">{t('tagRemover.conflict.rename')}</option>
                <option value="overwrite">{t('tagRemover.conflict.overwrite')}</option>
                <option value="skip">{t('tagRemover.conflict.skip')}</option>
              </select>
            </div>

            <div className="option-group">
              <label>{t('tagRemover.format.label')}</label>
              <select 
                className="option-control"
                value={outputFormat}
                onChange={(e) => updateTagRemoverSettings({ outputFormat: e.target.value as any })}
              >
                <option value="same">{t('tagRemover.format.same')}</option>
                <option value="png">{t('tagRemover.format.png')}</option>
                <option value="webp">{t('tagRemover.format.webp')}</option>
                <option value="jpg">{t('tagRemover.format.jpg')}</option>
              </select>
            </div>
          </div>

          <div className="options-row">
            <div className="option-group">
              <label>{t('tagRemover.output.label')}</label>
              <div className="radio-group">
                <label>
                  <input 
                    type="radio" 
                    name="outputMode" 
                    checked={outputMode === 'source'} 
                    onChange={() => updateTagRemoverSettings({ outputMode: 'source' })}
                  /> {t('tagRemover.output.source')}
                </label>
                <label>
                  <input 
                    type="radio" 
                    name="outputMode" 
                    checked={outputMode === 'custom'} 
                    onChange={() => updateTagRemoverSettings({ outputMode: 'custom' })}
                  /> {t('tagRemover.output.custom')}
                </label>
              </div>
            </div>

            <div className="option-group path-input-group">
              <div className="path-picker">
                <input 
                  type="text" 
                  className="option-control"
                  readOnly 
                  value={outputDir} 
                  disabled={outputMode === 'source'}
                  placeholder="C:\Exports\..." 
                />
                <button className="btn-browse" 
                  onClick={handleBrowse} 
                  disabled={outputMode === 'source'}
                >
                  {t('settings.browse')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 드래그 앤 드랍 존 */}
        <div 
          {...getRootProps()} 
          className={`dropzone ${isDragActive ? 'active' : ''}`}
        >
          <input {...getInputProps()} />
          
          {items.length === 0 ? (
            <p>{t('tagRemover.dropzone')}</p>
          ) : (
            <div className="file-list-overlay">
              <div className="file-list-header">
                <span>Total: {items.length} items</span>
              </div>
              <ul className="file-list">
                {items.map((item, i) => (
                  <li key={i} title={item.path}>
                    {item.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default TagRemover;