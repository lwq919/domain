export interface Domain {
  domain: string;
  status: string;
  registrar: string;
  register_date: string;
  expire_date: string;
  renewUrl?: string;
}

export interface NotificationSettings {
  warningDays: string;
  notificationEnabled: string;
  notificationInterval: string;
  notificationMethods: string[];
  emailConfig?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  wechatSendKey?: string;
  qqKey?: string;
  webhookUrl?: string;
}

// 详细的日志记录函数
async function logNotificationDetail(env: any, action: string, details: string, status: 'success' | 'error' | 'warning' | 'info' = 'info', domain?: string, method?: string, error?: string) {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${action}: ${details}`;
    console.log(logMessage);
    
    // 记录到数据库
    await env.DB.prepare(
      'INSERT INTO notification_logs (domain, notification_method, status, message, error_details, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      domain || 'system',
      method || 'system',
      status,
      details,
      error || null,
      timestamp
    ).run();
  } catch (error) {
    console.error('记录通知日志失败:', error);
  }
}

function getDaysUntilExpiry(expire_date: string): number {
  const today = new Date();
  const expiry = new Date(expire_date);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isExpiringSoon(expire_date: string, days: number = 15): boolean {
  const daysLeft = getDaysUntilExpiry(expire_date);
  return daysLeft <= days && daysLeft > 0;
}

// 微信Server酱推送
async function sendWeChatNotify(title: string, content: string, sendKey: string) {
  const res = await fetch(`https://sctapi.ftqq.com/${sendKey}.send`, {
    method: 'POST',
    body: new URLSearchParams({ title, desp: content })
  });
  return res.json();
}

