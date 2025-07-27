import { Domain, validateDomain, createErrorResponse, createSuccessResponse, validateDomainsArray } from './common';

// 记录操作日志的函数
async function logOperation(env: any, action: string, details: string, status: 'success' | 'error' | 'warning' = 'success') {
  try {
    const userAgent = 'Server-Side'; // 服务器端操作
    const ipAddress = '127.0.0.1'; // 本地操作
    
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
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'GET') {
    try {
      const { results } = await env.DB.prepare(
        'SELECT id, domain, status, registrar, register_date, expire_date, renewUrl FROM domains ORDER BY id DESC'
      ).all();
      return createSuccessResponse({ success: true, domains: results });
    } catch (e: any) {
      return createErrorResponse(e.message, 500);
    }
  }

  if (method === 'POST') {
    try {
      const body = await request.json();
      if (!Array.isArray(body.domains)) {
        await logOperation(env, '添加域名', '数据格式错误', 'error');
        return createErrorResponse('数据格式错误', 400);
      }
      
      const validation = validateDomainsArray(body.domains);
      if (!validation.valid) {
        await logOperation(env, '添加域名', `数据校验失败: ${JSON.stringify(validation.invalidDomains)}`, 'error');
        return new Response(JSON.stringify({
          success: false,
          error: '数据校验失败',
          details: validation.invalidDomains
        }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }
      
      // 获取当前域名列表，用于判断是新增还是更新
      const { results: existingDomains } = await env.DB.prepare(
        'SELECT domain FROM domains'
      ).all();
      
      const existingDomainNames = existingDomains.map((d: any) => d.domain);
      const newDomains = body.domains.filter((d: Domain) => !existingDomainNames.includes(d.domain));
      const updatedDomains = body.domains.filter((d: Domain) => existingDomainNames.includes(d.domain));
      
      await env.DB.exec('DELETE FROM domains');
      for (const d of body.domains) {
        await env.DB.prepare(
          'INSERT INTO domains (domain, status, registrar, register_date, expire_date, renewUrl) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(d.domain, d.status, d.registrar, d.register_date, d.expire_date, d.renewUrl || null).run();
      }
      
      // 记录操作日志
      if (newDomains.length > 0) {
        await logOperation(env, '添加域名', `成功添加 ${newDomains.length} 个新域名: ${newDomains.map(d => d.domain).join(', ')}`, 'success');
      }
      if (updatedDomains.length > 0) {
        await logOperation(env, '更新域名', `成功更新 ${updatedDomains.length} 个域名: ${updatedDomains.map(d => d.domain).join(', ')}`, 'success');
      }
      
      return createSuccessResponse({ success: true, message: '数据保存成功' });
    } catch (e: any) {
      await logOperation(env, '添加域名', `保存失败: ${e.message}`, 'error');
      return createErrorResponse(e.message, 500);
    }
  }

  if (method === 'DELETE') {
    try {
      const body = await request.json();
      if (!body.domain) {
        await logOperation(env, '删除域名', '缺少域名参数', 'error');
        return createErrorResponse('缺少参数', 400);
      }
      
      // 检查域名是否存在
      const { results } = await env.DB.prepare('SELECT domain FROM domains WHERE domain = ?').bind(body.domain).all();
      if (results.length === 0) {
        await logOperation(env, '删除域名', `域名不存在: ${body.domain}`, 'warning');
        return createErrorResponse('域名不存在', 404);
      }
      
      await env.DB.prepare('DELETE FROM domains WHERE domain = ?').bind(body.domain).run();
      await logOperation(env, '删除域名', `成功删除域名: ${body.domain}`, 'success');
      return createSuccessResponse({ success: true, message: '删除成功' });
    } catch (e: any) {
      await logOperation(env, '删除域名', `删除失败: ${e.message}`, 'error');
      return createErrorResponse(e.message, 500);
    }
  }

  return createErrorResponse('Method Not Allowed', 405);
}; 
