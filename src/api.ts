import { Domain, DomainsResponse, NotificationSettingsResponse, NotificationSettingsRequest } from './types';

export async function fetchDomains(): Promise<Domain[]> {
  const res = await fetch('/api/domains');
  const text = await res.text();
  let data: DomainsResponse = { success: false };
  try {
    data = text ? JSON.parse(text) : { success: false };
  } catch {
    data = { success: false };
  }
  if (data.success && data.domains) return data.domains;
  throw new Error(data.error || '获取域名失败');
}

export async function saveDomains(domains: Domain[]): Promise<void> {
  const res = await fetch('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domains })
  });
  const text = await res.text();
  let data: DomainsResponse = { success: false };
  try {
    data = text ? JSON.parse(text) : { success: false };
  } catch {
    data = { success: false };
  }
  if (!data.success && text) throw new Error(data.error || '保存失败');
}

export async function deleteDomain(domain: string): Promise<void> {
  const res = await fetch('/api/domains', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain })
  });
  const text = await res.text();
  let data: DomainsResponse = { success: false };
  try {
    data = text ? JSON.parse(text) : { success: false };
  } catch {
    data = { success: false };
  }
  if (!data.success && text) throw new Error(data.error || '删除失败');
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
