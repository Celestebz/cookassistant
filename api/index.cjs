require('dotenv').config();
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const multipart = require('@fastify/multipart');
const fs = require('node:fs');
const path = require('node:path');
const { nanoid } = require('nanoid');
const { createClient } = require('@supabase/supabase-js');

// Supabase配置 - 确保在Vercel环境中正确获取环境变量
const supabaseUrl = process.env.SUPABASE_URL || 'https://bqbtkaljxsmdcpedrerg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDg0NDUsImV4cCI6MjA3NDAyNDQ0NX0._XIcJcSg_00b_iOs90QM5GNaKAg5_LEHGDrexDTFcMQ';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODQ0ODQ0NSwiZXhwIjoyMDc0MDI0NDQ1fQ.2dPg9lY8I28Zqci9X2lM8hc5vseLFO9Komz0z_xzTvM';

console.log('🔧 Supabase配置检查:', {
  SUPABASE_URL: !!supabaseUrl,
  SUPABASE_ANON_KEY: !!supabaseKey,
  SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey,
  usingFallback: !process.env.SUPABASE_URL
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 创建Fastify应用
const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
});

// 注册插件
app.register(cors, {
  origin: true,
  credentials: true
});

app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 重试函数
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`尝试 ${i + 1}/${maxRetries} 失败:`, error.message);
      
      if (i < maxRetries - 1 && (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.message.includes('fetch failed'))) {
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      
      throw error;
    }
  }
}

// 用户认证中间件
async function authMiddleware(req, reply) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return reply.code(401).send({ error: '未提供认证令牌' });
  }

  try {
    console.log('验证令牌:', token.substring(0, 20) + '...');
    
    const { data: { user }, error } = await withRetry(async () => {
      return await supabaseAdmin.auth.getUser(token);
    });
    
    console.log('认证结果:', { user: user?.id, error });
    
    if (error || !user) {
      console.error('认证失败:', error);
      return reply.code(401).send({ error: '无效的认证令牌' });
    }
    
    req.user = user;
    return;
  } catch (error) {
    console.error('认证中间件错误:', error);
    return reply.code(401).send({ error: '认证失败，请稍后重试' });
  }
}

