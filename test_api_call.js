const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function testApiCall() {
  try {
    console.log('开始测试API调用...');
    
    // 创建表单数据
    const form = new FormData();
    form.append('image', fs.createReadStream('/Users/celeste/Documents/04 AIGC/coding/cook/uploads/in_1758201001003_t4hw2ch462p.jpeg'));
    
    // 上传图片
    console.log('上传图片...');
    const uploadResponse = await fetch('http://localhost:8787/jobs', {
      method: 'POST',
      body: form
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`上传失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
    
    const uploadData = await uploadResponse.json();
    const jobId = uploadData.id;
    console.log('任务ID:', jobId);
    
    // 轮询任务状态
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      console.log(`轮询第 ${attempts + 1} 次...`);
      
      const statusResponse = await fetch(`http://localhost:8787/jobs/${jobId}`);
      if (!statusResponse.ok) {
        throw new Error(`查询失败: ${statusResponse.status} ${statusResponse.statusText}`);
      }
      
      const job = await statusResponse.json();
      console.log('任务状态:', job.status);
      
      if (job.status === 'succeeded' || job.status === 'partial' || job.status === 'failed') {
        console.log('任务完成！');
        console.log('菜谱数据:', JSON.stringify(job.recipe, null, 2));
        
        // 检查是否是真实数据还是模拟数据
        if (job.recipe && job.recipe.steps) {
          const firstStep = job.recipe.steps[0];
          if (firstStep.includes('请根据图片中的菜品特点')) {
            console.log('⚠️  警告：返回的是模拟数据，不是真实的AI识别结果');
          } else {
            console.log('✅ 返回的是真实的AI识别结果');
          }
        }
        
        return job;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('轮询超时');
    
  } catch (error) {
    console.error('测试失败:', error);
    throw error;
  }
}

testApiCall().then(result => {
  console.log('测试成功！');
  console.log('最终结果:', JSON.stringify(result, null, 2));
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});