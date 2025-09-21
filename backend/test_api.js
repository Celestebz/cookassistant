import fetch from 'node-fetch';

async function testDoubaoAPI() {
  const apiKey = '3dafef81-fdc1-4148-bb39-87c396f94c2a';
  const endpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

  const body = {
    model: 'ep-20250921085349-k25sf',
    temperature: 0.3,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello, test message' }
        ]
      }
    ]
  };

  console.log('测试API调用...');
  console.log('API密钥:', apiKey);
  console.log('端点:', endpoint);
  
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
    const text = await response.text();
    console.log('响应内容:', text);
  } catch (err) {
    console.error('错误:', err.message);
  }
}

testDoubaoAPI();
