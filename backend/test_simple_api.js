import fetch from 'node-fetch';

async function testSimpleAPI() {
  const apiKey = '3dafef81-fdc1-4148-bb39-87c396f94c2a';
  const endpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

  console.log('🧪 测试简单API调用...');
  console.log('API密钥:', apiKey);
  console.log('端点:', endpoint);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'ep-20250921085349-k25sf',
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: 'Hello, test message'
          }
        ]
      })
    });

    console.log('响应状态:', response.status, response.statusText);
    console.log('响应类型:', typeof response);
    console.log('响应对象:', response);

    if (response.ok) {
      const data = await response.json();
      console.log('响应数据:', data);
    } else {
      const errorText = await response.text();
      console.log('错误响应:', errorText);
    }
  } catch (error) {
    console.error('错误:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

testSimpleAPI();
