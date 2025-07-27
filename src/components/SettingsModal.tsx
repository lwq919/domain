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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ 设置</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* 通知设置 */}
            <div className="settings-section">
              <h3>🔔 通知设置</h3>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={form.notificationEnabled === 'true'}
                    onChange={e => setForm(prev => ({ ...prev, notificationEnabled: e.target.checked ? 'true' : 'false' }))}
                  />
                  启用到期提醒
                </label>
              </div>

              <div className="form-group">
                <label>提前提醒天数：</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.warningDays}
                  onChange={e => setForm(prev => ({ ...prev, warningDays: e.target.value }))}
                  disabled={form.notificationEnabled !== 'true'}
                />
              </div>

              <div className="form-group">
                <label>提醒频率：</label>
                <select
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
                <label>通知方式：</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.notificationMethods.includes('email')}
                      onChange={e => handleNotificationMethodChange('email', e.target.checked)}
                      disabled={form.notificationEnabled !== 'true'}
                    />
                    邮件
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.notificationMethods.includes('webhook')}
                      onChange={e => handleNotificationMethodChange('webhook', e.target.checked)}
                      disabled={form.notificationEnabled !== 'true'}
                    />
                    Webhook
                  </label>
                </div>
              </div>
            </div>

            {/* 背景设置 */}
            <div className="settings-section">
              <h3>🎨 背景设置</h3>
              
              <div className="form-group">
                <label>自定义背景图片URL：</label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={form.bgImageUrl}
                  onChange={e => setForm(prev => ({ ...prev, bgImageUrl: e.target.value }))}
                />
                <small>留空则使用轮播背景</small>
              </div>

              <div className="form-group">
                <label>轮播间隔（秒）：</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={form.carouselInterval}
                  onChange={e => setForm(prev => ({ ...prev, carouselInterval: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary">
              保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal; 
