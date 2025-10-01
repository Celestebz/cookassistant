import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { generateRecipeSteps } from './providers/doubao.js';
import { buildStepsPrompt } from './providers/shared.js';
import { 
  authMiddleware, 
  getUserInfo, 
  updateUserPoints, 
  consumePoints, 
  rewardPoints,
  checkUserPoints 
} from './auth.js';

// 导入Supabase客户端
import { createClient } from '@supabase/supabase-js';

// Supabase配置 - 确保在Vercel环境中正确获取环境变量
const supabaseUrl = process.env.SUPABASE_URL || 'https://bqbtkaljxsmdcpedrerg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDg0NDUsImV4cCI6MjA3NDAyNDQ0NX0._XIcJcSg_00b_iOs90QM5GNaKAg5_LEHGDrexDTFcMQ';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODQ0ODQ0NSwiZXhwIjoyMDc0MDI0NDQ1fQ.2dPg9lY8I28Zqci9X2lM8hc5vseLFO9Komz0z_xzTvM';

// 验证环境变量是否存在
console.log('🔧 Supabase配置检查:', {
  SUPABASE_URL: !!supabaseUrl,
  SUPABASE_ANON_KEY: !!supabaseKey,
  SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey,
  usingFallback: !process.env.SUPABASE_URL
});

// 创建Supabase客户端
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const app = Fastify({ logger: true });
await app.register(cors, { 
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  }
});
// serve public files (for Vercel static hosting)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

app.get('/public/*', async (req, reply) => {
  const rel = req.params['*'];
  const p = path.join(publicDir, rel);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) {
    const ext = path.extname(p);
    const contentType = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif'
    }[ext] || 'text/plain';
    reply.type(contentType);
    return reply.send(fs.readFileSync(p));
  }
  return reply.code(404).send({ error: 'File not found' });
});

const jobs = new Map();
const feedbacks = [];
const now = () => new Date().toISOString();

// 解析AI返回的菜谱信息
function parseRecipeInfo(text) {
  const result = {
    dishName: '',
    ingredients: [],
    steps: []
  };
  
  // 提取菜品名称
  const dishNameMatch = text.match(/\*\*菜品名称：\*\*\s*(.+)/);
  if (dishNameMatch) {
    result.dishName = dishNameMatch[1].trim();
  }
  
  // 提取食材清单
  const ingredientsMatch = text.match(/\*\*主要食材：\*\*([\s\S]*?)\*\*烹饪步骤：\*\*/);
  if (ingredientsMatch) {
    const ingredientsText = ingredientsMatch[1];
    const ingredientLines = ingredientsText.split('\n').filter(line => line.trim().startsWith('-'));
    result.ingredients = ingredientLines.map(line => {
      const cleanLine = line.replace(/^-\s*/, '').trim();
      return {
        name: cleanLine,
        amount: '',
        preparation: ''
      };
    });
  }
  
  // 提取烹饪步骤
  const stepsMatch = text.match(/\*\*烹饪步骤：\*\*([\s\S]*?)$/);
  if (stepsMatch) {
    const stepsText = stepsMatch[1];
    const stepLines = stepsText.split('\n').filter(line => /^\d+\./.test(line.trim()));
    result.steps = stepLines.map(line => {
      // 移除步骤编号和多余的**符号
      let cleanLine = line.replace(/^\d+\.\s*/, '').trim();
      // 移除所有**符号
      cleanLine = cleanLine.replace(/\*\*/g, '');
      return cleanLine;
    });
  }
  
  // 如果没有找到结构化信息，尝试从原始文本中提取
  if (!result.dishName && !result.ingredients.length && !result.steps.length) {
    const lines = text.split('\n').filter(line => line.trim());
    result.steps = lines.filter(line => /^\d+\./.test(line.trim())).map(line => {
      // 移除步骤编号和多余的**符号
      let cleanLine = line.replace(/^\d+\.\s*/, '').trim();
      // 移除所有**符号
      cleanLine = cleanLine.replace(/\*\*/g, '');
      return cleanLine;
    });
    
    // 尝试从步骤中推断菜品名称
    const allText = text.toLowerCase();
    if (allText.includes('牛肉') && allText.includes('土豆')) {
      result.dishName = '土豆炖牛肉';
    } else if (allText.includes('鸡') && allText.includes('花生')) {
      result.dishName = '宫保鸡丁';
    } else if (allText.includes('排骨') && allText.includes('糖醋')) {
      result.dishName = '糖醋排骨';
    } else if (allText.includes('鱼') && allText.includes('酸菜')) {
      result.dishName = '酸菜鱼';
    } else if (allText.includes('鸡') && allText.includes('辣椒')) {
      result.dishName = '辣子鸡';
    } else if (allText.includes('豆腐') && allText.includes('麻婆')) {
      result.dishName = '麻婆豆腐';
    } else if (allText.includes('肉丝') && allText.includes('鱼香')) {
      result.dishName = '鱼香肉丝';
    } else if (allText.includes('鸡翅') && allText.includes('可乐')) {
      result.dishName = '可乐鸡翅';
    } else if (allText.includes('鸡翅') && allText.includes('红烧')) {
      result.dishName = '红烧鸡翅';
    } else if (allText.includes('鱼') && allText.includes('红烧')) {
      result.dishName = '红烧鱼';
    } else if (allText.includes('鱼') && allText.includes('清蒸')) {
      result.dishName = '清蒸鱼';
    } else if (allText.includes('鸡') && allText.includes('白切')) {
      result.dishName = '白切鸡';
    } else if (allText.includes('鸡') && allText.includes('口水')) {
      result.dishName = '口水鸡';
    } else if (allText.includes('肉') && allText.includes('回锅')) {
      result.dishName = '回锅肉';
    } else if (allText.includes('鱼') && allText.includes('水煮')) {
      result.dishName = '水煮鱼';
    } else if (allText.includes('里脊') && allText.includes('糖醋')) {
      result.dishName = '糖醋里脊';
    } else if (allText.includes('肉') && allText.includes('红烧')) {
      result.dishName = '红烧肉';
    } else if (allText.includes('土豆') && allText.includes('茄子') && allText.includes('青椒')) {
      result.dishName = '地三鲜';
    } else {
      result.dishName = '识别菜品';
    }
  }
  
  return result;
}

