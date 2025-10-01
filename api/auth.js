import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = process.env.SUPABASE_URL || 'https://bqbtkaljxsmdcpedrerg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDg0NDUsImV4cCI6MjA3NDAyNDQ0NX0._XIcJcSg_00b_iOs90QM5GNaKAg5_LEHGDrexDTFcMQ';
// 使用服务角色密钥（优先），以确保服务端可绕过RLS执行写操作
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || supabaseKey;

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 重试函数
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`尝试 ${i + 1}/${maxRetries} 失败:`, error.message);
      
      // 如果是网络错误且还有重试次数，则等待后重试
      if (i < maxRetries - 1 && (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.message.includes('fetch failed'))) {
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // 指数退避
        continue;
      }
      
      throw error;
    }
  }
}

// 用户认证中间件
export async function authMiddleware(req, reply) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return reply.code(401).send({ error: '未提供认证令牌' });
  }

  try {
    console.log('验证令牌:', token.substring(0, 20) + '...');
    
    // 使用重试机制验证JWT令牌
    const { data: { user }, error } = await withRetry(async () => {
      return await supabase.auth.getUser(token);
    });
    
    console.log('认证结果:', { user: user?.id, error });
    
    if (error || !user) {
      console.error('认证失败:', error);
      return reply.code(401).send({ error: '无效的认证令牌' });
    }
    
    req.user = user;
    return;
  } catch (error) {
    console.error('认证中间件错误:', error);
    return reply.code(401).send({ error: '认证失败，请稍后重试' });
  }
}

// 获取用户信息
export async function getUserInfo(userId) {
  try {
    console.log('获取用户信息，用户ID:', userId);
    
    // 获取用户积分（容忍重复，按最新记录获取）- 使用重试机制
    const { data: pointsRows, error: pointsError } = await withRetry(async () => {
      return await supabaseAdmin
        .from('user_points')
        .select('points, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
    });
    const pointsData = Array.isArray(pointsRows) ? pointsRows[0] : null;

    console.log('积分查询结果:', { pointsData, pointsError });

    // 获取用户资料（容忍重复，按最新记录获取）- 使用重试机制
    const { data: profileRows, error: profileError } = await withRetry(async () => {
      return await supabaseAdmin
        .from('user_profiles')
        .select('username, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
    });
    const profileData = Array.isArray(profileRows) ? profileRows[0] : null;

    console.log('用户资料查询结果:', { profileData, profileError });

    // 确定用户名 - 优先使用profile中的用户名
    let finalUsername = profileData?.username;
    
    console.log('初始用户名:', finalUsername, 'profileError:', profileError);
    
    // 如果没有用户资料或用户名为默认值，从auth获取
    if (!finalUsername || finalUsername === '用户' || profileError) {
      console.log('用户资料不完整，尝试从auth获取用户信息');
      try {
        const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (user) {
          console.log('从auth获取到用户信息:', { 
            email: user.email, 
            metadata: user.user_metadata 
          });
          
          if (user.user_metadata && user.user_metadata.username) {
            finalUsername = user.user_metadata.username;
            console.log('从auth metadata获取到用户名:', finalUsername);
          } else if (user.email) {
            // 使用邮箱前缀作为用户名
            finalUsername = user.email.split('@')[0];
            console.log('使用邮箱前缀作为用户名:', finalUsername);
          }
        }
      } catch (error) {
        console.error('从auth获取用户信息失败:', error);
      }
    }

    // 确保有一个合理的默认用户名
    if (!finalUsername || finalUsername === '用户') {
      finalUsername = `用户_${userId.substring(0, 8)}`;
      console.log('使用默认用户名:', finalUsername);
    }
    
    console.log('最终确定的用户名:', finalUsername);

    // 确定积分，如果没有积分记录则创建
    let userPoints = pointsData?.points;
    if (userPoints === undefined || userPoints === null) {
      console.log('用户没有积分记录，创建默认积分记录');
      // 使用upsert确保积分记录创建成功（兼容新旧数据库）- 使用重试机制
      const { error: createPointsError } = await withRetry(async () => {
        return await supabaseAdmin
          .from('user_points')
          .upsert({
            user_id: userId,
            points: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
      });

      if (createPointsError) {
        console.error('创建积分记录失败:', createPointsError);
        // 尝试直接插入作为备选方案 - 使用重试机制
        const { error: insertError } = await withRetry(async () => {
          return await supabaseAdmin
            .from('user_points')
            .insert({
              user_id: userId,
              points: 100,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        });

        if (insertError) {
          console.error('插入积分记录也失败:', insertError);
        }
      }

      userPoints = 100; // 默认积分
    }

    const result = {
      points: userPoints,
      username: finalUsername,
      error: null
    };

    console.log('最终用户信息:', result);
    return result;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return { points: 100, username: `用户_${userId?.substring(0, 8) || 'unknown'}`, error: null };
  }
}

// 更新用户积分
export async function updateUserPoints(userId, pointsChange) {
  try {
    // 先获取当前积分（按最新记录）- 使用重试机制
    const { data: pointsRows } = await withRetry(async () => {
      return await supabaseAdmin
        .from('user_points')
        .select('points, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
    });
    const currentPoints = Array.isArray(pointsRows) && pointsRows.length > 0 ? (pointsRows[0].points || 0) : 100;
    
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

    // 先尝试更新；如果没有更新任何行，则插入
    console.log('尝试更新积分:', { userId, currentPoints, pointsChange, newPoints });
    
    const { data: updatedRows, error: updateError } = await withRetry(async () => {
      return await supabaseAdmin
        .from('user_points')
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select('user_id');
    });

    if (updateError) {
      console.error('积分更新失败:', updateError);
      return { success: false, error: '积分更新失败: ' + updateError.message };
    }

    console.log('Update result:', { updatedRows, count: updatedRows?.length });

    if (!updatedRows || updatedRows.length === 0) {
      console.log('没有行被更新，尝试插入新记录');
      const { error: insertError } = await withRetry(async () => {
        return await supabaseAdmin
          .from('user_points')
          .insert({
            user_id: userId,
            points: newPoints,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      });
      if (insertError) {
        console.error('积分插入失败:', insertError);
        return { success: false, error: '积分插入失败: ' + insertError.message };
      }
      console.log('积分记录插入成功');
    } else {
      console.log('积分更新成功');
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
    
    // 使用admin客户端查询积分（按最新记录获取，避免重复记录导致错误）- 使用重试机制
    const { data: rows, error } = await withRetry(async () => {
      return await supabaseAdmin
        .from('user_points')
        .select('points, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
    });

    if (error) {
      console.error('积分查询失败:', error);
      return { hasEnough: false, currentPoints: 0, error };
    }

    const currentPoints = Array.isArray(rows) && rows.length > 0 ? (rows[0].points || 0) : 100;
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
