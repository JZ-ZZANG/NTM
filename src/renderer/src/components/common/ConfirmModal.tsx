import React from 'react';
import { useTranslation } from 'react-i18next';
import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void; // 취소 버튼을 선택적으로 변경
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, title, message, onConfirm, onCancel, confirmText, cancelText, isDestructive = false
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel || onConfirm}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title || t('common.warning')}</span>
          <button className="modal-close" onClick={onCancel || onConfirm}>×</button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button className={`btn-modal-primary ${isDestructive ? 'destructive' : ''}`} onClick={onConfirm}>
            {confirmText || t('common.confirm')}
          </button>
          {onCancel && (
            <button className="btn-modal-secondary" onClick={onCancel}>
              {cancelText || t('common.cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};