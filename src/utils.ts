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

// 根据到期天数和警告天数动态计算域名状态
export function getDynamicStatus(expire_date: string, warningDays: number = 15): string {
  const daysLeft = getDaysLeft(expire_date);
  
  if (daysLeft <= 0) {
    return 'expired'; // 已过期
  } else if (daysLeft <= warningDays) {
    return 'expired'; // 即将到期（使用相同的状态标签）
  } else {
    return 'active'; // 正常
  }
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

// 时区处理工具函数
export function getBeijingTime(date: Date = new Date()): Date {
  // 将UTC时间转换为北京时间 (UTC+8)
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

export function formatBeijingTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const beijingTime = getBeijingTime(dateObj);
  
  return beijingTime.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options
  });
}

export function getTodayString(): string {
  // 获取北京时间的今天日期
  return getBeijingTime().toISOString().slice(0, 10);
}

export function isMobile(): boolean {
  return window.innerWidth <= 768;
}

export function getDeviceInfo(): string {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  let deviceType = '桌面设备';
  if (isMobileDevice) {
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      deviceType = 'iOS设备';
    } else if (/Android/i.test(userAgent)) {
      deviceType = 'Android设备';
    } else {
      deviceType = '移动设备';
    }
  }
  
  return `${deviceType} | ${platform} | ${language} | ${screenWidth}x${screenHeight}`;
}

