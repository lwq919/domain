export interface Domain {
  id?: number;
  domain: string;
  status: string;
  registrar: string;
  register_date: string;
  expire_date: string;
  renewUrl?: string;
}

export function createErrorResponse(error: string, status: number = 500) {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

export function createSuccessResponse(data: any = { success: true }) {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' }
  });
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

export function validateDomainsArray(domains: any[]): { valid: boolean; invalidDomains: any[] } {
  const validationResults = domains.map((domain: Domain) => ({
    domain,
    validation: validateDomain(domain)
  }));
  const invalidDomains = validationResults.filter((result: any) => !result.validation.valid);
  return {
    valid: invalidDomains.length === 0,
    invalidDomains: invalidDomains.map((item: any) => ({
      domain: item.domain.domain,
      errors: item.validation.errors
    }))
  };
}

export async function createAccessLogsTable(env: any) {
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT,
        ip_address TEXT,
        device_info TEXT
      )
    `).run();
    
    // 创建索引
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp)
    `).run();
    
    console.log('访问日志表创建成功');
  } catch (error) {
    console.error('创建访问日志表失败:', error);
    throw error;
  }
}

export async function initializeDatabase(env: any) {
  try {
    // 创建域名表
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT UNIQUE NOT NULL,
        registrar TEXT NOT NULL,
        register_date TEXT NOT NULL,
        expire_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        renew_url TEXT
      )
    `).run();

    // 创建操作日志表
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT,
        ip_address TEXT
      )
    `).run();

    // 创建通知日志表
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,
        notification_method TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        error_details TEXT
      )
    `).run();

    // 创建访问日志表
    await createAccessLogsTable(env);

    // 创建通知设置表
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        warning_days TEXT NOT NULL DEFAULT '15',
        notification_enabled TEXT NOT NULL DEFAULT 'true',
        notification_interval TEXT NOT NULL DEFAULT 'daily',
        notification_method TEXT NOT NULL DEFAULT '[]',
        email_config TEXT,
        telegram_bot_token TEXT,
        telegram_chat_id TEXT,
        wechat_send_key TEXT,
        qq_key TEXT,
        webhook_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 插入默认通知设置
    await env.DB.prepare(`
      INSERT OR IGNORE INTO notification_settings (id, warning_days, notification_enabled, notification_interval, notification_method)
      VALUES (1, '15', 'true', 'daily', '[]')
    `).run();

    // 创建索引
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain)
    `).run();
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status)
    `).run();
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_domains_expire_date ON domains(expire_date)
    `).run();
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON operation_logs(timestamp)
    `).run();
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_notification_logs_timestamp ON notification_logs(timestamp)
    `).run();
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_notification_logs_domain ON notification_logs(domain)
    `).run();

    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
} 
