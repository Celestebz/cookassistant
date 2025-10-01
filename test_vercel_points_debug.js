#!/usr/bin/env node

// 测试Vercel积分系统问题
const API_BASE = 'https://cookassistant.vercel.app';

async function testVercelPointsSystem() {
  console.log('🔍 开始测试Vercel积分系统...');
  
  try {
    // 1. 测试健康检查
    console.log('\n1. 测试健康检查...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    console.log('健康检查结果:', healthData);
    
    // 2. 测试Supabase连接
    console.log('\n2. 测试Supabase连接...');
    const supabaseResponse = await fetch(`${API_BASE}/test-supabase`);
    const supabaseData = await supabaseResponse.json();
    console.log('Supabase连接结果:', supabaseData);
    
    // 3. 测试注册功能
    console.log('\n3. 测试注册功能...');
    const testUsername = `testuser_${Date.now()}`;
    const testPassword = 'testpass123';
    
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
    
    const registerData = await registerResponse.json();
    console.log('注册结果:', {
      status: registerResponse.status,
      data: registerData
    });
    
    if (registerResponse.ok && registerData.token) {
      // 4. 测试登录功能
      console.log('\n4. 测试登录功能...');
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
      
      const loginData = await loginResponse.json();
      console.log('登录结果:', {
        status: loginResponse.status,
        data: loginData
      });
      
      if (loginResponse.ok && loginData.token) {
        // 5. 测试获取用户信息
        console.log('\n5. 测试获取用户信息...');
        const userResponse = await fetch(`${API_BASE}/auth/user`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${loginData.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const userData = await userResponse.json();
        console.log('用户信息结果:', {
          status: userResponse.status,
          data: userData
        });
        
        // 6. 测试积分检查
        console.log('\n6. 测试积分检查...');
        const pointsResponse = await fetch(`${API_BASE}/auth/check-points`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${loginData.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const pointsData = await pointsResponse.json();
        console.log('积分检查结果:', {
          status: pointsResponse.status,
          data: pointsData
        });
        
        // 7. 测试创建积分记录
        console.log('\n7. 测试创建积分记录...');
        const createPointsResponse = await fetch(`${API_BASE}/test-create-points`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loginData.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: loginData.userId
          })
        });
        
        const createPointsData = await createPointsResponse.json();
        console.log('创建积分记录结果:', {
          status: createPointsResponse.status,
          data: createPointsData
        });
      }
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 运行测试
testVercelPointsSystem();
