import { createErrorResponse, createSuccessResponse } from './common';

interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  path: string;
}

interface BackupData {
  domains: any[];
  settings: any;
  timestamp: string;
  version: string;
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'POST') {
    try {
      const body = await request.json();
      const { action, webdavConfig } = body;

      if (!action) {
        return createErrorResponse('缺少操作类型', 400);
      }

      // 优先使用传入的配置，如果没有则使用环境变量
      let config: WebDAVConfig;
      
      if (webdavConfig && webdavConfig.url && webdavConfig.username && webdavConfig.password) {
        config = {
          url: webdavConfig.url,
          username: webdavConfig.username,
          password: webdavConfig.password,
          path: webdavConfig.path || '/domain/domains-backup.json'
        };
      } else {
        // 从环境变量获取配置
        const envUrl = env.WEBDAV_URL;
        const envUser = env.WEBDAV_USER;
        const envPass = env.WEBDAV_PASS;
        
        if (!envUrl || !envUser || !envPass) {
          return createErrorResponse('WebDAV配置不完整，请检查环境变量或手动输入配置', 400);
        }
        
        config = {
          url: envUrl,
          username: envUser,
          password: envPass,
          path: '/domain/domains-backup.json'
        };
      }

      if (action === 'backup') {
        return await handleBackup(env, config);
      } else if (action === 'restore') {
        return await handleRestore(env, config);
      } else {
        return createErrorResponse('不支持的操作', 400);
      }
    } catch (e: any) {
      return createErrorResponse(e.message, 500);
    }
  }

  return createErrorResponse('Method Not Allowed', 405);
};

async function handleBackup(env: any, config: WebDAVConfig): Promise<Response> {
  try {
    // 获取域名数据
    const { results: domains } = await env.DB.prepare(
      'SELECT id, domain, status, registrar, register_date, expire_date, renewUrl FROM domains ORDER BY id DESC'
    ).all();

    // 获取通知设置
    const { results: settings } = await env.DB.prepare(
      'SELECT * FROM notification_settings LIMIT 1'
    ).all();

    const backupData: BackupData = {
      domains: domains || [],
      settings: settings?.[0] || {},
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    const backupContent = JSON.stringify(backupData, null, 2);
    const filename = `domains-backup-${new Date().toISOString().split('T')[0]}.json`;

    // 确保domain文件夹存在
    const domainFolderUrl = new URL('/domain/', config.url).toString();
    const auth = btoa(`${config.username}:${config.password}`);

    // 尝试创建domain文件夹（如果不存在）
    try {
      const mkcolResponse = await fetch(domainFolderUrl, {
        method: 'MKCOL',
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      // 如果文件夹已存在，会返回405 Method Not Allowed，这是正常的
      if (!mkcolResponse.ok && mkcolResponse.status !== 405) {
        console.warn(`创建domain文件夹失败: ${mkcolResponse.status} ${mkcolResponse.statusText}`);
      }
    } catch (error) {
      console.warn('创建domain文件夹时出错:', error);
    }

    // 上传到WebDAV的domain文件夹
    const uploadUrl = new URL(`/domain/${filename}`, config.url).toString();

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': backupContent.length.toString()
      },
      body: backupContent
    });

    if (!uploadResponse.ok) {
      throw new Error(`WebDAV上传失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    return createSuccessResponse({
      success: true,
      message: '备份成功',
      filename,
      domainsCount: domains?.length || 0
    });
  } catch (error: any) {
    return createErrorResponse(`备份失败: ${error.message}`, 500);
  }
}

async function handleRestore(env: any, config: WebDAVConfig): Promise<Response> {
  try {
    // 从WebDAV的domain文件夹下载备份文件
    const downloadUrl = new URL(config.path, config.url).toString();
    const auth = btoa(`${config.username}:${config.password}`);

    const downloadResponse = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!downloadResponse.ok) {
      throw new Error(`WebDAV下载失败: ${downloadResponse.status} ${downloadResponse.statusText}`);
    }

    const backupContent = await downloadResponse.text();
    const backupData: BackupData = JSON.parse(backupContent);

    if (!backupData.domains || !Array.isArray(backupData.domains)) {
      throw new Error('备份文件格式错误');
    }

    // 清空现有数据
    await env.DB.exec('DELETE FROM domains');

    // 恢复域名数据
    for (const domain of backupData.domains) {
      await env.DB.prepare(
        'INSERT INTO domains (domain, status, registrar, register_date, expire_date, renewUrl) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        domain.domain,
        domain.status,
        domain.registrar,
        domain.register_date,
        domain.expire_date,
        domain.renewUrl || null
      ).run();
    }

    // 恢复设置数据（如果存在）
    if (backupData.settings && Object.keys(backupData.settings).length > 0) {
      await env.DB.exec('DELETE FROM notification_settings');
      await env.DB.prepare(
        'INSERT INTO notification_settings (warningDays, notificationEnabled, notificationInterval, notificationMethod) VALUES (?, ?, ?, ?)'
      ).bind(
        backupData.settings.warningDays || '15',
        backupData.settings.notificationEnabled || 'true',
        backupData.settings.notificationInterval || 'daily',
        backupData.settings.notificationMethod || '[]'
      ).run();
    }

    return createSuccessResponse({
      success: true,
      message: '恢复成功',
      domainsCount: backupData.domains.length,
      timestamp: backupData.timestamp
    });
  } catch (error: any) {
    return createErrorResponse(`恢复失败: ${error.message}`, 500);
  }
} 
