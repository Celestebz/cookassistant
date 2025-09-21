import { fetch } from 'undici';
import { withRetry } from './shared.js';

const DOUBAO_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

export async function generateRecipeSteps({ imageUrl, prompt, model = 'ep-20250921085349-k25sf', temperature = 0.3 }) {
  const apiKey = process.env.DOUBAO_API_KEY || '3dafef81-fdc1-4148-bb39-87c396f94c2a';
  if (!apiKey || apiKey === 'your_doubao_api_key_here' || apiKey === 'test_key_for_demo') {
    // 返回模拟的烹饪步骤用于演示
    return `1. 准备食材：鸡肉切丁，花生米炸脆备用
2. 调制宫保汁：生抽、老抽、料酒、糖、醋调匀
3. 热锅下油，爆炒鸡丁至变色
4. 加入干辣椒和花椒炒香
5. 倒入宫保汁翻炒均匀
6. 最后加入花生米和葱花即可`;
  }
  const body = {
    model,
    temperature,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: prompt }
        ]
      }
    ]
  };
  const res = await withRetry(() => fetch(DOUBAO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  }), { retries: 1, delayMs: 600 });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Doubao error ${res.status}: ${text}`);
  }
  const data = await res.json();
  // Extract text; handle both string content and array of segments
  let text = '';
  const msg = data?.choices?.[0]?.message?.content;
  if (typeof msg === 'string') {
    text = msg;
  } else if (Array.isArray(msg)) {
    text = msg.map(seg => typeof seg === 'string' ? seg : (seg?.text || '')).join('\n').trim();
  } else if (data?.choices?.[0]?.message?.content?.text) {
    text = data.choices[0].message.content.text;
  }
  if (!text) throw new Error('Doubao: empty response');
  return text;
}


