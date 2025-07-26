import React from 'react';
import { Domain, STATUS_LABELS } from '../types';
import { isMobile } from '../utils';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  domains?: Domain[];
  showDomainList?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  domains = [],
  showDomainList = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'block', zIndex: 9999 }} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-content" style={isMobile() ? { width: '98%', padding: 10 } : {}}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
          {showDomainList && domains.length > 0 && (
            <div style={{ 
              marginBottom: 10, 
              padding: 15, 
              background: 'rgba(255, 255, 255, 0.1)', 
              borderRadius: 12,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              color: '#fff',
              maxHeight: 200,
              overflowY: 'auto'
            }}>
              {domains.map((domain, index) => (
                <div key={domain.domain} style={{ 
                  padding: '8px 0', 
                  borderBottom: index < domains.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none' 
                }}>
                  <p style={{ margin: '2px 0', fontSize: '14px' }}>
                    <strong>{domain.domain}</strong> - {domain.registrar}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-buttons">
          <button className="btn btn-danger" onClick={onConfirm}>{confirmText}</button>
          <button className="btn btn-secondary" onClick={onCancel}>{cancelText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal; 
