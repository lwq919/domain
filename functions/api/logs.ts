export interface LogEntry {
  id?: number;
  type: 'operation' | 'notification';
  action: string;
  details: string;
  status: 'success' | 'error' | 'warning';
  timestamp: string;
  user_agent?: string;
  ip_address?: string;
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

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const method = request.method.toUpperCase();

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
      } else {
        // 获取所有日志，先操作日志再通知日志
        query = `
          SELECT 'operation' as log_type, id, action, details, status, timestamp, user_agent, ip_address, NULL as domain, NULL as notification_method, NULL as message, NULL as error_details
          FROM operation_logs
          UNION ALL
          SELECT 'notification' as log_type, id, 'notification' as action, message as details, status, timestamp, NULL as user_agent, NULL as ip_address, domain, notification_method, message, error_details
          FROM notification_logs
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
      const { type, action, details, status, domain, notification_method, message, error_details } = body;

      if (type === 'operation') {
        // 记录操作日志
        const userAgent = request.headers.get('user-agent') || '';
        const ipAddress = request.headers.get('cf-connecting-ip') || 
                         request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || '';

        await env.DB.prepare(
          'INSERT INTO operation_logs (action, details, status, timestamp, user_agent, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          action,
          details,
          status,
          new Date().toISOString(),
          userAgent,
          ipAddress
        ).run();
      } else if (type === 'notification') {
        // 记录通知日志
        await env.DB.prepare(
          'INSERT INTO notification_logs (domain, notification_method, status, message, timestamp, error_details) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          domain,
          notification_method,
          status,
          message,
          new Date().toISOString(),
          error_details || null
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
      const days = parseInt(url.searchParams.get('days') || '30');

      if (type === 'operation') {
        await env.DB.prepare(
          'DELETE FROM operation_logs WHERE timestamp < datetime("now", "-" || ? || " days")'
        ).bind(days).run();
      } else if (type === 'notification') {
        await env.DB.prepare(
          'DELETE FROM notification_logs WHERE timestamp < datetime("now", "-" || ? || " days")'
        ).bind(days).run();
      } else {
        // 清理所有日志
        await env.DB.prepare(
          'DELETE FROM operation_logs WHERE timestamp < datetime("now", "-" || ? || " days")'
        ).bind(days).run();
        await env.DB.prepare(
          'DELETE FROM notification_logs WHERE timestamp < datetime("now", "-" || ? || " days")'
        ).bind(days).run();
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
