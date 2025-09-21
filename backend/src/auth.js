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
export function authMiddleware(req, reply, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return reply.code(401).send({ error: '未提供认证令牌' });
  }

  // 验证JWT令牌
  supabase.auth.getUser(token)
    .then(({ data: { user }, error }) => {
      if (error || !user) {
        return reply.code(401).send({ error: '无效的认证令牌' });
      }
      
      req.user = user;
      next();
    })
    .catch(() => {
      reply.code(401).send({ error: '认证失败' });
    });
}

// 获取用户信息
export async function getUserInfo(userId) {
  try {
    // 获取用户积分
    const { data: pointsData, error: pointsError } = await supabaseAdmin
      .from('user_points')
      .select('points')
      .eq('user_id', userId)
      .single();

    // 获取用户资料
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('username')
      .eq('user_id', userId)
      .single();

    return {
      points: pointsData?.points || 0,
      username: profileData?.username || '用户',
      error: pointsError || profileError
    };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return { points: 0, username: '用户', error };
  }
}

// 更新用户积分
export async function updateUserPoints(userId, pointsChange) {
  try {
    const { data, error } = await supabaseAdmin.rpc('update_user_points', {
      user_uuid: userId,
      points_change: pointsChange
    });

    if (error) {
      console.error('更新积分失败:', error);
      return { success: false, error };
    }

    return { success: true, newPoints: data };
  } catch (error) {
    console.error('更新积分失败:', error);
    return { success: false, error };
  }
}

// 验证用户是否有足够积分
export async function checkUserPoints(userId, requiredPoints) {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_points')
      .select('points')
      .eq('user_id', userId)
      .single();

    if (error) {
      return { hasEnough: false, currentPoints: 0, error };
    }

    const currentPoints = data?.points || 0;
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
