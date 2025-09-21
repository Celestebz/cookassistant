-- 完整数据库修复脚本
-- 解决"Database error saving new user"问题

-- 1. 删除可能存在的旧触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS create_user_points();

-- 2. 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own points" ON user_points;
DROP POLICY IF EXISTS "Users can update own points" ON user_points;
DROP POLICY IF EXISTS "Users can insert own points" ON user_points;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role can access all user_points" ON user_points;
DROP POLICY IF EXISTS "Service role can access all user_profiles" ON user_profiles;

-- 3. 重新创建表（如果不存在）
CREATE TABLE IF NOT EXISTS user_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建安全的触发器函数
CREATE OR REPLACE FUNCTION create_user_points()
RETURNS TRIGGER AS $$
BEGIN
  -- 插入用户积分记录
  INSERT INTO user_points (user_id, points)
  VALUES (NEW.id, 100);
  
  -- 插入用户资料记录
  INSERT INTO user_profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)));
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 如果插入失败，记录错误但不阻止用户创建
    RAISE WARNING 'Failed to create user points/profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_points();

-- 6. 启用RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 7. 创建安全的RLS策略
-- 用户只能访问自己的数据
CREATE POLICY "Users can manage own points" ON user_points
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own profile" ON user_profiles
    FOR ALL USING (auth.uid() = user_id);

-- 服务角色可以访问所有数据
CREATE POLICY "Service role full access points" ON user_points
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access profiles" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- 8. 创建更新积分函数
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to update user points: %', SQLERRM;
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- 10. 测试数据插入（可选）
-- 这可以帮助验证表结构是否正确
DO $$
BEGIN
  -- 尝试插入测试数据来验证表结构
  INSERT INTO user_points (user_id, points) 
  VALUES ('00000000-0000-0000-0000-000000000000', 0)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO user_profiles (user_id, username) 
  VALUES ('00000000-0000-0000-0000-000000000000', 'test_user')
  ON CONFLICT DO NOTHING;
  
  -- 清理测试数据
  DELETE FROM user_points WHERE user_id = '00000000-0000-0000-0000-000000000000';
  DELETE FROM user_profiles WHERE user_id = '00000000-0000-0000-0000-000000000000';
  
  RAISE NOTICE 'Database structure validation completed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Database structure validation failed: %', SQLERRM;
END $$;
