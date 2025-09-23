-- 创建绕过RLS策略的积分插入函数
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

-- 创建绕过RLS策略的积分更新函数
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

-- 创建绕过RLS策略的积分查询函数
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
