import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { generateRecipeSteps } from './providers/doubao.js';
import { generateFlatlayImage } from './providers/seedream.js';
import { buildStepsPrompt, buildFlatlayPrompt } from './providers/shared.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(multipart);
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
    job.recipe = job.recipe || { ingredients: [], steps: [], locale: 'zh-CN' };
    job.recipe.steps = stepsText.split(/\n+/).filter(Boolean).slice(0, 8);

    // Step 2: SeeDream image
    const prompt = buildFlatlayPrompt();
    let succeeded = true;
    try {
      const url = await generateFlatlayImage({ prompt, watermark: false, size: '2K' });
      job.ingredientFlatlayUrl = url;
    } catch (e) {
      succeeded = false;
      job.error = { code: 'IMAGE_ERROR', message: String(e?.message || e) };
    }

    job.status = succeeded ? 'succeeded' : 'partial';
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


