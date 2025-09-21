const fetch = require('node-fetch');

async function testDoubaoAPI() {
  try {
    console.log('开始测试Doubao API调用...');
    
    // 测试API调用
    const response = await fetch('http://localhost:8787/jobs', {
      method: 'POST',
      body: new FormData()
    });
    
    if (!response.ok) {
      throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API响应:', data);
    
    // 检查是否是模拟数据
    if (data.recipe && data.recipe.steps) {
      const firstStep = data.recipe.steps[0];
      if (firstStep.includes('请根据图片中的菜品特点')) {
        console.log('⚠️  警告：返回的是模拟数据，不是真实的AI识别结果');
        console.log('API密钥可能未正确设置');
      } else {
        console.log('✅ 返回的是真实的AI识别结果');
        console.log('Doubao API调用成功');
      }
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testDoubaoAPI();
