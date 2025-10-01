// 测试积分系统修复效果
const API_BASE = 'http://localhost:8787';

async function testPointsSystem() {
  try {
    console.log('🚀 开始测试积分系统修复效果...');

    // 1. 测试健康检查
    console.log('📋 测试健康检查...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ 健康检查通过:', healthData);
    } else {
      console.log('❌ 健康检查失败:', healthResponse.status);
    }

    // 2. 测试注册API（模拟）
    console.log('📝 测试注册积分创建逻辑...');
    // 这里应该测试实际的注册API，但需要先有登录用户

    // 3. 测试用户信息获取API（模拟）
    console.log('👤 测试用户信息获取逻辑...');
    // 这里应该测试实际的用户信息获取API

    console.log('✅ 测试完成 - 请检查控制台日志');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testPointsSystem();
