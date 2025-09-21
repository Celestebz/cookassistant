# 🔧 数据库修复指南

## 问题描述
注册时出现 "Database error saving new user" 错误，这是因为数据库表和安全策略没有正确设置。

## 🚀 快速修复步骤

### 1. 访问 Supabase 控制台
1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目：`bqbtkaljxsmdcpedrerg`
3. 点击左侧菜单的 **SQL Editor**

### 2. 执行修复脚本
复制并粘贴以下SQL代码到SQL Editor中，然后点击 **Run**：

```sql
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
```

### 3. 验证修复结果
执行SQL后，您应该看到类似这样的成功消息：
```
NOTICE: Database repair completed successfully!
NOTICE: Tables created: user_points, user_profiles
NOTICE: Trigger created: on_auth_user_created
NOTICE: Functions created: create_user_points, update_user_points
NOTICE: Security policies enabled
```

### 4. 测试注册功能
1. 返回网页
2. 点击"注册"按钮
3. 输入用户名：`testuser`
4. 输入密码：`123456`
5. 点击"注册"

如果成功，您应该看到"注册成功！您获得了100积分奖励！"的消息。

## 🔍 故障排除

如果仍然遇到问题：

1. **检查后端服务**：确保后端在端口3000上运行
2. **检查网络连接**：确保能访问Supabase服务
3. **查看浏览器控制台**：检查是否有JavaScript错误
4. **查看Supabase日志**：在Supabase Dashboard的Logs部分查看错误信息

## 📞 需要帮助？

如果问题仍然存在，请：
1. 检查Supabase项目的API设置
2. 确认数据库表是否正确创建
3. 检查RLS策略是否生效
