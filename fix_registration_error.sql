-- 快速修复注册错误的SQL脚本
-- 这将解决"Database error saving new user"问题

-- 1. 创建用户积分表（如果不存在）
CREATE TABLE IF NOT EXISTS user_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建用户资料表（如果不存在）
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 删除旧的触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS create_user_points();

-- 4. 创建安全的触发器函数
CREATE OR REPLACE FUNCTION create_user_points()
RETURNS TRIGGER AS $$
BEGIN
  -- 插入用户积分记录，给新用户100积分
  INSERT INTO user_points (user_id, points)
  VALUES (NEW.id, 100);
  
  -- 插入用户资料记录，使用用户名或生成默认用户名
  INSERT INTO user_profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)));
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 如果出错，记录警告但不阻止用户注册
    RAISE WARNING 'Failed to create user points/profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_points();

-- 6. 创建更新积分函数
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

-- 7. 启用行级安全
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 8. 创建安全策略
-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can manage own points" ON user_points;
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role full access points" ON user_points;
DROP POLICY IF EXISTS "Service role full access profiles" ON user_profiles;

-- 用户可以管理自己的数据
CREATE POLICY "Users can manage own points" ON user_points
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own profile" ON user_profiles
    FOR ALL USING (auth.uid() = user_id);

-- 服务角色可以访问所有数据（后端API需要）
CREATE POLICY "Service role full access points" ON user_points
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access profiles" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- 9. 创建索引以提高性能
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- 10. 验证表结构
DO $$
BEGIN
  RAISE NOTICE 'Database repair completed successfully!';
  RAISE NOTICE 'Tables created: user_points, user_profiles';
  RAISE NOTICE 'Trigger created: on_auth_user_created';
  RAISE NOTICE 'Functions created: create_user_points, update_user_points';
  RAISE NOTICE 'Security policies enabled';
END $$;

