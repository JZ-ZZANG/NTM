import React from 'react';
import { useTranslation } from 'react-i18next';
import PageContainer from '../components/layout/PageContainer';
import packageInfo from '../../../../package.json';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { version, repository } = packageInfo;

  return (
    <PageContainer 
      title={t('sideBar.home')}
      footer={
        <div style={{ color: 'var(--text-step-3)', fontSize: '0.85rem', display: 'flex', gap: '20px', width: '100%' }}>
          <span>GitHub: <a href={repository.url.replace('.git', '')} target="_blank" rel="noreferrer" style={{ color: 'var(--point-color)', textDecoration: 'none' }}>{repository.url.replace('.git', '')}</a></span>
          {/* <span>Contact: contact@example.com</span> */}
          <span style={{ marginLeft: 'auto' }}>v{version}</span>
        </div>
      }
    >
      <div className="home-content">
        <h2 style={{ marginTop: 0 }}>{t('home.title')}</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{t('home.description')}</p>
      </div>
    </PageContainer>
  );
};

export default Home;