// 获取用户信息
async function getUserInfo(userId) {
  try {
    console.log('获取用户信息，用户ID:', userId);
    
    const { data: pointsRows, error: pointsError } = await withRetry(async () => {
      return await supabaseAdmin
        .from('user_points')
        .select('points, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
    });
    const pointsData = Array.isArray(pointsRows) ? pointsRows[0] : null;

    console.log('积分查询结果:', { pointsData, pointsError });

    const { data: profileRows, error: profileError } = await withRetry(async () => {
      return await supabaseAdmin
        .from('user_profiles')
        .select('username, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
    });
    const profileData = Array.isArray(profileRows) ? profileRows[0] : null;

    console.log('用户资料查询结果:', { profileData, profileError });

    let finalUsername = profileData?.username;
    
    console.log('初始用户名:', finalUsername, 'profileError:', profileError);
    
    if (!finalUsername || finalUsername === '用户' || profileError) {
      console.log('用户资料不完整，尝试从auth获取用户信息');
      try {
        const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (user) {
          console.log('从auth获取到用户信息:', { 
            email: user.email, 
            metadata: user.user_metadata 
          });
          
          if (user.user_metadata && user.user_metadata.username) {
            finalUsername = user.user_metadata.username;
            console.log('从auth metadata获取到用户名:', finalUsername);
          } else if (user.email) {
            finalUsername = user.email.split('@')[0];
            console.log('使用邮箱前缀作为用户名:', finalUsername);
          }
        }
      } catch (error) {
        console.error('从auth获取用户信息失败:', error);
      }
    }

    if (!finalUsername || finalUsername === '用户') {
      finalUsername = `用户_${userId.substring(0, 8)}`;
      console.log('使用默认用户名:', finalUsername);
    }
    
    console.log('最终确定的用户名:', finalUsername);

    let userPoints = pointsData?.points;
    if (userPoints === undefined || userPoints === null) {
      console.log('用户没有积分记录，创建默认积分记录');
      const { error: createPointsError } = await withRetry(async () => {
        return await supabaseAdmin
          .from('user_points')
          .upsert({
            user_id: userId,
            points: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
      });

      if (createPointsError) {
        console.error('创建积分记录失败:', createPointsError);
        userPoints = 100; // 默认积分
      } else {
        userPoints = 100;
        console.log('✅ 积分记录创建成功');
      }
    }

    console.log('最终用户信息:', {
      userId,
      username: finalUsername,
      points: userPoints
    });

    return {
      username: finalUsername,
      points: userPoints,
      error: null
    };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return {
      username: `用户_${userId.substring(0, 8)}`,
      points: 100,
      error: error.message
    };
  }
}

// 检查用户积分
async function checkUserPoints(userId, requiredPoints) {
  try {
    const { data: pointsRows, error } = await withRetry(async () => {
      return await supabaseAdmin
        .from('user_points')
        .select('points')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
    });

    const currentPoints = pointsRows && pointsRows.length > 0 ? pointsRows[0].points : 0;
    const hasEnough = currentPoints >= requiredPoints;

    console.log('积分检查结果:', {
      userId,
      currentPoints,
      requiredPoints,
      hasEnough
    });

    return {
      currentPoints,
      hasEnough,
      error: null
    };
  } catch (error) {
    console.error('检查积分失败:', error);
    return {
      currentPoints: 0,
      hasEnough: false,
      error: error.message
    };
  }
}

// 消费积分
async function consumePoints(userId, points) {
  try {
    console.log('开始消费积分:', { userId, points });
    
    const { data: currentRows, error: fetchError } = await withRetry(async () => {
      return await supabaseAdmin
        .from('user_points')
        .select('points')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
    });

    if (fetchError) {
      console.error('获取当前积分失败:', fetchError);
      return { error: '获取积分失败' };
    }

    const currentPoints = currentRows && currentRows.length > 0 ? currentRows[0].points : 0;
    
    if (currentPoints < points) {
      return { error: '积分不足' };
    }

    const newPoints = currentPoints - points;
    
    const { error: updateError } = await withRetry(async () => {
      return await supabaseAdmin
        .from('user_points')
        .upsert({
          user_id: userId,
          points: newPoints,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
    });

    if (updateError) {
      console.error('更新积分失败:', updateError);
      return { error: '扣除积分失败' };
    }

    console.log('积分消费成功:', { userId, oldPoints: currentPoints, newPoints });
    return { success: true, newPoints };
  } catch (error) {
    console.error('消费积分异常:', error);
    return { error: '扣除积分失败' };
  }
}

// 模拟AI分析函数
async function generateRecipeSteps({ imageUrl, prompt }) {
  console.log('开始AI分析，图片URL长度:', imageUrl?.length);
  
  // 模拟AI分析
  const mockSteps = [
    "1. 准备食材：根据图片中的菜品，准备相应的主料和辅料",
    "2. 处理食材：清洗、切配各种食材，注意大小均匀",
    "3. 热锅下油：将锅烧热，倒入适量食用油",
    "4. 爆炒主料：先下主料爆炒至半熟",
    "5. 加入辅料：依次加入各种辅料，炒制均匀",
    "6. 调味出锅：加入调料调味，炒匀后即可出锅装盘"
  ];
  
  return {
    dish_name: "美味佳肴",
    steps: mockSteps
  };
}

// 工作队列
const jobs = new Map();

// 处理任务
async function processJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    console.log('开始处理任务:', jobId);
    job.status = 'processing';

    let dataUrl;
    if (job.inputImageUrl.startsWith('data:')) {
      dataUrl = job.inputImageUrl;
    } else {
      const response = await fetch(job.inputImageUrl);
      const imageBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      const mimeType = job.inputImageUrl.includes('.png') ? 'image/png' : 'image/jpeg';
      dataUrl = `data:${mimeType};base64,${base64}`;
    }

    const stepsText = await generateRecipeSteps({ 
      imageUrl: dataUrl, 
      prompt: "请分析这张图片中的菜品，提供详细的烹饪步骤" 
    });

    job.recipe = stepsText;
    job.status = 'completed';
    job.completedAt = new Date().toISOString();

    console.log('任务处理完成:', jobId);
  } catch (err) {
    console.error('任务处理失败:', err);
    job.status = 'failed';
    job.error = { code: 'PROCESS_ERROR', message: String(err?.message || err) };
  }
}

// API路由

// 健康检查
app.get('/health', async (req, reply) => {
  return reply.send({
    status: 'ok',
    service: 'cook-assistant-api',
    timestamp: new Date().toISOString()
  });
});

// 测试Supabase连接
app.get('/test-supabase', async (req, reply) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_points')
      .select('count')
      .limit(1);
    
    return reply.send({
      status: 'ok',
      supabase_connected: !error,
      error: error?.message || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return reply.send({
      status: 'error',
      supabase_connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 用户注册
app.post('/auth/register', async (req, reply) => {
  try {
    const { username, password } = await req.body;
    
    if (!username || !password) {
      return reply.code(400).send({ error: '用户名和密码不能为空' });
    }

    if (username.length < 3) {
      return reply.code(400).send({ error: '用户名至少3个字符' });
    }

    if (password.length < 6) {
      return reply.code(400).send({ error: '密码至少6个字符' });
    }

    const email = `${username}@cookapp.local`;
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { username: username }
      }
    });

    if (authError) {
      return reply.code(400).send({ error: '创建用户失败: ' + authError.message });
    }

    if (!authData.user) {
      return reply.code(400).send({ error: '用户创建失败' });
    }

    const userId = authData.user.id;
    console.log('注册创建的用户ID:', userId);

    // 创建用户资料
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: userId,
        username: username,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('创建用户资料失败:', profileError);
    }

    // 创建积分记录
    const { error: pointsError } = await supabaseAdmin
      .from('user_points')
      .upsert({
        user_id: userId,
        points: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (pointsError) {
      console.error('创建积分记录失败:', pointsError);
    }

    return reply.send({
      success: true,
      userId: userId,
      token: authData.session?.access_token,
      message: '注册成功，获得100积分奖励！'
    });
  } catch (error) {
    console.error('注册失败:', error);
    return reply.code(500).send({ error: '注册失败，请稍后重试' });
  }
});

// 用户登录
app.post('/auth/login', async (req, reply) => {
  try {
    const { username, password } = await req.body;
    
    if (!username || !password) {
      return reply.code(400).send({ error: '用户名和密码不能为空' });
    }

    const email = `${username}@cookapp.local`;
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (authError || !authData.user) {
      return reply.code(401).send({ error: '用户名或密码错误' });
    }

    const userId = authData.user.id;
    
    // 确保用户有积分记录
    const { data: pointsData } = await supabaseAdmin
      .from('user_points')
      .select('points')
      .eq('user_id', userId)
      .single();

    if (!pointsData) {
      await supabaseAdmin
        .from('user_points')
        .insert({
          user_id: userId,
          points: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    return reply.send({
      success: true,
      userId: userId,
      token: authData.session.access_token,
      message: '登录成功'
    });
  } catch (error) {
    console.error('登录失败:', error);
    return reply.code(500).send({ error: '登录失败，请稍后重试' });
  }
});

// 获取用户信息
app.get('/auth/user', { preHandler: authMiddleware }, async (req, reply) => {
  try {
    console.log('开始获取用户信息，用户ID:', req.user.id);
    const userInfo = await getUserInfo(req.user.id);
    
    if (userInfo.error) {
      console.error('getUserInfo返回错误:', userInfo.error);
      return reply.code(500).send({ error: '获取用户信息失败', details: userInfo.error });
    }

    console.log('用户信息获取成功:', {
      id: req.user.id,
      username: userInfo.username,
      points: userInfo.points,
      error: userInfo.error
    });

    return reply.send({
      id: req.user.id,
      username: userInfo.username,
      points: userInfo.points,
      message: `当前积分：${userInfo.points}`
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return reply.code(500).send({ error: '获取用户信息失败' });
  }
});

// 检查积分
app.get('/auth/check-points', { preHandler: authMiddleware }, async (req, reply) => {
  try {
    const pointsCheck = await checkUserPoints(req.user.id, 10);
    return reply.send(pointsCheck);
  } catch (error) {
    console.error('检查积分失败:', error);
    return reply.code(500).send({ error: '检查积分失败' });
  }
});

// 图片上传和AI分析
app.post('/jobs', { preHandler: authMiddleware }, async (req, reply) => {
  const pointsCheck = await checkUserPoints(req.user.id, 10);
  if (!pointsCheck.hasEnough) {
    return reply.code(400).send({ 
      error: '积分不足，需要10积分进行AI分析', 
      currentPoints: pointsCheck.currentPoints,
      requiredPoints: 10
    });
  }

  const file = await req.file();
  if (!file) return reply.code(400).send({ error: 'image file is required' });
  
  try {
    const ext = (file.filename?.split('.').pop() || 'jpg').toLowerCase();
    const fileBuffer = await file.toBuffer();
    const base64 = fileBuffer.toString('base64');
    const mimeType = file.mimetype || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const jobId = nanoid();
    const job = {
      id: jobId,
      status: 'queued',
      inputImageUrl: dataUrl,
      userId: req.user.id,
      userPointsBeforeJob: pointsCheck.currentPoints,
      createdAt: new Date().toISOString()
    };

    jobs.set(jobId, job);

    // 异步处理任务
    processJob(jobId).then(async () => {
      if (job.status === 'completed') {
        try {
          await consumePoints(req.user.id, 10);
          console.log('积分扣除成功');
        } catch (error) {
          console.error('积分扣除失败:', error);
        }
      }
    });

    return reply.send({
      jobId: jobId,
      status: 'queued',
      message: '任务已提交，正在处理中...'
    });
  } catch (error) {
    console.error('上传失败:', error);
    return reply.code(500).send({ error: '上传失败: ' + error.message });
  }
});

// 获取任务状态
app.get('/jobs/:jobId', { preHandler: authMiddleware }, async (req, reply) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  
  if (!job) {
    return reply.code(404).send({ error: '任务不存在' });
  }
  
  if (job.userId !== req.user.id) {
    return reply.code(403).send({ error: '无权访问此任务' });
  }
  
  return reply.send(job);
});

// 导出应用
module.exports = app;
