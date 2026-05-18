import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SideBar: React.FC = () => {
  const { t } = useTranslation();

  return (
    <nav className="sidebar">
      <div className="menu-group">
        <NavLink 
          to="/" 
          className={({ isActive }) => (isActive ? 'active' : '')}
        >{t('sideBar.home')}</NavLink>

        <NavLink 
          to="/tag-viewer" 
          className={({ isActive }) => (isActive ? 'active' : '')}
        >{t('sideBar.tagViewer')}</NavLink>

        <NavLink 
          to="/tag-diff" 
          className={({ isActive }) => (isActive ? 'active' : '')}
        >{t('sideBar.tagDiff')}</NavLink>

        <NavLink 
          to="/tag-remover" 
          className={({ isActive }) => (isActive ? 'active' : '')}
        >{t('sideBar.tagRemover')}</NavLink>

        {/* 씬 데이터 생성 그룹 */}
        <div className="menu-group-item">
          <div className="menu-group-header">
            <span>{t('sideBar.sceneDataGroup')}</span>
          </div>

          <div className="menu-sub-items">
            <NavLink 
              to="/random-weight" 
              className={({ isActive }) => (isActive ? 'active' : '')}
            >{t('sideBar.randomWeight')}</NavLink>
            <NavLink 
              to="/scene-preset-batch" 
              className={({ isActive }) => (isActive ? 'active' : '')}
            >{t('sideBar.scenePresetBatch')}</NavLink>
            <NavLink 
              to="/scene-preset-edit"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >{t('sideBar.scenePresetEdit')}</NavLink>
            <NavLink 
              to="/image-2-scene" 
              className={({ isActive }) => (isActive ? 'active' : '')}
            >{}{t('sideBar.image2Scene')}</NavLink>
          </div>
        </div>
        <NavLink 
          to="/settings" 
          className={({ isActive }) => (isActive ? 'active' : '')}
        >{t('sideBar.settings')}</NavLink>
      </div>
    </nav>
  );
};

export default SideBar;