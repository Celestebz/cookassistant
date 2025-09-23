// 测试新用户注册积分功能
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:8787';

async function testNewUserRegistration() {
    console.log('🧪 开始测试新用户注册积分功能...\n');
    
    // 生成随机用户名
    const randomUsername = `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const password = '123456';
    
    console.log(`📝 测试用户: ${randomUsername}`);
    
    try {
        // 1. 注册新用户
        console.log('1️⃣ 注册新用户...');
        const registerResponse = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: randomUsername,
                password: password
            })
        });
        
        const registerData = await registerResponse.json();
        console.log('注册响应:', registerData);
        
        if (registerResponse.ok) {
            console.log(`✅ 注册成功！获得积分: ${registerData.points}`);
            
            // 2. 验证积分是否正确
            if (registerData.points === 100) {
                console.log('🎉 积分奖励正确！新用户获得了100积分');
            } else {
                console.log(`❌ 积分不正确！期望100，实际${registerData.points}`);
            }
            
            // 3. 尝试登录验证
            console.log('\n2️⃣ 验证登录...');
            const loginResponse = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: randomUsername,
                    password: password
                })
            });
            
            const loginData = await loginResponse.json();
            console.log('登录响应:', loginData);
            
            if (loginResponse.ok) {
                console.log(`✅ 登录成功！用户积分: ${loginData.points}`);
                
                if (loginData.points === 100) {
                    console.log('🎉 登录后积分显示正确！');
                } else {
                    console.log(`❌ 登录后积分不正确！期望100，实际${loginData.points}`);
                }
            } else {
                console.log('❌ 登录失败:', loginData.error);
            }
            
        } else {
            console.log('❌ 注册失败:', registerData.error);
        }
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
    }
    
    console.log('\n🏁 测试完成');
}

// 运行测试
testNewUserRegistration();
