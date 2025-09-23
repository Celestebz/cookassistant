import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = process.env.SUPABASE_URL || 'https://bqbtkaljxsmdcpedrerg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDg0NDUsImV4cCI6MjA3NDAyNDQ0NX0._XIcJcSg_00b_iOs90QM5GNaKAg5_LEHGDrexDTFcMQ';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || supabaseKey;

// 创建Supabase客户端
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function initDatabase() {
  console.log('开始初始化数据库...');
  
  try {
    // 检查用户资料表
    console.log('检查用户资料表...');
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .limit(1);
    
    if (profilesError) {
      console.error('用户资料表查询失败:', profilesError);
    } else {
      console.log('用户资料表存在，记录数:', profiles?.length || 0);
    }
    
    // 检查积分表
    console.log('检查积分表...');
    const { data: points, error: pointsError } = await supabaseAdmin
      .from('user_points')
      .select('*')
      .limit(1);
    
    if (pointsError) {
      console.error('积分表查询失败:', pointsError);
    } else {
      console.log('积分表存在，记录数:', points?.length || 0);
    }
    
    // 测试插入数据
    console.log('测试插入数据...');
    const testUserId = 'test-user-' + Date.now();
    
    // 插入用户资料
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: testUserId,
        username: 'testuser'
      });
    
    if (profileError) {
      console.error('插入用户资料失败:', profileError);
    } else {
      console.log('插入用户资料成功');
    }
    
    // 插入积分记录
    const { data: pointsData, error: pointsInsertError } = await supabaseAdmin
      .from('user_points')
      .insert({
        user_id: testUserId,
        points: 100
      });
    
    if (pointsInsertError) {
      console.error('插入积分记录失败:', pointsInsertError);
    } else {
      console.log('插入积分记录成功');
    }
    
    // 测试查询
    console.log('测试查询数据...');
    const { data: testProfile, error: testProfileError } = await supabaseAdmin
      .from('user_profiles')
      .select('username')
      .eq('user_id', testUserId)
      .single();
    
    const { data: testPoints, error: testPointsError } = await supabaseAdmin
      .from('user_points')
      .select('points')
      .eq('user_id', testUserId)
      .single();
    
    console.log('查询结果:', {
      profile: { data: testProfile, error: testProfileError },
      points: { data: testPoints, error: testPointsError }
    });
    
    // 清理测试数据
    await supabaseAdmin.from('user_profiles').delete().eq('user_id', testUserId);
    await supabaseAdmin.from('user_points').delete().eq('user_id', testUserId);
    
    console.log('数据库初始化完成');
    
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

initDatabase();
