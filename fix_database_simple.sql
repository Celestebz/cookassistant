-- 简化的数据库修复脚本
-- 先删除表重建，确保干净的状态

-- 删除现有表（如果存在）
DROP TABLE IF EXISTS user_points CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 创建 user_points 表
CREATE TABLE user_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 100 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 创建 user_profiles 表
CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 启用 RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
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
