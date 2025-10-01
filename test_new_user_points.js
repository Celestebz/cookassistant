// 测试新用户注册积分功能
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:8787';

async function testNewUserRegistration() {
  console.log('🧪 开始测试新用户注册积分功能...');
  
  try {
    // 1. 测试注册新用户
    const testUsername = `testuser_${Date.now()}`;
    const testPassword = '123456';
    
    console.log(`📝 注册新用户: ${testUsername}`);
    
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword
      })
    });
    
    const registerResult = await registerResponse.json();
    console.log('注册结果:', registerResult);
    
    if (!registerResult.success) {
      console.error('❌ 注册失败:', registerResult.error);
      return;
    }
    
    console.log(`✅ 注册成功！用户ID: ${registerResult.userId}`);
    console.log(`💰 获得积分: ${registerResult.points}`);
    
    // 2. 测试登录
    console.log('🔐 测试登录...');
    
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: testUsername,
        password: testPassword
      })
    });
    
    const loginResult = await loginResponse.json();
    console.log('登录结果:', loginResult);
    
    if (!loginResult.success) {
      console.error('❌ 登录失败:', loginResult.error);
      return;
    }
    
    console.log(`✅ 登录成功！当前积分: ${loginResult.points}`);
    
    // 3. 测试获取用户信息
    console.log('👤 测试获取用户信息...');
    
    const userInfoResponse = await fetch(`${API_BASE}/auth/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginResult.token || 'test-token'}`,
        'Content-Type': 'application/json'
      }
    });
    
    const userInfoResult = await userInfoResponse.json();
    console.log('用户信息:', userInfoResult);
    
    // 4. 测试积分消费
    console.log('💸 测试积分消费...');
    
    const consumeResponse = await fetch(`${API_BASE}/auth/consume-points`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loginResult.token || 'test-token'}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        points: 10
      })
    });
    
    const consumeResult = await consumeResponse.json();
    console.log('消费积分结果:', consumeResult);
    
    if (consumeResult.success) {
      console.log(`✅ 积分消费成功！剩余积分: ${consumeResult.newPoints}`);
    } else {
      console.log(`ℹ️ 积分消费结果: ${consumeResult.error || '需要认证'}`);
    }
    
    console.log('🎉 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testNewUserRegistration();