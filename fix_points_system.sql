-- 修复积分系统 - 在Supabase控制台执行此SQL

-- 1. 创建用户积分表
CREATE TABLE IF NOT EXISTS user_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建用户资料表
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建触发器函数：新用户注册时自动创建积分记录
CREATE OR REPLACE FUNCTION create_user_points()
RETURNS TRIGGER AS $$
BEGIN
  -- 为新用户创建积分记录，赠送100积分
  INSERT INTO user_points (user_id, points)
  VALUES (NEW.id, 100);
  
  -- 创建用户资料记录
  INSERT INTO user_profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_points();

-- 5. 创建更新积分函数
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

-- 6. 为现有用户手动添加积分（如果有的话）
-- 注意：这只会为已存在但还没有积分记录的用户添加积分
INSERT INTO user_points (user_id, points)
SELECT id, 100
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_points);

INSERT INTO user_profiles (user_id, username)
SELECT id, COALESCE(raw_user_meta_data->>'username', 'user_' || substr(id::text, 1, 8))
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_profiles);

-- 7. 设置RLS策略（行级安全）
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "Users can view own points" ON user_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own points" ON user_points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);
