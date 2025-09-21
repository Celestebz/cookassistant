#!/usr/bin/env node

/**
 * 快速修复积分系统
 * 为现有用户手动添加积分记录
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase配置
const supabaseUrl = 'https://bqbtkaljxsmdcpedrerg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDg0NDUsImV4cCI6MjA3NDAyNDQ0NX0._XIcJcSg_00b_iOs90QM5GNaKAg5_LEHGDrexDTFcMQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function quickFixPoints() {
  console.log('🔧 开始修复积分系统...');
  
  try {
    // 1. 检查现有用户
    console.log('📋 检查现有用户...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ 无法获取用户列表:', usersError);
      return;
    }
    
    console.log(`👥 找到 ${users.users.length} 个用户`);
    
    // 2. 检查数据库表是否存在
    console.log('🗄️ 检查数据库表...');
    const { data: pointsData, error: pointsError } = await supabase
      .from('user_points')
      .select('*')
      .limit(1);
    
    if (pointsError) {
      console.error('❌ user_points表不存在或无法访问:', pointsError);
      console.log('💡 请先在Supabase控制台执行 fix_points_system.sql 文件');
      return;
    }
    
    console.log('✅ 数据库表存在');
    
    // 3. 为每个用户检查并创建积分记录
    for (const user of users.users) {
      console.log(`👤 处理用户: ${user.email || user.id}`);
      
      // 检查是否已有积分记录
      const { data: existingPoints, error: checkError } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`❌ 检查用户 ${user.email} 积分失败:`, checkError);
        continue;
      }
      
      if (existingPoints) {
        console.log(`✅ 用户 ${user.email} 已有积分: ${existingPoints.points}`);
        continue;
      }
      
      // 创建积分记录
      const { data: newPoints, error: createError } = await supabase
        .from('user_points')
        .insert({
          user_id: user.id,
          points: 100
        })
        .select();
      
      if (createError) {
        console.error(`❌ 为用户 ${user.email} 创建积分失败:`, createError);
        continue;
      }
      
      console.log(`✅ 为用户 ${user.email} 创建积分记录: 100积分`);
      
      // 创建用户资料记录
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          username: user.user_metadata?.username || `user_${user.id.substring(0, 8)}`
        })
        .select();
      
      if (profileError) {
        console.error(`❌ 为用户 ${user.email} 创建资料失败:`, profileError);
      } else {
        console.log(`✅ 为用户 ${user.email} 创建资料记录`);
      }
    }
    
    console.log('🎉 积分系统修复完成！');
    console.log('💡 现在请刷新浏览器页面，重新登录查看积分');
    
  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error);
  }
}

// 运行修复
quickFixPoints();
