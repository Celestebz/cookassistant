-- 修复数据库约束问题 v2
-- 先清理重复数据，再添加约束

-- 第1步: 清理 user_points 表的重复记录
-- 保留每个用户最新的积分记录
DELETE FROM user_points
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM user_points
  ) t
  WHERE t.rn > 1
);

-- 第2步: 清理 user_profiles 表的重复记录
-- 保留每个用户最新的资料记录
DELETE FROM user_profiles
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM user_profiles
  ) t
  WHERE t.rn > 1
);

-- 第3步: 添加唯一约束
ALTER TABLE user_points DROP CONSTRAINT IF EXISTS user_points_user_id_key;
ALTER TABLE user_points ADD CONSTRAINT user_points_user_id_key UNIQUE (user_id);

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_key;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);

-- 第4步: 设置RLS策略
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
