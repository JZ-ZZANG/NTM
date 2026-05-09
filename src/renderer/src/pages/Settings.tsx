import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import PageContainer from '../components/layout/PageContainer';

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, setLanguage } = useAppStore();

  return (
    <PageContainer title={t('settings.title')} info={t('settings.pageInfo')}>
      <div className="page-content settings-content">
        <div className="form-row">
          <label className="form-label">{t('settings.language')}</label>
          <select 
            value={settings.language} 
            onChange={(e) => setLanguage(e.target.value as any)}
            className="option-control"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>
      </div>
    </PageContainer>
  );
};

export default Settings;