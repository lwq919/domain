import { Domain, DomainsResponse, NotificationSettingsResponse, NotificationSettingsRequest, WebDAVConfig, WebDAVResponse } from './types';

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
  if (data.success && data.domains) return data.domains;
  throw new Error(data.error || '获取域名失败');
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
}

export async function notifyExpiring(domains: Domain[]): Promise<void> {
  await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domains })
  });
}

export async function fetchNotificationSettingsFromServer(): Promise<NotificationSettingsResponse> {
  const res = await fetch('/api/notify');
  return res.json();
}

export async function saveNotificationSettingsToServer(settings: NotificationSettingsRequest): Promise<NotificationSettingsResponse> {
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings })
  });
  return res.json();
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const res = await fetch('/api/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  return data.success === true;
}

export async function webdavBackup(webdavConfig: WebDAVConfig): Promise<WebDAVResponse> {
  const res = await fetchWithRetry('/api/webdav', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'backup', webdavConfig })
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '备份失败');
  }
  
  return data;
}

export async function webdavRestore(webdavConfig: WebDAVConfig): Promise<WebDAVResponse> {
  const res = await fetchWithRetry('/api/webdav', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'restore', webdavConfig })
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '恢复失败');
  }
  
  return data;
} 
