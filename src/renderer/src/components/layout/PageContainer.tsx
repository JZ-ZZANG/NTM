import React, { ReactNode } from 'react';

interface PageContainerProps {
  title: string;
  info?: string; // 페이지 설명을 위한 선택적 prop
  children: ReactNode;
  footer?: ReactNode; // Optional footer prop
}

const PageContainer: React.FC<PageContainerProps> = ({ title, info, children, footer }) => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h2>
          {title}
          {info && <span className="page-info-icon" title={info}>i</span>}
        </h2>
      </div>
      <div className="page-content">
        {children}
      </div>
      {footer && (
        <div className="action-footer">{footer}</div>
      )}
    </div>
  );
};

export default PageContainer;