import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import PageContainer from '../components/layout/PageContainer';

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, setLanguage } = useAppStore();

  return (
    <PageContainer title={t('settings.title')}>
      <section className="setting-section">
        <h3 className="section-title">{t('settings.language')}</h3>
        <div className="setting-item">
          <select 
            value={settings.language} 
            onChange={(e) => setLanguage(e.target.value as any)}
            className="lang-select"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>
      </section>
      {/* 다른 설정들은 추후 이곳에 추가 예정 */}
    </PageContainer>
  );
};

export default Settings;