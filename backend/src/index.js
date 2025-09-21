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

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  }
});
// serve uploads statically
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.get('/uploads/*', async (req, reply) => {
  const rel = req.params['*'];
  const p = path.join(uploadsDir, rel);
  if (!p.startsWith(uploadsDir)) return reply.code(403).send();
  if (!fs.existsSync(p)) return reply.code(404).send();
  return reply.send(fs.createReadStream(p));
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
      return line.replace(/^\d+\.\s*/, '').trim();
    });
  }
  
  // 如果没有找到结构化信息，尝试从原始文本中提取
  if (!result.dishName && !result.ingredients.length && !result.steps.length) {
    const lines = text.split('\n').filter(line => line.trim());
    result.steps = lines.filter(line => /^\d+\./.test(line.trim())).map(line => 
      line.replace(/^\d+\.\s*/, '').trim()
    );
    
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
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'running';
  try {
    // Step 1: Doubao for steps (try uploaded image first, fallback to base64)
    let imageUrl = job.inputImageUrl;
    let stepsText;
    
    try {
      // First try with the uploaded image URL
      stepsText = await generateRecipeSteps({
        imageUrl: imageUrl,
        prompt: buildStepsPrompt()
      });
    } catch (urlError) {
      // If URL fails, try converting to base64 and using data URL
      try {
        const imagePath = path.join(uploadsDir, path.basename(imageUrl));
        if (fs.existsSync(imagePath)) {
          const imageBuffer = await fs.promises.readFile(imagePath);
          const base64 = imageBuffer.toString('base64');
          const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
          const dataUrl = `data:${mimeType};base64,${base64}`;
          
          stepsText = await generateRecipeSteps({
            imageUrl: dataUrl,
            prompt: buildStepsPrompt()
          });
        } else {
          throw new Error('Image file not found');
        }
      } catch (base64Error) {
        throw new Error(`Failed to process image: ${urlError.message} | ${base64Error.message}`);
      }
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
  } catch (err) {
    app.log.error({ err }, 'job failed');
    job.status = job.recipe?.steps?.length ? 'partial' : 'failed';
    job.error = { code: 'PROCESS_ERROR', message: String(err?.message || err) };
  }
}

app.post('/jobs', async (req, reply) => {
  const file = await req.file();
  if (!file) return reply.code(400).send({ error: 'image file is required' });
  const ext = (file.filename?.split('.').pop() || 'jpg').toLowerCase();
  const fname = `in_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const fpath = path.join(uploadsDir, fname);
  await fs.promises.writeFile(fpath, await file.toBuffer());
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.headers.host}`;
  const inputImageUrl = `${base}/uploads/${fname}`;
  const jobId = 'job_' + nanoid(8);
  const job = { id: jobId, status: 'queued', inputImageUrl, createdAt: now() };
  jobs.set(jobId, job);
  processJob(jobId).catch(() => {});
  return reply.code(201).send({ id: jobId, status: job.status, createdAt: job.createdAt });
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

const port = process.env.PORT || 8787;
app.listen({ port, host: '0.0.0.0' }).then(() => {
  app.log.info(`API listening on http://localhost:${port}`);
});


