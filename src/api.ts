import { Domain, DomainsResponse, NotificationSettingsResponse, NotificationSettingsRequest, WebDAVConfig, WebDAVResponse } from './types';

// 缓存系统
class APICache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 5 * 60 * 1000) { // 默认5分钟缓存
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  clear() {
    this.cache.clear();
  }

  delete(key: string) {
    this.cache.delete(key);
  }
}

// 请求去重系统
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const promise = requestFn();
    this.pendingRequests.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
}

const apiCache = new APICache();
const requestDeduplicator = new RequestDeduplicator();

async function fetchWithRetry(url: string, options?: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status >= 500) {
        return response;
      }
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 指数退避
    }
  }
  throw new Error('请求失败，已重试多次');
}

export async function fetchDomains(): Promise<Domain[]> {
  const cacheKey = 'domains';
  const cached = apiCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  return requestDeduplicator.deduplicate(cacheKey, async () => {
    const res = await fetchWithRetry('/api/domains');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const text = await res.text();
    let data: DomainsResponse = { success: false };
    try {
      data = text ? JSON.parse(text) : { success: false };
    } catch (error) {
      console.error('解析响应失败:', error);
      data = { success: false, error: '响应格式错误' };
    }
    if (data.success && data.domains) {
      apiCache.set(cacheKey, data.domains, 30 * 1000); // 30秒缓存
      return data.domains;
    }
    throw new Error(data.error || '获取域名失败');
  });
}

export async function saveDomains(domains: Domain[]): Promise<void> {
  const res = await fetchWithRetry('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domains })
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const text = await res.text();
  let data: DomainsResponse = { success: false };
  try {
    data = text ? JSON.parse(text) : { success: false };
  } catch (error) {
    console.error('解析响应失败:', error);
    data = { success: false, error: '响应格式错误' };
  }
  if (!data.success) throw new Error(data.error || '保存失败');
  
  // 清除缓存
  apiCache.delete('domains');
}

export async function deleteDomain(domain: string): Promise<void> {
  const res = await fetchWithRetry('/api/domains', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain })
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const text = await res.text();
  let data: DomainsResponse = { success: false };
  try {
    data = text ? JSON.parse(text) : { success: false };
  } catch (error) {
    console.error('解析响应失败:', error);
    data = { success: false, error: '响应格式错误' };
  }
  if (!data.success) throw new Error(data.error || '删除失败');
  
  // 清除缓存
  apiCache.delete('domains');
}

export async function notifyExpiring(domains: Domain[]): Promise<void> {
  console.log('开始发送到期通知，域名数量:', domains.length);
  console.log('域名列表:', domains.map(d => `${d.domain}(${d.expire_date})`));
  
  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains })
    });
    
    console.log('通知API响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('通知API请求失败:', response.status, response.statusText, errorText);
      throw new Error(`通知发送失败: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log('通知API响应数据:', responseData);
    
    if (!responseData.success) {
      console.error('通知发送失败:', responseData.error);
      throw new Error(responseData.error || '通知发送失败');
    }
  } catch (error) {
    console.error('通知发送异常:', error);
    throw error;
  }
}

// 缓存通知设置
export async function fetchNotificationSettingsFromServer(): Promise<NotificationSettingsResponse> {
  const cacheKey = 'notification-settings';
  const cached = apiCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  return requestDeduplicator.deduplicate(cacheKey, async () => {
    const response = await fetch('/api/notification-settings');
    const data = await response.json();
    apiCache.set(cacheKey, data, 5 * 60 * 1000); // 5分钟缓存
    return data;
  });
}

export async function saveNotificationSettingsToServer(settings: NotificationSettingsRequest): Promise<NotificationSettingsResponse> {
  const response = await fetch('/api/notification-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  const data = await response.json();
  
  // 清除缓存
  apiCache.delete('notification-settings');
  return data;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const response = await fetch('/api/verify-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await response.json();
  return data.success || false;
}

export async function webdavBackup(webdavConfig: WebDAVConfig): Promise<WebDAVResponse> {
  const response = await fetch('/api/webdav/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webdavConfig)
  });
  return await response.json();
}

export async function webdavRestore(webdavConfig: WebDAVConfig, filename?: string): Promise<WebDAVResponse> {
  const response = await fetch('/api/webdav/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...webdavConfig, filename })
  });
  return await response.json();
}

// 日志相关接口
export interface LogEntry {
  id?: number;
  log_type?: string;
  type?: string;
  action: string;
  details: string;
  status: 'success' | 'error' | 'warning' | 'sent' | 'failed';
  timestamp: string;
  user_agent?: string;
  ip_address?: string;
  domain?: string;
  notification_method?: string;
  message?: string;
  error_details?: string;
  device_info?: string;
}

export interface LogsResponse {
  success: boolean;
  logs: LogEntry[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  error?: string;
}

export async function getLogs(type: string = 'all', limit: number = 50, offset: number = 0): Promise<LogsResponse> {
  const cacheKey = `logs-${type}-${limit}-${offset}`;
  const cached = apiCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  return requestDeduplicator.deduplicate(cacheKey, async () => {
    const response = await fetch(`/api/logs?type=${type}&limit=${limit}&offset=${offset}`);
    const data = await response.json();
    apiCache.set(cacheKey, data, 30 * 1000); // 30秒缓存
    return data;
  });
}

export async function clearLogs(type: string = 'all'): Promise<{ success: boolean; message?: string; error?: string }> {
  const response = await fetch('/api/logs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type })
  });
  const data = await response.json();
  
  // 清除相关缓存
  apiCache.clear();
  return data;
}

export async function logOperation(action: string, details: string, status: 'success' | 'error' | 'warning' = 'success'): Promise<void> {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'operation',
        action,
        details,
        status
      })
    });
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

export async function logAccess(action: string, details: string, status: 'success' | 'error' | 'warning' = 'success', device_info?: string): Promise<void> {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'access',
        action,
        details,
        status,
        device_info
      })
    });
  } catch (error) {
    console.error('记录访问日志失败:', error);
  }
}

export async function logNotification(domain: string, notification_method: string, status: 'sent' | 'failed', message: string, error_details?: string): Promise<void> {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'notification',
        action: 'send_notification',
        details: `域名: ${domain}, 通知方式: ${notification_method}`,
        status,
        domain,
        notification_method,
        message,
        error_details
      })
    });
  } catch (error) {
    console.error('记录通知日志失败:', error);
  }
}

export async function logSystem(action: string, details: string, status: 'success' | 'error' | 'warning' | 'info' = 'success', device_info?: string): Promise<void> {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'system',
        action,
        details,
        status,
        device_info
      })
    });
  } catch (error) {
    console.error('记录系统日志失败:', error);
  }
}

// 导出缓存管理函数
export const clearAPICache = () => apiCache.clear();
export const getCacheStats = () => ({
  size: 0, // 隐藏内部实现细节
  keys: []
}); 
