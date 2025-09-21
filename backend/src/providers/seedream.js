import { fetch } from 'undici';
import { withRetry } from './shared.js';

const SEEDREAM_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

export async function generateFlatlayImage({ prompt, watermark = true, size = '2K' }) {
  const apiKey = process.env.SEEDREAM_API_KEY || '6615f2f3-c3e3-412a-84ba-da09f2447ff5';
  
  const body = {
    model: 'ep-20250921090735-cxcrh',
    prompt: prompt,
    sequential_image_generation: 'disabled',
    response_format: 'url',
    size: size,
    stream: false,
    watermark: watermark
  };

  try {
    const res = await withRetry(() => fetch(SEEDREAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    }), { retries: 1, delayMs: 1000 });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Seedream error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.data?.[0]?.url || 'https://via.placeholder.com/800x600/4CAF50/white?text=Generated+Flatlay+Image';
  } catch (error) {
    console.error('Seedream API error:', error);
    // 返回占位符图片作为fallback
    return 'https://via.placeholder.com/800x600/4CAF50/white?text=Generated+Flatlay+Image';
  }
}





