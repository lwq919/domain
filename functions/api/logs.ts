export interface LogEntry {
  id?: number;
  type: 'operation' | 'notification' | 'access';
  action: string;
  details: string;
  status: 'success' | 'error' | 'warning';
  timestamp: string;
  user_agent?: string;
  ip_address?: string;
  device_info?: string;
}

export interface NotificationLog {
  id?: number;
  domain: string;
  notification_method: string;
  status: 'sent' | 'failed';
  message: string;
  timestamp: string;
  error_details?: string;
}

import { initializeDatabase } from './common';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  // 确保数据库已初始化
  try {
    await initializeDatabase(env);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return new Response(JSON.stringify({ success: false, error: '数据库初始化失败' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (method === 'GET') {
    try {
      const url = new URL(request.url);
      const type = url.searchParams.get('type') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = '';
      let params: any[] = [];

      if (type === 'operation') {
        query = 'SELECT * FROM operation_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params = [limit, offset];
      } else if (type === 'notification') {
        query = 'SELECT * FROM notification_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params = [limit, offset];
      } else if (type === 'access') {
        query = 'SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params = [limit, offset];
      } else {
        // 获取所有日志，先操作日志再通知日志再访问日志
        query = `
          SELECT 'operation' as log_type, id, action, details, status, timestamp, user_agent, ip_address, NULL as domain, NULL as notification_method, NULL as message, NULL as error_details, NULL as device_info
          FROM operation_logs
          UNION ALL
          SELECT 'notification' as log_type, id, 'notification' as action, message as details, status, timestamp, NULL as user_agent, NULL as ip_address, domain, notification_method, message, error_details, NULL as device_info
          FROM notification_logs
          UNION ALL
          SELECT 'access' as log_type, id, action, details, status, timestamp, user_agent, ip_address, NULL as domain, NULL as notification_method, NULL as message, NULL as error_details, device_info
          FROM access_logs
          ORDER BY timestamp DESC
          LIMIT ? OFFSET ?
        `;
        params = [limit, offset];
      }

      const { results } = await env.DB.prepare(query).bind(...params).all();
      
      return new Response(JSON.stringify({ 
        success: true, 
        logs: results,
        pagination: {
          limit,
          offset,
          total: results.length
        }
      }), {
        headers: { 'content-type': 'application/json' }
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  if (method === 'POST') {
    try {
      const body = await request.json();
      const { type, action, details, status, domain, notification_method, message, error_details, device_info } = body;

      if (type === 'operation') {
        // 记录操作日志
        const userAgent = request.headers.get('user-agent') || '';
        const ipAddress = request.headers.get('cf-connecting-ip') || 
                         request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || '';

        await env.DB.prepare(
          'INSERT INTO operation_logs (action, details, status, user_agent, ip_address) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          action,
          details,
          status,
          userAgent,
          ipAddress
        ).run();
      } else if (type === 'notification') {
        // 记录通知日志
        await env.DB.prepare(
          'INSERT INTO notification_logs (domain, notification_method, status, message, error_details) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          domain,
          notification_method,
          status,
          message,
          error_details || null
        ).run();
      } else if (type === 'access') {
        // 记录访问日志
        const userAgent = request.headers.get('user-agent') || '';
        const ipAddress = request.headers.get('cf-connecting-ip') || 
                         request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || '';

        await env.DB.prepare(
          'INSERT INTO access_logs (action, details, status, user_agent, ip_address, device_info) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          action,
          details,
          status,
          userAgent,
          ipAddress,
          device_info || null
        ).run();
      }

      return new Response(JSON.stringify({ success: true, message: '日志记录成功' }), {
        headers: { 'content-type': 'application/json' }
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  if (method === 'DELETE') {
    try {
      const url = new URL(request.url);
      const type = url.searchParams.get('type');

      if (type === 'operation') {
        await env.DB.prepare('DELETE FROM operation_logs').run();
      } else if (type === 'notification') {
        await env.DB.prepare('DELETE FROM notification_logs').run();
      } else if (type === 'access') {
        await env.DB.prepare('DELETE FROM access_logs').run();
      } else {
        // 清理所有日志
        await env.DB.prepare('DELETE FROM operation_logs').run();
        await env.DB.prepare('DELETE FROM notification_logs').run();
        await env.DB.prepare('DELETE FROM access_logs').run();
      }

      return new Response(JSON.stringify({ success: true, message: '日志清理成功' }), {
        headers: { 'content-type': 'application/json' }
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: '不支持的请求方法' }), {
    status: 405,
    headers: { 'content-type': 'application/json' }
  });
}; 
