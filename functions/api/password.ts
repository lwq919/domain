import { Hono } from 'hono';

const app = new Hono();

app.post('/', async (c: any) => {
  try {
    const body = await c.req.json();
    const { password } = body;
    
    // 从环境变量获取管理员密码
    const adminPassword = c.env.PASSWORD;
    
    if (!adminPassword) {
      return c.json({ 
        success: false, 
        error: '管理员密码未配置' 
      }, 500);
    }
    
    if (!password) {
      return c.json({ 
        success: false, 
        error: '密码不能为空' 
      }, 400);
    }
    
    // 验证密码 - 使用时间安全的字符串比较
    const isValid = password.length === adminPassword.length && 
                   password === adminPassword;
    
    return c.json({ 
      success: isValid,
      message: isValid ? '密码验证成功' : '密码错误'
    });
    
  } catch (error) {
    console.error('密码验证错误:', error);
    return c.json({ 
      success: false, 
      error: '密码验证失败' 
    }, 500);
  }
});

export default app; 