// 导出域名数据为JSON文件
export const exportDomainsToJSON = (domains: Domain[]): void => {
  const dataStr = JSON.stringify(domains, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `domains_${getTodayString()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 导出域名数据为CSV文件
export const exportDomainsToCSV = (domains: Domain[]): void => {
  const headers = ['域名', '状态', '注册商', '注册日期', '到期日期', '续费链接'];
  const csvContent = [
    headers.join(','),
    ...domains.map(domain => [
      domain.domain,
      domain.status,
      domain.registrar,
      domain.register_date,
      domain.expire_date,
      domain.renewUrl || ''
    ].join(','))
  ].join('\n');

  const dataBlob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `domains_${getTodayString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 导出域名数据为TXT文件
export const exportDomainsToTXT = (domains: Domain[]): void => {
  const txtContent = domains.map(domain => 
    `域名: ${domain.domain}\n状态: ${domain.status}\n注册商: ${domain.registrar}\n注册日期: ${domain.register_date}\n到期日期: ${domain.expire_date}${domain.renewUrl ? `\n续费链接: ${domain.renewUrl}` : ''}\n`
  ).join('\n');

  const dataBlob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `domains_${getTodayString()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 从文件导入域名数据
export const importDomainsFromFile = (file: File): Promise<Domain[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let domains: Domain[] = [];

        if (file.name.endsWith('.json')) {
          // 导入JSON文件
          domains = JSON.parse(content);
        } else if (file.name.endsWith('.csv')) {
          // 导入CSV文件
          const lines = content.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',');
          
          domains = lines.slice(1).map(line => {
            const values = line.split(',');
            return {
              domain: values[0] || '',
              status: values[1] || 'active',
              registrar: values[2] || '',
              register_date: values[3] || '',
              expire_date: values[4] || '',
              renewUrl: values[5] || ''
            };
          });
        } else if (file.name.endsWith('.txt')) {
          // 导入TXT文件（简单格式）
          const lines = content.split('\n').filter(line => line.trim());
          let currentDomain: Partial<Domain> = {};
          
          for (const line of lines) {
            if (line.startsWith('域名:')) {
              if (currentDomain.domain) {
                domains.push(currentDomain as Domain);
              }
              currentDomain = { domain: line.replace('域名:', '').trim() };
            } else if (line.startsWith('状态:')) {
              currentDomain.status = line.replace('状态:', '').trim();
            } else if (line.startsWith('注册商:')) {
              currentDomain.registrar = line.replace('注册商:', '').trim();
            } else if (line.startsWith('注册日期:')) {
              currentDomain.register_date = line.replace('注册日期:', '').trim();
            } else if (line.startsWith('到期日期:')) {
              currentDomain.expire_date = line.replace('到期日期:', '').trim();
            } else if (line.startsWith('续费链接:')) {
              currentDomain.renewUrl = line.replace('续费链接:', '').trim();
            }
          }
          
          if (currentDomain.domain) {
            domains.push(currentDomain as Domain);
          }
        } else {
          throw new Error('不支持的文件格式');
        }

        // 验证数据格式
        if (!Array.isArray(domains)) {
          throw new Error('数据格式错误');
        }

        // 验证每个域名的必要字段
        domains = domains.filter(domain => 
          domain.domain && 
          domain.status && 
          domain.registrar && 
          domain.register_date && 
          domain.expire_date
        );

        resolve(domains);
      } catch (error) {
        reject(new Error(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsText(file, 'utf-8');
  });
};

// 验证域名数据格式
export const validateDomainData = (domains: Domain[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!Array.isArray(domains)) {
    errors.push('数据必须是数组格式');
    return { valid: false, errors };
  }

  domains.forEach((domain, index) => {
    if (!domain.domain) {
      errors.push(`第${index + 1}行: 域名不能为空`);
    }
    if (!domain.status) {
      errors.push(`第${index + 1}行: 状态不能为空`);
    }
    if (!domain.registrar) {
      errors.push(`第${index + 1}行: 注册商不能为空`);
    }
    if (!domain.register_date) {
      errors.push(`第${index + 1}行: 注册日期不能为空`);
    }
    if (!domain.expire_date) {
      errors.push(`第${index + 1}行: 到期日期不能为空`);
    }
  });

  return { valid: errors.length === 0, errors };
}; 

// 性能优化相关工具函数

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 懒加载图片
export function lazyLoadImage(img: HTMLImageElement, src: string) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        img.src = src;
        observer.unobserve(img);
      }
    });
  });
  observer.observe(img);
}

// 预加载图片
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

// 批量预加载图片
export async function preloadImages(urls: string[]): Promise<void> {
  const promises = urls.map(url => preloadImage(url));
  await Promise.allSettled(promises);
}

// 性能监控
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  mark(name: string) {
    if ('performance' in window) {
      performance.mark(name);
    }
  }

  measure(name: string, startMark: string, endMark: string) {
    if ('performance' in window) {
      try {
        const measure = performance.measure(name, startMark, endMark);
        const duration = measure.duration;
        
        if (!this.metrics.has(name)) {
          this.metrics.set(name, []);
        }
        this.metrics.get(name)!.push(duration);
        
        console.log(`性能指标 ${name}:`, duration.toFixed(2), 'ms');
        return duration;
      } catch (error) {
        console.warn('性能测量失败:', error);
      }
    }
    return 0;
  }

  getAverage(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  clear() {
    this.metrics.clear();
    if ('performance' in window) {
      performance.clearMarks();
      performance.clearMeasures();
    }
  }
}

// 内存使用监控
export function getMemoryUsage(): { used: number; total: number; percentage: number } | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    };
  }
  return null;
}

// 网络状态检测
export function getNetworkInfo(): { effectiveType: string; downlink: number; rtt: number } | null {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return {
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0
    };
  }
  return null;
}

// 设备性能等级
export function getDevicePerformance(): 'low' | 'medium' | 'high' {
  const networkInfo = getNetworkInfo();
  const memoryInfo = getMemoryUsage();
  
  let score = 0;
  
  // 网络评分
  if (networkInfo) {
    if (networkInfo.effectiveType === '4g') score += 3;
    else if (networkInfo.effectiveType === '3g') score += 2;
    else if (networkInfo.effectiveType === '2g') score += 1;
    
    if (networkInfo.downlink > 10) score += 2;
    else if (networkInfo.downlink > 5) score += 1;
  }
  
  // 内存评分
  if (memoryInfo) {
    if (memoryInfo.total > 1073741824) score += 3; // > 1GB
    else if (memoryInfo.total > 536870912) score += 2; // > 512MB
    else if (memoryInfo.total > 268435456) score += 1; // > 256MB
  }
  
  // CPU 核心数评分
  if ('hardwareConcurrency' in navigator) {
    const cores = navigator.hardwareConcurrency || 1;
    if (cores >= 8) score += 3;
    else if (cores >= 4) score += 2;
    else if (cores >= 2) score += 1;
  }
  
  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

// 自适应性能优化
export function adaptivePerformanceOptimization() {
  const performance = getDevicePerformance();
  
  switch (performance) {
    case 'low':
      // 低性能设备优化
      console.log('检测到低性能设备，启用优化模式');
      // 可以减少动画、降低图片质量等
      break;
    case 'medium':
      // 中等性能设备
      console.log('检测到中等性能设备');
      break;
    case 'high':
      // 高性能设备
      console.log('检测到高性能设备，启用完整功能');
      break;
  }
  
  return performance;
}

// 资源加载优化
export function optimizeResourceLoading() {
  // 预加载关键资源
  const criticalResources = [
    '/image/background.jpeg',
    '/image/logo.png'
  ];
  
  preloadImages(criticalResources).catch(error => {
    console.warn('预加载资源失败:', error);
  });
  
  // 监听网络状态变化
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    connection.addEventListener('change', () => {
      const networkInfo = getNetworkInfo();
      console.log('网络状态变化:', networkInfo);
    });
  }
}

// 页面可见性优化
export function optimizePageVisibility() {
  let isPageVisible = true;
  
  document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
    
    if (isPageVisible) {
      // 页面变为可见时，可以刷新数据
      console.log('页面变为可见');
    } else {
      // 页面隐藏时，可以暂停一些操作
      console.log('页面隐藏');
    }
  });
  
  return () => isPageVisible;
}

// 导出性能监控实例
export const performanceMonitor = new PerformanceMonitor(); 
