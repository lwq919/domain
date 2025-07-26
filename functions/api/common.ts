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