async function processJob(jobId) {
  console.log('🚀 开始处理任务:', jobId);
  const job = jobs.get(jobId);
  if (!job) {
    console.log('❌ 任务不存在:', jobId);
    return;
  }
  job.status = 'running';
  console.log('📋 任务状态更新为running');
  try {
    // Step 1: Doubao for steps (try uploaded image first, fallback to base64)
    let imageUrl = job.inputImageUrl;
    let stepsText;
    
    // Convert image to base64 format for API call
    console.log('🔄 开始处理图片，转换为base64格式...');
    console.log('图片URL:', imageUrl);
    
    try {
      let dataUrl;
      
      // 检查是否是base64格式（data:开头）
      if (imageUrl.startsWith('data:')) {
        console.log('检测到base64格式图片，直接使用');
        dataUrl = imageUrl;
      } else {
        // 从Supabase Storage下载图片
        console.log('从URL下载图片...');
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        
        const imageBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString('base64');
        const mimeType = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';
        dataUrl = `data:${mimeType};base64,${base64}`;
        console.log('✅ 图片已转换为base64，大小:', imageBuffer.byteLength, 'bytes');
      }
      
      console.log('📤 调用Doubao API...');
      stepsText = await generateRecipeSteps({
        imageUrl: dataUrl,
        prompt: buildStepsPrompt()
      });
      console.log('✅ Doubao API调用成功，返回结果长度:', stepsText.length);
    } catch (error) {
      console.error('图片处理失败:', error);
      throw new Error(`Image processing failed: ${error.message}`);
    }
    // 解析AI返回的完整信息
    const parsedInfo = parseRecipeInfo(stepsText);
    console.log('解析的菜谱信息:', parsedInfo);
    job.recipe = job.recipe || { ingredients: [], steps: [], locale: 'zh-CN' };
    job.recipe.name = parsedInfo.dishName;
    job.recipe.ingredients = parsedInfo.ingredients;
    job.recipe.steps = parsedInfo.steps;
    console.log('最终菜谱数据:', job.recipe);

    // Step 2: SeeDream image
    // 使用原始上传的图片，不再生成食材分析图
    job.ingredientFlatlayUrl = imageUrl;

    // 检查是否有有效的菜谱信息
    const hasValidRecipe = job.recipe?.steps?.length > 0;
    job.status = hasValidRecipe ? 'succeeded' : 'partial';
    job.completedAt = now();
    
    // AI分析完成后扣除积分
    if (job.userId && (job.status === 'succeeded' || job.status === 'partial')) {
      console.log('💰 开始扣除积分，用户ID:', job.userId);
      try {
        const consumeResult = await consumePoints(job.userId, 10);
        if (consumeResult.success) {
          console.log('✅ 积分扣除成功，剩余积分:', consumeResult.newPoints);
          job.pointsDeducted = 10;
          job.remainingPoints = consumeResult.newPoints;
        } else {
          console.error('❌ 积分扣除失败:', consumeResult.error);
          job.pointsDeductionError = consumeResult.error;
        }
      } catch (error) {
        console.error('❌ 积分扣除异常:', error);
        job.pointsDeductionError = error.message;
      }
    }
  } catch (err) {
    app.log.error({ err }, 'job failed');
    job.status = job.recipe?.steps?.length ? 'partial' : 'failed';
    job.error = { code: 'PROCESS_ERROR', message: String(err?.message || err) };
  }
}

