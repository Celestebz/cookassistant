-- 修复用户积分系统
-- 确保新用户注册时自动获得100积分

-- 1. 确保用户积分表存在
CREATE TABLE IF NOT EXISTS user_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 确保用户资料表存在
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 删除旧的触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 4. 创建新的触发器函数
CREATE OR REPLACE FUNCTION create_user_points()
RETURNS TRIGGER AS $$
BEGIN
  -- 插入用户积分记录
  INSERT INTO user_points (user_id, points)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO UPDATE SET points = 100;
  
  -- 插入用户资料记录
  INSERT INTO user_profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', '用户'))
  ON CONFLICT (user_id) DO UPDATE SET username = COALESCE(NEW.raw_user_meta_data->>'username', '用户');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
END;
$$ LANGUAGE plpgsql;

-- 7. 为现有用户补充积分（如果他们没有积分记录）
INSERT INTO user_points (user_id, points)
SELECT id, 100
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_points)
ON CONFLICT (user_id) DO NOTHING;

-- 8. 为现有用户补充资料（如果他们没有资料记录）
INSERT INTO user_profiles (user_id, username)
SELECT id, COALESCE(raw_user_meta_data->>'username', '用户')
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 9. 设置RLS策略
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的积分和资料
CREATE POLICY "Users can view own points" ON user_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own points" ON user_points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- 允许服务角色完全访问
CREATE POLICY "Service role can manage all points" ON user_points
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all profiles" ON user_profiles
  FOR ALL USING (auth.role() = 'service_role');
