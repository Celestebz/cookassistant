import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('缺少Supabase配置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSQLFunctions() {
  console.log('开始创建SQL函数...');
  
  try {
    // 创建绕过RLS策略的积分插入函数
    const { error: insertError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION insert_user_points(p_user_id UUID, p_points INTEGER)
        RETURNS VOID AS $$
        BEGIN
          -- 先尝试更新现有记录
          UPDATE user_points 
          SET points = p_points, updated_at = NOW()
          WHERE user_id = p_user_id;
          
          -- 如果没有记录被更新，则插入新记录
          IF NOT FOUND THEN
            INSERT INTO user_points (user_id, points, created_at, updated_at)
            VALUES (p_user_id, p_points, NOW(), NOW());
          END IF;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });

    if (insertError) {
      console.error('创建insert_user_points函数失败:', insertError);
    } else {
      console.log('✅ insert_user_points函数创建成功');
    }

    // 创建绕过RLS策略的积分更新函数
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION update_user_points_safe(p_user_id UUID, p_points INTEGER)
        RETURNS INTEGER AS $$
        DECLARE
          new_points INTEGER;
        BEGIN
          -- 先尝试更新现有记录
          UPDATE user_points 
          SET points = p_points, updated_at = NOW()
          WHERE user_id = p_user_id
          RETURNING points INTO new_points;
          
          -- 如果没有记录被更新，则插入新记录
          IF new_points IS NULL THEN
            INSERT INTO user_points (user_id, points, created_at, updated_at)
            VALUES (p_user_id, p_points, NOW(), NOW())
            RETURNING points INTO new_points;
          END IF;
          
          RETURN new_points;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });

    if (updateError) {
      console.error('创建update_user_points_safe函数失败:', updateError);
    } else {
      console.log('✅ update_user_points_safe函数创建成功');
    }

    // 创建绕过RLS策略的积分查询函数
    const { error: getError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION get_user_points_safe(p_user_id UUID)
        RETURNS INTEGER AS $$
        DECLARE
          user_points INTEGER;
        BEGIN
          SELECT points INTO user_points
          FROM user_points
          WHERE user_id = p_user_id;
          
          -- 如果没有记录，返回默认值
          IF user_points IS NULL THEN
            RETURN 100;
          END IF;
          
          RETURN user_points;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    });

    if (getError) {
      console.error('创建get_user_points_safe函数失败:', getError);
    } else {
      console.log('✅ get_user_points_safe函数创建成功');
    }

    console.log('🎉 所有SQL函数创建完成！');
    
  } catch (error) {
    console.error('创建SQL函数时出错:', error);
  }
}

createSQLFunctions();