app.post('/jobs', { preHandler: authMiddleware }, async (req, reply) => {
  // 检查用户积分是否足够
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
    const fname = `in_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    console.log('开始处理文件:', fname, '扩展名:', ext, 'MIME类型:', file.mimetype);

    // 获取文件buffer
    const fileBuffer = await file.toBuffer();
    console.log('文件buffer大小:', fileBuffer.length);

    // 直接转换为base64，不依赖Supabase Storage（避免Vercel环境问题）
    console.log('转换为base64格式...');
    const base64 = fileBuffer.toString('base64');
    const mimeType = file.mimetype || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log('✅ 图片已转换为base64，大小:', fileBuffer.length, 'bytes');
    console.log('📤 准备创建任务...');

    const jobId = 'job_' + nanoid(8);
    const job = {
      id: jobId,
      status: 'queued',
      inputImageUrl: dataUrl, // 直接使用base64 data URL
      userId: req.user.id, // 记录用户ID用于积分扣除
      userPointsBeforeJob: pointsCheck.currentPoints, // 记录任务开始前的积分
      createdAt: now()
    };

    console.log('创建任务:', jobId, '用户ID:', req.user.id);
    jobs.set(jobId, job);
    processJob(jobId).catch(() => {});

    return reply.code(201).send({
      id: jobId,
      status: job.status,
      createdAt: job.createdAt,
      userPoints: pointsCheck.currentPoints,
      message: '任务已创建，将消耗10积分进行AI分析'
    });
  } catch (error) {
    console.error('文件处理错误:', error);
    return reply.code(500).send({ error: '图片处理失败，请重试' });
  }
});

app.get('/jobs/:id', async (req, reply) => {
  const job = jobs.get(req.params.id);
  if (!job) return reply.code(404).send({ error: 'not found' });
  return job;
});

app.post('/feedback', async (req, reply) => {
  const body = await req.body;
  if (!body?.jobId || !body?.rating) return reply.code(400).send({ error: 'jobId and rating are required' });
  feedbacks.push({ ...body, createdAt: now() });
  return reply.code(204).send();
});

// 认证相关API端点

// 简化的注册API
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

    // 检查用户名是否已存在
    const { data: existingUser } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return reply.code(400).send({ error: '用户名已存在' });
    }

    // 创建用户（使用简化的邮箱格式）
    const email = `${username}@cookapp.local`;
    
    // 使用普通注册方式，然后手动确认
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

    // 创建用户资料，确保用户名正确设置
    let finalUsername = username;
    console.log('开始创建用户资料，用户名:', finalUsername);
    
    // 先尝试插入用户资料
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: userId,
        username: finalUsername,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('创建用户资料失败:', profileError);
      // 如果用户名冲突，生成新用户名
      if (profileError.code === '23505' || profileError.message.includes('duplicate key') || profileError.message.includes('unique')) {
        finalUsername = `${username}_${Date.now()}`;
        const { error: retryError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            user_id: userId,
            username: finalUsername,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (retryError) {
          console.error('重试创建用户资料也失败:', retryError);
          // 继续执行，不阻断注册流程
        }
      }
    }

    // 创建积分记录（新用户奖励100积分）
    console.log('开始创建积分记录，用户ID:', userId);

    // 先尝试查询是否已存在积分记录
    const { data: existingPoints } = await supabaseAdmin
      .from('user_points')
      .select('points')
      .eq('user_id', userId)
      .single();

    if (existingPoints) {
      console.log('用户已有积分记录:', existingPoints.points);
    } else {
      // 使用upsert确保积分记录创建成功（兼容新旧数据库）
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
        // 尝试直接插入作为备选方案
        const { error: insertError } = await supabaseAdmin
          .from('user_points')
          .insert({
            user_id: userId,
            points: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('插入积分记录也失败:', insertError);
          // 返回错误，不继续注册流程
          return reply.code(500).send({ error: '积分系统故障，请稍后重试' });
        }
      }
      console.log('✅ 积分记录创建成功');
    }

    // 验证积分记录是否创建成功
    console.log('开始验证积分记录，用户ID:', userId);
    const { data: verifyPoints, error: verifyError } = await supabaseAdmin
      .from('user_points')
      .select('points, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    const actualPoints = verifyPoints && verifyPoints.length > 0 ? verifyPoints[0].points : 100;
    console.log('验证积分记录结果:', {
      userId,
      found: !!verifyPoints?.length,
      points: actualPoints,
      error: verifyError
    });

    if (!verifyPoints || verifyPoints.length === 0) {
      console.error('❌ 积分记录验证失败，尝试重新创建');
      const { error: recreateError } = await supabaseAdmin
        .from('user_points')
        .insert({
          user_id: userId,
          points: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (recreateError) {
        console.error('重新创建积分记录失败:', recreateError);
      }
    }

    // 验证用户资料是否创建成功
    console.log('开始验证用户资料，用户ID:', userId);
    const { data: verifyProfile, error: profileVerifyError } = await supabaseAdmin
      .from('user_profiles')
      .select('username, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    const displayUsername = verifyProfile && verifyProfile.length > 0 ? verifyProfile[0].username : finalUsername;
    console.log('验证用户资料结果:', {
      userId,
      found: !!verifyProfile?.length,
      username: displayUsername,
      error: profileVerifyError
    });

    console.log('✅ 注册流程完成，返回用户信息:', {
      userId,
      username: displayUsername,
      points: actualPoints
    });

    return reply.send({
      success: true,
      userId: userId,
      username: displayUsername,
      points: actualPoints,
      message: `注册成功！您获得了${actualPoints}积分奖励！`
    });

  } catch (error) {
    app.log.error({ err: error }, '注册失败');
    return reply.code(500).send({ error: '服务器错误' });
  }
});

// 简化的登录API
app.post('/auth/login', async (req, reply) => {
  try {
    const { username, password } = await req.body;
    
    if (!username || !password) {
      return reply.code(400).send({ error: '用户名和密码不能为空' });
    }

    // 使用简化的邮箱格式登录
    const email = `${username}@cookapp.local`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (authError) {
      return reply.code(401).send({ error: '用户名或密码错误' });
    }

    const userId = authData.user.id;
    console.log('登录验证的用户ID:', userId);

    // 获取用户资料
    const { data: profileData } = await supabaseAdmin
      .from('user_profiles')
      .select('username')
      .eq('user_id', userId)
      .single();

    // 获取用户积分
    const { data: pointsData } = await supabaseAdmin
      .from('user_points')
      .select('points')
      .eq('user_id', userId)
      .single();

    // 确定显示的用户名
    let displayUsername = profileData?.username || username;
    if (displayUsername === '用户' || !displayUsername) {
      displayUsername = username;
    }

    // 确定用户积分，如果没有积分记录则创建
    let userPoints = pointsData?.points;
    if (userPoints === undefined || userPoints === null) {
      console.log('用户没有积分记录，创建默认积分记录');
      // 使用upsert确保积分记录创建成功（兼容新旧数据库）
      const { error: createPointsError } = await supabaseAdmin
        .from('user_points')
        .upsert({
          user_id: userId,
          points: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (createPointsError) {
        console.error('创建积分记录失败:', createPointsError);
        // 尝试直接插入作为备选方案
        const { error: insertError } = await supabaseAdmin
          .from('user_points')
          .insert({
            user_id: userId,
            points: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('插入积分记录也失败:', insertError);
        }
      }

      userPoints = 100; // 默认积分
    }

    console.log('登录成功:', { userId, displayUsername, userPoints });

    return reply.send({
      success: true,
      userId: userId,
      username: displayUsername,
      points: userPoints,
      token: authData.session.access_token,
      message: `登录成功！当前积分：${userPoints}`
    });

  } catch (error) {
    app.log.error({ err: error }, '登录失败');
    return reply.code(500).send({ error: '服务器错误' });
  }
});

// 简化的退出API
app.post('/auth/logout', async (req, reply) => {
  try {
    // 这里可以添加清理逻辑，比如清除会话等
    return reply.send({ success: true, message: '已退出登录' });
  } catch (error) {
    app.log.error({ err: error }, '退出登录失败');
    return reply.code(500).send({ error: '服务器错误' });
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
    console.error('获取用户信息异常:', error);
    app.log.error({ err: error }, '获取用户信息失败');
    return reply.code(500).send({ error: '服务器错误', details: error.message });
  }
});

// 更新用户积分
app.post('/auth/points', { preHandler: authMiddleware }, async (req, reply) => {
  try {
    const { points } = await req.body;
    if (typeof points !== 'number') {
      return reply.code(400).send({ error: '积分必须是数字' });
    }

    const result = await updateUserPoints(req.user.id, points);
    if (!result.success) {
      return reply.code(500).send({ error: '更新积分失败' });
    }

    return reply.send({
      success: true,
      newPoints: result.newPoints
    });
  } catch (error) {
    app.log.error({ err: error }, '更新积分失败');
    return reply.code(500).send({ error: '服务器错误' });
  }
});

// 消费积分
app.post('/auth/consume-points', { preHandler: authMiddleware }, async (req, reply) => {
  try {
    const { points } = await req.body;
    if (typeof points !== 'number' || points <= 0) {
      return reply.code(400).send({ error: '积分必须是正数' });
    }

    const result = await consumePoints(req.user.id, points);
    if (!result.success) {
      return reply.code(400).send({ 
        error: result.error,
        currentPoints: result.currentPoints 
      });
    }

    return reply.send({
      success: true,
      newPoints: result.newPoints,
      consumedPoints: result.consumedPoints
    });
  } catch (error) {
    app.log.error({ err: error }, '消费积分失败');
    return reply.code(500).send({ error: '服务器错误' });
  }
});

// 奖励积分
app.post('/auth/reward-points', { preHandler: authMiddleware }, async (req, reply) => {
  try {
    const { points } = await req.body;
    if (typeof points !== 'number' || points <= 0) {
      return reply.code(400).send({ error: '积分必须是正数' });
    }

    const result = await rewardPoints(req.user.id, points);
    if (!result.success) {
      return reply.code(500).send({ error: '奖励积分失败' });
    }

    return reply.send({
      success: true,
      newPoints: result.newPoints,
      rewardedPoints: result.rewardedPoints
    });
  } catch (error) {
    app.log.error({ err: error }, '奖励积分失败');
    return reply.code(500).send({ error: '服务器错误' });
  }
});

// 检查积分是否足够
app.post('/auth/check-points', { preHandler: authMiddleware }, async (req, reply) => {
  try {
    const { requiredPoints } = await req.body;
    if (typeof requiredPoints !== 'number' || requiredPoints < 0) {
      return reply.code(400).send({ error: '所需积分必须是非负数' });
    }

    const result = await checkUserPoints(req.user.id, requiredPoints);
    if (result.error) {
      return reply.code(500).send({ error: '检查积分失败' });
    }

    return reply.send({
      hasEnough: result.hasEnough,
      currentPoints: result.currentPoints,
      requiredPoints
    });
  } catch (error) {
    app.log.error({ err: error }, '检查积分失败');
    return reply.code(500).send({ error: '服务器错误' });
  }
});

// 添加健康检查端点
app.get('/health', async (req, reply) => {
  return reply.send({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// 测试Supabase连接和数据库操作
app.get('/test-supabase', async (req, reply) => {
  try {
    console.log('🧪 开始测试Supabase连接...');
    
    // 测试1: 检查Supabase客户端
    console.log('测试1: Supabase客户端配置');
    const configTest = {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
      supabaseServiceKey: !!supabaseServiceKey
    };
    console.log('配置检查结果:', configTest);
    
    // 测试2: 测试数据库连接
    console.log('测试2: 数据库连接测试');
    const { data: testData, error: testError } = await supabaseAdmin
      .from('user_points')
      .select('count')
      .limit(1);
    
    console.log('数据库连接测试结果:', { testData, testError });
    
    // 测试3: 测试用户表连接
    console.log('测试3: 用户表连接测试');
    const { data: profileTest, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('count')
      .limit(1);
    
    console.log('用户表连接测试结果:', { profileTest, profileError });
    
    return reply.send({
      status: 'ok',
      config: configTest,
      databaseTest: { success: !testError, error: testError?.message },
      profileTest: { success: !profileError, error: profileError?.message },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Supabase测试失败:', error);
    return reply.code(500).send({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 测试积分创建功能
app.post('/test-create-points', async (req, reply) => {
  try {
    const { userId } = await req.body;
    
    if (!userId) {
      return reply.code(400).send({ error: 'userId is required' });
    }
    
    console.log('🧪 测试积分创建，用户ID:', userId);
    
    // 尝试创建积分记录
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('user_points')
      .insert({
        user_id: userId,
        points: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    console.log('积分创建结果:', { insertData, insertError });
    
    // 验证积分记录
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    console.log('积分验证结果:', { verifyData, verifyError });
    
    return reply.send({
      status: 'ok',
      insertResult: { success: !insertError, error: insertError?.message, data: insertData },
      verifyResult: { success: !verifyError, error: verifyError?.message, data: verifyData },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('积分创建测试失败:', error);
    return reply.code(500).send({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 测试图片上传功能
app.post('/test-upload', async (req, reply) => {
  try {
    console.log('🧪 开始测试图片上传功能...');
    
    const file = await req.file();
    if (!file) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }
    
    console.log('📁 文件信息:', {
      filename: file.filename,
      mimetype: file.mimetype,
      encoding: file.encoding,
      fieldname: file.fieldname
    });
    
    // 获取文件buffer
    const fileBuffer = await file.toBuffer();
    console.log('📊 文件大小:', fileBuffer.length, 'bytes');
    
    // 转换为base64
    const base64 = fileBuffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    console.log('✅ 文件处理成功');
    console.log('Base64长度:', base64.length);
    console.log('Data URL长度:', dataUrl.length);
    
    return reply.send({
      status: 'ok',
      fileInfo: {
        filename: file.filename,
        mimetype: file.mimetype,
        size: fileBuffer.length,
        base64Length: base64.length,
        dataUrlLength: dataUrl.length
      },
      message: '图片上传测试成功',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('图片上传测试失败:', error);
    return reply.code(500).send({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 添加根路径健康检查（Railway兼容性）
app.get('/', async (req, reply) => {
  return reply.send({ 
    status: 'ok', 
    service: 'cook-assistant-api',
    timestamp: new Date().toISOString() 
  });
});

// 测试数据库连接
async function testDatabaseConnection() {
  try {
    app.log.info('🔍 Testing database connection...');
    const { data, error } = await supabaseAdmin
      .from('user_points')
      .select('count')
      .limit(1);
    
    if (error) {
      app.log.error({ error }, 'Database connection failed');
      return false;
    }
    
    app.log.info('✅ Database connection successful');
    return true;
  } catch (err) {
    app.log.error({ err }, 'Database connection test failed');
    return false;
  }
}

const port = process.env.PORT || 8787;

// 启动服务器
async function startServer() {
  try {
    // 测试数据库连接
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      app.log.warn('⚠️ Database connection failed, but continuing startup...');
    }
    
    // 启动HTTP服务器
    await app.listen({ port, host: '0.0.0.0' });
    
    app.log.info(`🚀 API listening on http://0.0.0.0:${port}`);
    app.log.info(`📊 Health check available at http://0.0.0.0:${port}/health`);
    app.log.info(`🔗 Root endpoint available at http://0.0.0.0:${port}/`);
    
    // 发送启动完成信号
    if (process.send) {
      process.send('ready');
    }
    
  } catch (err) {
    app.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// 导出Fastify应用给Vercel使用
export default app;


