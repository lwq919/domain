import { Domain } from './types';

export function calculateProgress(register_date: string, expire_date: string): number {
  const start = new Date(register_date).getTime();
  const end = new Date(expire_date).getTime();
  const now = Date.now();
  if (now < start) return 0;
  if (now > end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

export function getProgressClass(progress: number): string {
  if (progress >= 80) return 'danger';
  if (progress >= 60) return 'warning';
  return '';
}

export function getDaysLeft(expire_date: string): number {
  const expire_date_obj = new Date(expire_date);
  return Math.ceil((expire_date_obj.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function getDaysColor(daysLeft: number): string {
  if (daysLeft <= 7) return '#dc3545';
  if (daysLeft <= 30) return '#fd7e14';
  return '#fff';
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(cell => cell.replace(/^"|"$/g, '').trim());
}

export function normalizeField(s: string): string {
  return s.replace(/^"|"$/g, '').replace(/[_\s-]/g, '').toLowerCase();
}

export function validateDomain(domain: Domain): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!domain.domain || domain.domain.trim() === '') {
    errors.push('域名不能为空');
  }
  if (!domain.status || !['active', 'expired', 'pending'].includes(domain.status)) {
    errors.push('状态必须是 active、expired 或 pending');
  }
  if (!domain.registrar || domain.registrar.trim() === '') {
    errors.push('注册商不能为空');
  }
  if (!domain.register_date || isNaN(Date.parse(domain.register_date))) {
    errors.push('注册日期格式无效');
  }
  if (!domain.expire_date || isNaN(Date.parse(domain.expire_date))) {
    errors.push('到期日期格式无效');
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

export function exportToCSV(domains: Domain[]): string {
  const header = ['域名', '注册商', '注册日期', '过期日期', '状态'];
  const rows = domains.map((d: Domain) => [
    d.domain,
    d.registrar,
    d.register_date,
    d.expire_date,
    d.status === 'active' ? '正常' : d.status === 'expired' ? '即将到期' : '待激活'
  ]);
  return header.join(',') + '\n' + rows.map((r: string[]) => r.join(',')).join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text).catch(() => {
    // 降级方案：使用传统方法复制
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  });
}

export function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isMobile(): boolean {
  return window.innerWidth <= 768;
} 
