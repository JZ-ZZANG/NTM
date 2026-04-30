import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const TitleBar: React.FC = () => {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // 마운트 시점에 API가 있는지 확인하고 초기 상태 및 리스너 설정
    const initTitleBar = async () => {
      if (window.electronAPI) {
        const status = await window.electronAPI.isMaximized();
        setIsMaximized(status);
      }
    };

    initTitleBar();
    
    // 상태 변경 이벤트 구독
    const unsubscribe = window.electronAPI?.onMaximizedChange(setIsMaximized);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <header className="title-bar">
      <div className="title">NAI Tag Manager</div>
      <div className="window-controls">
        <button 
          onClick={() => window.electronAPI?.minimize()} 
          title={t('titleBar.minimize')}
        >
          _
        </button>
        <button 
          onClick={() => window.electronAPI?.maximize()} 
          title={isMaximized ? t('titleBar.restore') : t('titleBar.maximize')}
        >
          {isMaximized ? '❐' : '▢'}
        </button>
        <button 
          className="close-btn" 
          title={t('titleBar.close')}
          onClick={() => window.electronAPI?.close()}
        >
          ✕
        </button>
      </div>
    </header>
  );
};

export default TitleBar;