// QQ Qmsg酱推送
async function sendQQNotify(content: string, key: string, qq: string) {
  const res = await fetch(`https://qmsg.zendee.cn/send/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ msg: content, qq })
  });
  return res.json();
}



export const onRequest = async (context: any) => {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  // 记录请求开始
  await logNotificationDetail(env, 'NOTIFY_REQUEST', `收到${method}请求`, 'info');

  if (method === 'GET') {
    // 查询通知设置
    try {
      await logNotificationDetail(env, 'GET_SETTINGS', '开始查询通知设置', 'info');
      
      const { results } = await env.DB.prepare(
        'SELECT warning_days as warningDays, notification_enabled as notificationEnabled, notification_interval as notificationInterval, notification_method as notificationMethods, email_config as emailConfig, telegram_bot_token as telegramBotToken, telegram_chat_id as telegramChatId, wechat_send_key as wechatSendKey, qq_key as qqKey, webhook_url as webhookUrl FROM notification_settings LIMIT 1'
      ).all();
      
      if (results.length === 0) {
        await logNotificationDetail(env, 'GET_SETTINGS', '未找到通知设置', 'warning');
        return new Response(JSON.stringify({ success: true, settings: null }), {
          headers: { 'content-type': 'application/json' }
        });
      }
      
      await logNotificationDetail(env, 'GET_SETTINGS', `成功获取通知设置: ${JSON.stringify(results[0])}`, 'success');
      return new Response(JSON.stringify({ success: true, settings: results[0] }), {
        headers: { 'content-type': 'application/json' }
      });
    } catch (e: any) {
      await logNotificationDetail(env, 'GET_SETTINGS', `查询通知设置失败: ${e.message}`, 'error');
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  if (method === 'POST') {
    try {
      const body = await request.json();
      await logNotificationDetail(env, 'POST_REQUEST', `收到POST请求，body类型: ${body.settings ? 'settings' : body.domains ? 'domains' : 'unknown'}`, 'info');
      
      // 保存通知设置
      if (body.settings) {
        await logNotificationDetail(env, 'SAVE_SETTINGS', '开始保存通知设置', 'info');
        
        const s = body.settings as NotificationSettings;
        if (!s.warningDays || !s.notificationEnabled || !s.notificationInterval) {
          await logNotificationDetail(env, 'SAVE_SETTINGS', '通知设置参数不完整', 'error');
          return new Response(JSON.stringify({ success: false, error: '参数不完整' }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
          });
        }
        
        await env.DB.exec('DELETE FROM notification_settings');
        await env.DB.prepare(
          'INSERT INTO notification_settings (warning_days, notification_enabled, notification_interval, notification_method, email_config, telegram_bot_token, telegram_chat_id, wechat_send_key, qq_key, webhook_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          s.warningDays, 
          s.notificationEnabled, 
          s.notificationInterval, 
          JSON.stringify(s.notificationMethods || []),
          s.emailConfig || null,
          s.telegramBotToken || null,
          s.telegramChatId || null,
          s.wechatSendKey || null,
          s.qqKey || null,
          s.webhookUrl || null
        ).run();
        
        await logNotificationDetail(env, 'SAVE_SETTINGS', '通知设置保存成功', 'success');
        return new Response(JSON.stringify({ success: true, message: '设置已保存' }), {
          headers: { 'content-type': 'application/json' }
        });
      }
      
      // 多方式通知分发
      if (body.domains) {
        await logNotificationDetail(env, 'NOTIFY_DOMAINS', `开始处理域名通知，域名数量: ${body.domains.length}`, 'info');
        
        // 检查环境变量配置
        await logNotificationDetail(env, 'ENV_CHECK', '开始检查环境变量配置', 'info');
        
        const envConfig = {
          TG_BOT_TOKEN: env.TG_BOT_TOKEN ? '已配置' : '未配置',
          TG_USER_ID: env.TG_USER_ID ? '已配置' : '未配置',
          WECHAT_SENDKEY: env.WECHAT_SENDKEY ? '已配置' : '未配置',
          QMSG_KEY: env.QMSG_KEY ? '已配置' : '未配置',
          QMSG_QQ: env.QMSG_QQ ? '已配置' : '未配置'
        };
        
        await logNotificationDetail(env, 'ENV_CHECK', `环境变量配置: ${JSON.stringify(envConfig)}`, 'info');
        
        // 从环境变量获取通知配置
        let notifyMethods: string[] = [];
        let settings: any = {};
        
        // 检查环境变量中配置的通知方式
        const envMethods = [];
        if (env.TG_BOT_TOKEN && env.TG_USER_ID) {
          envMethods.push('telegram');
          await logNotificationDetail(env, 'ENV_METHODS', '检测到Telegram配置', 'info');
        }
        if (env.WECHAT_SENDKEY) {
          envMethods.push('wechat');
          await logNotificationDetail(env, 'ENV_METHODS', '检测到微信配置', 'info');
        }
        if (env.QMSG_KEY && env.QMSG_QQ) {
          envMethods.push('qq');
          await logNotificationDetail(env, 'ENV_METHODS', '检测到QQ配置', 'info');
        }
        
        // 如果环境变量中有配置，优先使用环境变量
        if (envMethods.length > 0) {
          notifyMethods = envMethods;
          await logNotificationDetail(env, 'METHOD_SELECTION', `使用环境变量配置的通知方式: ${envMethods.join(', ')}`, 'info');
        } else {
          await logNotificationDetail(env, 'METHOD_SELECTION', '环境变量中未配置通知方式，尝试从数据库获取', 'info');
          
          // 否则从数据库获取配置
          try {
            const { results } = await env.DB.prepare(
              'SELECT notification_method, email_config, telegram_bot_token, telegram_chat_id, wechat_send_key, qq_key, webhook_url FROM notification_settings LIMIT 1'
            ).all();
            if (results.length > 0) {
              settings = results[0];
              const val = results[0].notification_method;
              if (Array.isArray(val)) {
                notifyMethods = val;
              } else if (typeof val === 'string') {
                try {
                  notifyMethods = JSON.parse(val);
                } catch (error) {
                  console.error('解析通知方法失败:', error);
                  notifyMethods = ['telegram']; // 默认使用telegram
                }
              }
              await logNotificationDetail(env, 'DB_METHODS', `从数据库获取通知方式: ${JSON.stringify(notifyMethods)}`, 'info');
            }
          } catch (error) {
            await logNotificationDetail(env, 'DB_METHODS', `从数据库获取通知方式失败: ${error}`, 'error');
          }
        }
        
        if (!Array.isArray(notifyMethods) || notifyMethods.length === 0) {
          notifyMethods = ['telegram'];
          await logNotificationDetail(env, 'METHOD_FALLBACK', '使用默认通知方式: telegram', 'warning');
        }
        
        await logNotificationDetail(env, 'FINAL_METHODS', `最终使用的通知方式: ${JSON.stringify(notifyMethods)}`, 'info');
        
        // 从数据库获取警告天数设置
        let warningDays = 15; // 默认15天
        try {
          const { results } = await env.DB.prepare(
            'SELECT warning_days FROM notification_settings LIMIT 1'
          ).all();
          if (results.length > 0 && results[0].warning_days) {
            warningDays = parseInt(results[0].warning_days, 10) || 15;
          }
        } catch (error) {
          await logNotificationDetail(env, 'WARNING_DAYS', `获取警告天数设置失败: ${error}，使用默认值15天`, 'warning');
        }
        
        await logNotificationDetail(env, 'WARNING_DAYS', `使用警告天数: ${warningDays}天`, 'info');
        
        // 检查到期域名
        const expiringDomains = body.domains.filter((domain: Domain) => isExpiringSoon(domain.expire_date, warningDays));
        await logNotificationDetail(env, 'EXPIRING_CHECK', `检查到期域名，找到 ${expiringDomains.length} 个即将到期的域名`, 'info');
        
        if (expiringDomains.length > 0) {
          await logNotificationDetail(env, 'EXPIRING_DOMAINS', `即将到期的域名: ${expiringDomains.map((d: Domain) => `${d.domain}(${getDaysUntilExpiry(d.expire_date)}天)`).join(', ')}`, 'info');
        }
        
        if (expiringDomains.length === 0) {
          await logNotificationDetail(env, 'NO_EXPIRING', '没有即将到期的域名，无需发送通知', 'info');
          return new Response(JSON.stringify({ success: true, message: '没有即将到期的域名' }), { headers: { 'content-type': 'application/json' } });
        }
        
        let results: any[] = [];
        let errors: any[] = [];
        
        // 发送通知
        for (const method of notifyMethods) {
          try {
            await logNotificationDetail(env, 'SEND_NOTIFY', `开始发送${method}通知`, 'info');
            
            if (method === 'telegram') {
              // Telegram 通知逻辑
              const botToken = env.TG_BOT_TOKEN || settings.telegram_bot_token;
              const chatId = env.TG_USER_ID || settings.telegram_chat_id;
              
              if (!botToken || !chatId) {
                const error = 'Telegram配置未设置';
                await logNotificationDetail(env, 'TELEGRAM_ERROR', error, 'error', undefined, 'telegram', error);
                throw new Error(error);
              }
              
              let message = '⚠️ <b>域名到期提醒</b>\n\n';
              message += `以下域名将在${warningDays}天内到期：\n\n`;
              expiringDomains.forEach((domain: Domain) => {
                const daysLeft = getDaysUntilExpiry(domain.expire_date);
                message += ` <b>${domain.domain}</b>\n`;
                message += `   注册商：${domain.registrar}\n`;
                message += `   到期时间：${domain.expire_date}\n`;
                message += `   剩余天数：${daysLeft}天\n\n`;
              });
              message += `请及时续费以避免域名过期！`;
              
              await logNotificationDetail(env, 'TELEGRAM_SEND', `发送Telegram消息，长度: ${message.length}字符`, 'info');
              
              const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
              });
              
              if (!telegramResponse.ok) {
                const errorText = await telegramResponse.text();
                const error = `Telegram API请求失败: ${telegramResponse.status} ${telegramResponse.statusText} - ${errorText}`;
                await logNotificationDetail(env, 'TELEGRAM_ERROR', error, 'error', undefined, 'telegram', error);
                throw new Error(error);
              }
              
              const responseData = await telegramResponse.json();
              await logNotificationDetail(env, 'TELEGRAM_SUCCESS', `Telegram发送成功，响应: ${JSON.stringify(responseData)}`, 'success', undefined, 'telegram');
              
              // 记录通知日志
              for (const domain of expiringDomains) {
                await logNotificationDetail(env, 'NOTIFY_LOG', `记录Telegram通知日志`, 'success', domain.domain, 'telegram');
              }
              
              results.push({ method: 'telegram', ok: true });
              
            } else if (method === 'wechat') {
              const sendKey = env.WECHAT_SENDKEY || settings.wechat_send_key;
              if (!sendKey) {
                const error = '未配置微信SendKey';
                await logNotificationDetail(env, 'WECHAT_ERROR', error, 'error', undefined, 'wechat', error);
                throw new Error(error);
              }
              
              let content = `以下域名将在${warningDays}天内到期：\n\n`;
              expiringDomains.forEach((domain: Domain) => {
                const daysLeft = getDaysUntilExpiry(domain.expire_date);
                content += `域名: ${domain.domain}\n注册商: ${domain.registrar}\n到期时间: ${domain.expire_date}\n剩余天数: ${daysLeft}天\n\n`;
              });
              content += '请及时续费以避免域名过期！';
              
              await logNotificationDetail(env, 'WECHAT_SEND', `发送微信消息，长度: ${content.length}字符`, 'info');
              
              const wechatResponse = await sendWeChatNotify('域名到期提醒', content, sendKey);
              await logNotificationDetail(env, 'WECHAT_SUCCESS', `微信发送成功，响应: ${JSON.stringify(wechatResponse)}`, 'success', undefined, 'wechat');
              
              results.push({ method: 'wechat', ok: true });
              
            } else if (method === 'qq') {
              const key = env.QMSG_KEY || settings.qq_key;
              const qq = env.QMSG_QQ;
              if (!key || !qq) {
                const error = '未配置Qmsg酱 key 或 QQ号';
                await logNotificationDetail(env, 'QQ_ERROR', error, 'error', undefined, 'qq', error);
                throw new Error(error);
              }
              
              let content = `以下域名将在${warningDays}天内到期：\n\n`;
              expiringDomains.forEach((domain: Domain) => {
                const daysLeft = getDaysUntilExpiry(domain.expire_date);
                content += `域名: ${domain.domain}\n注册商: ${domain.registrar}\n到期时间: ${domain.expire_date}\n剩余天数: ${daysLeft}天\n\n`;
              });
              content += '请及时续费以避免域名过期！';
              
              await logNotificationDetail(env, 'QQ_SEND', `发送QQ消息，长度: ${content.length}字符`, 'info');
              
              const qqResponse = await sendQQNotify(content, key, qq);
              await logNotificationDetail(env, 'QQ_SUCCESS', `QQ发送成功，响应: ${JSON.stringify(qqResponse)}`, 'success', undefined, 'qq');
              
              results.push({ method: 'qq', ok: true });
              

              
            } else {
              const error = '不支持的通知方式';
              await logNotificationDetail(env, 'UNSUPPORTED_METHOD', error, 'error', undefined, method, error);
              errors.push({ method, error });
            }
          } catch (err: any) {
            const errorMsg = err.message || err;
            await logNotificationDetail(env, 'NOTIFY_ERROR', `发送${method}通知失败: ${errorMsg}`, 'error', undefined, method, errorMsg);
            
            // 记录失败的通知日志
            for (const domain of expiringDomains) {
              await logNotificationDetail(env, 'NOTIFY_LOG_FAILED', `记录失败的通知日志`, 'error', domain.domain, method, errorMsg);
            }
            errors.push({ method, error: errorMsg });
          }
        }
        
        await logNotificationDetail(env, 'NOTIFY_COMPLETE', `通知发送完成，成功: ${results.length}，失败: ${errors.length}`, 'info');
        
        return new Response(JSON.stringify({ success: errors.length === 0, results, errors }), { headers: { 'content-type': 'application/json' } });
      }
      
      await logNotificationDetail(env, 'INVALID_REQUEST', '请求参数错误', 'error');
      return new Response(JSON.stringify({ success: false, error: '参数错误' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    } catch (e: any) {
      await logNotificationDetail(env, 'REQUEST_ERROR', `处理请求时发生错误: ${e.message}`, 'error', undefined, undefined, e.message);
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }
  
  await logNotificationDetail(env, 'INVALID_METHOD', `不支持的请求方法: ${method}`, 'error');
  return new Response(JSON.stringify({ success: false, error: '不支持的请求方法' }), {
    status: 405,
    headers: { 'content-type': 'application/json' }
  });
}; 
