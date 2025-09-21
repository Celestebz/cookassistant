-- 修复Supabase安全问题的SQL代码
-- 启用Row Level Security (RLS) 并设置安全策略

-- 1. 启用 user_points 表的 RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

-- 2. 启用 user_profiles 表的 RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. 为 user_points 表创建安全策略
-- 用户只能查看和修改自己的积分记录
CREATE POLICY "Users can view own points" ON user_points
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own points" ON user_points
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own points" ON user_points
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. 为 user_profiles 表创建安全策略
-- 用户只能查看和修改自己的资料
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. 允许服务端角色访问（用于后端API）
-- 这些策略允许使用服务密钥的后端API访问所有数据
CREATE POLICY "Service role can access all user_points" ON user_points
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all user_profiles" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- 6. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- 7. 更新触发器函数以处理RLS
CREATE OR REPLACE FUNCTION create_user_points()
RETURNS TRIGGER AS $$
BEGIN
  -- 使用服务角色权限插入数据
  INSERT INTO user_points (user_id, points)
  VALUES (NEW.id, 100);
  
  INSERT INTO user_profiles (user_id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 更新积分函数以处理RLS
CREATE OR REPLACE FUNCTION update_user_points(user_uuid UUID, points_change INTEGER)
RETURNS INTEGER AS $$
DECLARE
  new_points INTEGER;
BEGIN
  UPDATE user_points 
  SET points = points + points_change,
      updated_at = NOW()
  WHERE user_id = user_uuid
  RETURNING points INTO new_points;
  
  RETURN COALESCE(new_points, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
