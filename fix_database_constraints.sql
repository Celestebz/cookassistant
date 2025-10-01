-- 修复数据库约束问题
-- 这个脚本需要在Supabase SQL编辑器中手动执行

-- 1. 为 user_points 表添加唯一约束
ALTER TABLE user_points DROP CONSTRAINT IF EXISTS user_points_user_id_key;
ALTER TABLE user_points ADD CONSTRAINT user_points_user_id_key UNIQUE (user_id);

-- 2. 为 user_profiles 表添加唯一约束
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_key;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);

-- 3. 确保表存在并有正确的结构
CREATE TABLE IF NOT EXISTS user_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 100 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 清理重复的记录（如果有）
-- 保留每个用户的最新记录
DELETE FROM user_points a USING (
  SELECT user_id, MAX(created_at) as max_created
  FROM user_points
  GROUP BY user_id
  HAVING COUNT(*) > 1
) b
WHERE a.user_id = b.user_id AND a.created_at < b.max_created;

DELETE FROM user_profiles a USING (
  SELECT user_id, MAX(created_at) as max_created
  FROM user_profiles
  GROUP BY user_id
  HAVING COUNT(*) > 1
) b
WHERE a.user_id = b.user_id AND a.created_at < b.max_created;

-- 5. 设置RLS策略（如果还没有）
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "Users can view own points" ON user_points;
DROP POLICY IF EXISTS "Users can update own points" ON user_points;
DROP POLICY IF EXISTS "Service role can manage all points" ON user_points;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON user_profiles;

-- 创建新策略
CREATE POLICY "Users can view own points" ON user_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own points" ON user_points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all points" ON user_points
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all profiles" ON user_profiles
  FOR ALL USING (auth.role() = 'service_role');
