import fetch from 'node-fetch';

async function testDoubaoImageAPI() {
  const apiKey = '3dafef81-fdc1-4148-bb39-87c396f94c2a';
  const endpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  const imageUrl = 'http://localhost:8787/uploads/in_1758201001003_t4hw2ch462p.jpeg';

  const body = {
    model: 'ep-20250921085349-k25sf',
    temperature: 0.3,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: '你是一名专业中餐厨师与美食编辑。请仔细观察图片中的成品菜，按以下格式输出完整信息：\n\n**菜品名称：** [识别出的菜品名称]\n\n**主要食材：**\n- [食材1] [用量]\n- [食材2] [用量]\n- [食材3] [用量]\n- ...\n\n**烹饪步骤：**\n1. [第一步详细描述]\n2. [第二步详细描述]\n3. [第三步详细描述]\n4. [第四步详细描述]\n\n要求：\n- 准确识别菜品名称和主要食材\n- 食材用量用公制单位（克、毫升、汤匙、茶匙、个）\n- 烹饪步骤3-8条，与图片菜品完全匹配\n- 用家庭厨具与常见食材表达，语气简洁\n- 强调关键火候与时长\n- 确保步骤能做出图片中相同的菜品' }
        ]
      }
    ]
  };

  console.log('测试图片API调用...');
  console.log('API密钥:', apiKey);
  console.log('端点:', endpoint);
  console.log('图片URL:', imageUrl);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    
    console.log('响应状态:', response.status, response.statusText);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('错误响应:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('响应数据:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('错误:', err.message);
    console.error('错误堆栈:', err.stack);
  }
}

testDoubaoImageAPI();
