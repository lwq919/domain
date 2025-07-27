import React, { useState, useEffect } from 'react';
import { NotificationMethod } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  warningDays: string;
  notificationEnabled: string;
  notificationInterval: string;
  notificationMethods: NotificationMethod[];
  bgImageUrl: string;
  carouselInterval: number;
  onSave: (settings: {
    warningDays: string;
    notificationEnabled: string;
    notificationInterval: string;
    notificationMethods: NotificationMethod[];
    bgImageUrl: string;
    carouselInterval: number;
  }) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  warningDays,
  notificationEnabled,
  notificationInterval,
  notificationMethods,
  bgImageUrl,
  carouselInterval,
  onSave
}) => {
  const [form, setForm] = useState({
    warningDays,
    notificationEnabled,
    notificationInterval,
    notificationMethods: [...notificationMethods],
    bgImageUrl,
    carouselInterval
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        warningDays,
        notificationEnabled,
        notificationInterval,
        notificationMethods: [...notificationMethods],
        bgImageUrl,
        carouselInterval
      });
    }
  }, [isOpen, warningDays, notificationEnabled, notificationInterval, notificationMethods, bgImageUrl, carouselInterval]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  const handleNotificationMethodChange = (method: string, enabled: boolean) => {
    setForm(prev => ({
      ...prev,
      notificationMethods: enabled
        ? [...prev.notificationMethods, method as NotificationMethod]
        : prev.notificationMethods.filter(m => m !== method)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay settings-modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header settings-modal-header">
          <h2>⚙️ 设置</h2>
          <button className="modal-close settings-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body settings-modal-body">
            {/* 通知设置 */}
            <div className="settings-section">
              <h3>🔔 通知设置</h3>
              
              <div className="form-group toggle-group">
                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      className="toggle-input"
                      checked={form.notificationEnabled === 'true'}
                      onChange={e => setForm(prev => ({ ...prev, notificationEnabled: e.target.checked ? 'true' : 'false' }))}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                  <span className="toggle-text">启用到期提醒</span>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">提前提醒天数：</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="365"
                  value={form.warningDays}
                  onChange={e => setForm(prev => ({ ...prev, warningDays: e.target.value }))}
                  disabled={form.notificationEnabled !== 'true'}
                />
              </div>

              <div className="form-group">
                <label className="form-label">提醒频率：</label>
                <select
                  className="form-select"
                  value={form.notificationInterval}
                  onChange={e => setForm(prev => ({ ...prev, notificationInterval: e.target.value }))}
                  disabled={form.notificationEnabled !== 'true'}
                >
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">通知方式：</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.notificationMethods.includes('email')}
                      onChange={e => handleNotificationMethodChange('email', e.target.checked)}
                      disabled={form.notificationEnabled !== 'true'}
                    />
                    📧 邮件
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.notificationMethods.includes('webhook')}
                      onChange={e => handleNotificationMethodChange('webhook', e.target.checked)}
                      disabled={form.notificationEnabled !== 'true'}
                    />
                    🔗 Webhook
                  </label>
                </div>
              </div>
            </div>

            {/* 背景设置 */}
            <div className="settings-section">
              <h3>🎨 背景设置</h3>
              
              <div className="form-group">
                <label className="form-label">自定义背景图片URL：</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/image.jpg"
                  value={form.bgImageUrl}
                  onChange={e => setForm(prev => ({ ...prev, bgImageUrl: e.target.value }))}
                />
                <small className="form-hint">留空则使用轮播背景</small>
              </div>

              <div className="form-group">
                <label className="form-label">轮播间隔（秒）：</label>
                <input
                  type="number"
                  className="form-input"
                  min="5"
                  max="300"
                  value={form.carouselInterval}
                  onChange={e => setForm(prev => ({ ...prev, carouselInterval: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer settings-modal-footer">
            <button type="button" className="btn btn-cancel" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              取消
            </button>
            <button type="submit" className="btn btn-save">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="17,21 17,13 7,13 7,21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="7,3 7,8 15,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal; 
