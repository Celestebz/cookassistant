// 快速修复用户积分系统
import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = 'https://bqbtkaljxsmdcpedrerg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDg0NDUsImV4cCI6MjA3NDAyNDQ0NX0._XIcJcSg_00b_iOs90QM5GNaKAg5_LEHGDrexDTFcMQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUserPoints() {
  console.log('🔧 开始修复用户积分系统...');
  
  try {
    // 1. 获取所有用户
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ 获取用户列表失败:', usersError);
      return;
    }
    
    console.log(`📊 找到 ${users.users.length} 个用户`);
    
    // 2. 为每个用户检查和修复积分
    for (const user of users.users) {
      const userId = user.id;
      console.log(`👤 处理用户: ${userId}`);
      
      // 检查用户是否有积分记录
      const { data: existingPoints, error: pointsError } = await supabase
        .from('user_points')
        .select('points')
        .eq('user_id', userId)
        .single();
      
      if (pointsError && !pointsError.message.includes('No rows found')) {
        console.error(`❌ 检查用户 ${userId} 积分失败:`, pointsError);
        continue;
      }
      
      if (!existingPoints) {
        // 用户没有积分记录，创建新记录
        console.log(`💰 为用户 ${userId} 创建积分记录...`);
        
        const { error: insertError } = await supabase
          .from('user_points')
          .insert({
            user_id: userId,
            points: 100
          });
        
        if (insertError) {
          console.error(`❌ 创建积分记录失败:`, insertError);
        } else {
          console.log(`✅ 用户 ${userId} 积分记录创建成功`);
        }
      } else {
        console.log(`ℹ️ 用户 ${userId} 已有积分记录: ${existingPoints.points} 积分`);
      }
      
      // 检查用户资料
      const { data: existingProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('user_id', userId)
        .single();
      
      if (profileError && !profileError.message.includes('No rows found')) {
        console.error(`❌ 检查用户 ${userId} 资料失败:`, profileError);
        continue;
      }
      
      if (!existingProfile) {
        // 用户没有资料记录，创建新记录
        console.log(`👤 为用户 ${userId} 创建资料记录...`);
        
        const username = user.user_metadata?.username || user.email?.split('@')[0] || '用户';
        
        const { error: insertProfileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: userId,
            username: username
          });
        
        if (insertProfileError) {
          console.error(`❌ 创建用户资料失败:`, insertProfileError);
        } else {
          console.log(`✅ 用户 ${userId} 资料记录创建成功`);
        }
      } else {
        console.log(`ℹ️ 用户 ${userId} 已有资料记录: ${existingProfile.username}`);
      }
    }
    
    console.log('🎉 用户积分系统修复完成！');
    
    // 3. 验证修复结果
    const { data: allPoints, error: verifyError } = await supabase
      .from('user_points')
      .select('user_id, points');
    
    if (verifyError) {
      console.error('❌ 验证失败:', verifyError);
    } else {
      console.log('📊 修复结果统计:');
      console.log(`- 总用户数: ${users.users.length}`);
      console.log(`- 积分记录数: ${allPoints.length}`);
      console.log('- 积分分布:');
      allPoints.forEach(point => {
        console.log(`  - 用户 ${point.user_id}: ${point.points} 积分`);
      });
    }
    
  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error);
  }
}

// 运行修复
fixUserPoints();