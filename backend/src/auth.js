import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = process.env.SUPABASE_URL || 'https://bqbtkaljxsmdcpedrerg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDg0NDUsImV4cCI6MjA3NDAyNDQ0NX0._XIcJcSg_00b_iOs90QM5GNaKAg5_LEHGDrexDTFcMQ';
// 暂时使用匿名密钥作为服务密钥（开发环境）
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || supabaseKey;

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 用户认证中间件
export async function authMiddleware(req, reply) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return reply.code(401).send({ error: '未提供认证令牌' });
  }

  try {
    console.log('验证令牌:', token.substring(0, 20) + '...');
    
    // 验证JWT令牌
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    console.log('认证结果:', { user: user?.id, error });
    
    if (error || !user) {
      console.error('认证失败:', error);
      return reply.code(401).send({ error: '无效的认证令牌' });
    }
    
    req.user = user;
    return;
  } catch (error) {
    console.error('认证中间件错误:', error);
    return reply.code(401).send({ error: '认证失败' });
  }
}

// 获取用户信息
export async function getUserInfo(userId) {
  try {
    console.log('获取用户信息，用户ID:', userId);
    
    // 获取用户积分
    const { data: pointsData, error: pointsError } = await supabaseAdmin
      .from('user_points')
      .select('points')
      .eq('user_id', userId)
      .single();

    console.log('积分查询结果:', { pointsData, pointsError });

    // 获取用户资料
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('username')
      .eq('user_id', userId)
      .single();

    console.log('用户资料查询结果:', { profileData, profileError });

    // 如果查询不到数据，尝试从Supabase auth获取用户信息
    let finalUsername = profileData?.username || '用户';
    
    if (profileError && profileError.message.includes('Cannot coerce the result to a single JSON object')) {
      console.log('用户资料不存在，尝试从auth获取用户信息');
      try {
        // 尝试从Supabase auth获取用户信息
        const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (user && user.user_metadata && user.user_metadata.username) {
          finalUsername = user.user_metadata.username;
          console.log('从auth获取到用户名:', finalUsername);
        } else if (user && user.email) {
          // 如果没有username，使用邮箱前缀作为用户名
          finalUsername = user.email.split('@')[0];
          console.log('使用邮箱前缀作为用户名:', finalUsername);
        }
      } catch (error) {
        console.error('从auth获取用户信息失败:', error);
      }
    }

    const result = {
      points: pointsData?.points || 100,
      username: finalUsername,
      error: null
    };

    console.log('最终用户信息:', result);
    return result;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return { points: 100, username: '用户', error: null };
  }
}

// 更新用户积分
export async function updateUserPoints(userId, pointsChange) {
  try {
    // 先获取当前积分
    const currentPointsResult = await checkUserPoints(userId, 0);
    const currentPoints = currentPointsResult.currentPoints;
    
    // 计算新积分
    const newPoints = currentPoints + pointsChange;
    
    // 防止负积分
    if (newPoints < 0) {
      console.log('积分不足，无法扣除。当前积分:', currentPoints, '尝试扣除:', Math.abs(pointsChange));
      return { 
        success: false, 
        error: '积分不足', 
        currentPoints: currentPoints,
        requiredPoints: Math.abs(pointsChange)
      };
    }

    // 使用upsert操作，自动处理插入或更新
    try {
      const { data, error } = await supabaseAdmin
        .from('user_points')
        .upsert({
          user_id: userId,
          points: newPoints,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (error) {
        console.error('积分更新失败:', error);
        return { success: false, error };
      }

      console.log('积分更新成功，新积分:', newPoints);
    } catch (error) {
      console.error('积分更新异常:', error);
      return { success: false, error };
    }


    console.log('积分更新成功:', { userId, oldPoints: currentPoints, change: pointsChange, newPoints });
    return { success: true, newPoints: newPoints };
  } catch (error) {
    console.error('更新积分失败:', error);
    return { success: false, error };
  }
}

// 验证用户是否有足够积分
export async function checkUserPoints(userId, requiredPoints) {
  try {
    console.log('检查用户积分，用户ID:', userId, '需要积分:', requiredPoints);
    
    // 使用admin客户端查询积分
    const { data, error } = await supabaseAdmin
      .from('user_points')
      .select('points')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('积分查询失败:', error);
      // 如果查询不到数据，使用默认积分值
      if (error.message.includes('Cannot coerce the result to a single JSON object')) {
        console.log('积分记录不存在，使用默认100积分');
        return { hasEnough: 100 >= requiredPoints, currentPoints: 100, error: null };
      }
      return { hasEnough: false, currentPoints: 0, error };
    }

    const currentPoints = data?.points || 100;
    console.log('当前积分:', currentPoints, '需要积分:', requiredPoints);
    
    return { 
      hasEnough: currentPoints >= requiredPoints, 
      currentPoints,
      error: null 
    };
  } catch (error) {
    console.error('检查积分失败:', error);
    return { hasEnough: false, currentPoints: 0, error };
  }
}

// 消费积分（用于AI分析等功能）
export async function consumePoints(userId, points) {
  try {
    // 先检查积分是否足够
    const pointsCheck = await checkUserPoints(userId, points);
    if (!pointsCheck.hasEnough) {
      return { 
        success: false, 
        error: '积分不足', 
        currentPoints: pointsCheck.currentPoints 
      };
    }

    // 扣除积分
    const result = await updateUserPoints(userId, -points);
    if (!result.success) {
      return { success: false, error: '扣除积分失败' };
    }

    return { 
      success: true, 
      newPoints: result.newPoints,
      consumedPoints: points 
    };
  } catch (error) {
    console.error('消费积分失败:', error);
    return { success: false, error: '消费积分失败' };
  }
}

// 奖励积分（用于完成任务等）
export async function rewardPoints(userId, points) {
  try {
    const result = await updateUserPoints(userId, points);
    if (!result.success) {
      return { success: false, error: '奖励积分失败' };
    }

    return { 
      success: true, 
      newPoints: result.newPoints,
      rewardedPoints: points 
    };
  } catch (error) {
    console.error('奖励积分失败:', error);
    return { success: false, error: '奖励积分失败' };
  }
}

// 获取用户积分历史（可选功能）
export async function getUserPointsHistory(userId, limit = 10) {
  try {
    const { data, error } = await supabaseAdmin
      .from('points_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error, history: [] };
    }

    return { success: true, history: data || [] };
  } catch (error) {
    console.error('获取积分历史失败:', error);
    return { success: false, error, history: [] };
  }
}
