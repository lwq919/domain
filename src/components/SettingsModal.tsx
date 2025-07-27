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
  emailConfig?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  wechatSendKey?: string;
  qqKey?: string;
  webhookUrl?: string;
  onSave: (settings: {
    warningDays: string;
    notificationEnabled: string;
    notificationInterval: string;
    notificationMethods: NotificationMethod[];
    bgImageUrl: string;
    carouselInterval: number;
    emailConfig?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
    wechatSendKey?: string;
    qqKey?: string;
    webhookUrl?: string;
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
    carouselInterval,
    emailConfig: '',
    telegramBotToken: '',
    telegramChatId: '',
    wechatSendKey: '',
    qqKey: '',
    webhookUrl: ''
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        warningDays,
        notificationEnabled,
        notificationInterval,
        notificationMethods: [...notificationMethods],
        bgImageUrl,
        carouselInterval,
        emailConfig: '',
        telegramBotToken: '',
        telegramChatId: '',
        wechatSendKey: '',
        qqKey: '',
        webhookUrl: ''
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
                  <span className="toggle-text">启用到期提醒</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      className="toggle-input"
                      checked={form.notificationEnabled === 'true'}
                      onChange={e => setForm(prev => ({ ...prev, notificationEnabled: e.target.checked ? 'true' : 'false' }))}
                    />
                    <span className="toggle-slider"></span>
                  </div>
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
                      checked={form.notificationMethods.includes('telegram')}
                      onChange={e => handleNotificationMethodChange('telegram', e.target.checked)}
                      disabled={form.notificationEnabled !== 'true'}
                    />
                    📱 Telegram
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.notificationMethods.includes('wechat')}
                      onChange={e => handleNotificationMethodChange('wechat', e.target.checked)}
                      disabled={form.notificationEnabled !== 'true'}
                    />
                    💬 微信 (Server酱)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.notificationMethods.includes('qq')}
                      onChange={e => handleNotificationMethodChange('qq', e.target.checked)}
                      disabled={form.notificationEnabled !== 'true'}
                    />
                    🐧 QQ (Qmsg酱)
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

              {/* 通知配置区域 */}
              {(form.notificationMethods.includes('email') || 
                form.notificationMethods.includes('telegram') || 
                form.notificationMethods.includes('wechat') || 
                form.notificationMethods.includes('qq') || 
                form.notificationMethods.includes('webhook')) && (
                <div className="notification-config">
                  {/* 邮件配置 */}
                  {form.notificationMethods.includes('email') && (
                    <div className="form-group">
                      <label className="form-label">📧 邮件配置：</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="接收通知的邮箱地址"
                        value={form.emailConfig || ''}
                        onChange={e => setForm(prev => ({ ...prev, emailConfig: e.target.value }))}
                        disabled={form.notificationEnabled !== 'true'}
                      />
                      <small className="form-hint">请输入接收通知的邮箱地址</small>
                    </div>
                  )}

                  {/* Telegram配置 */}
                  {form.notificationMethods.includes('telegram') && (
                    <div className="form-group">
                      <label className="form-label">📱 Telegram配置：</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Bot Token"
                        value={form.telegramBotToken || ''}
                        onChange={e => setForm(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                        disabled={form.notificationEnabled !== 'true'}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Chat ID"
                        value={form.telegramChatId || ''}
                        onChange={e => setForm(prev => ({ ...prev, telegramChatId: e.target.value }))}
                        disabled={form.notificationEnabled !== 'true'}
                      />
                      <small className="form-hint">请配置Bot Token和Chat ID</small>
                    </div>
                  )}

                  {/* 微信配置 */}
                  {form.notificationMethods.includes('wechat') && (
                    <div className="form-group">
                      <label className="form-label">💬 微信配置：</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Server酱 SendKey"
                        value={form.wechatSendKey || ''}
                        onChange={e => setForm(prev => ({ ...prev, wechatSendKey: e.target.value }))}
                        disabled={form.notificationEnabled !== 'true'}
                      />
                      <small className="form-hint">请输入Server酱的SendKey</small>
                    </div>
                  )}

                  {/* QQ配置 */}
                  {form.notificationMethods.includes('qq') && (
                    <div className="form-group">
                      <label className="form-label">🐧 QQ配置：</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Qmsg酱 Key"
                        value={form.qqKey || ''}
                        onChange={e => setForm(prev => ({ ...prev, qqKey: e.target.value }))}
                        disabled={form.notificationEnabled !== 'true'}
                      />
                      <small className="form-hint">请输入Qmsg酱的Key</small>
                    </div>
                  )}

                  {/* Webhook配置 */}
                  {form.notificationMethods.includes('webhook') && (
                    <div className="form-group">
                      <label className="form-label">🔗 Webhook配置：</label>
                      <input
                        type="url"
                        className="form-input"
                        placeholder="Webhook URL"
                        value={form.webhookUrl || ''}
                        onChange={e => setForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                        disabled={form.notificationEnabled !== 'true'}
                      />
                      <small className="form-hint">请输入Webhook的URL地址</small>
                    </div>
                  )}
                </div>
              )}
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
