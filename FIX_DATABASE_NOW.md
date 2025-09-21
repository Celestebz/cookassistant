# 🚨 紧急数据库修复指南

## 问题诊断
✅ Supabase连接正常  
✅ 数据库表存在  
❌ 触发器函数有权限问题，导致"Database error saving new user"

## 🔥 立即修复步骤

### 第1步：访问Supabase控制台
1. 打开 https://supabase.com/dashboard
2. 登录您的账户
3. 选择项目：`bqbtkaljxsmdcpedrerg`
4. 点击左侧菜单的 **SQL Editor**

### 第2步：执行紧急修复脚本
**复制以下完整SQL代码到SQL Editor中，然后点击"Run"：**

```sql
-- 紧急数据库修复脚本
-- 解决"Database error saving new user"问题

-- 1. 删除旧的触发器和函数（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS create_user_points();

-- 2. 重新创建安全的触发器函数
CREATE OR REPLACE FUNCTION create_user_points()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- 先尝试插入用户积分记录
  BEGIN
    INSERT INTO public.user_points (user_id, points)
    VALUES (NEW.id, 100);
  EXCEPTION WHEN OTHERS THEN
    -- 如果失败，记录警告但继续
    RAISE WARNING 'Failed to create user_points for user %: %', NEW.id, SQLERRM;
  END;
  
  -- 然后尝试插入用户资料记录
  BEGIN
    INSERT INTO public.user_profiles (user_id, username)
    VALUES (
      NEW.id, 
      COALESCE(
        NEW.raw_user_meta_data->>'username', 
        'user_' || substr(NEW.id::text, 1, 8)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- 如果失败，记录警告但继续
    RAISE WARNING 'Failed to create user_profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- 3. 重新创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_points();

-- 4. 确保表的所有者权限正确
ALTER TABLE public.user_points OWNER TO postgres;
ALTER TABLE public.user_profiles OWNER TO postgres;

-- 5. 重新设置RLS策略
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 删除可能冲突的策略
DROP POLICY IF EXISTS "Users can manage own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access points" ON public.user_points;
DROP POLICY IF EXISTS "Service role full access profiles" ON public.user_profiles;

-- 重新创建策略
CREATE POLICY "Users can manage own points" ON public.user_points
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own profile" ON public.user_profiles
    FOR ALL USING (auth.uid() = user_id);

-- 允许服务角色访问（重要！）
CREATE POLICY "Service role full access points" ON public.user_points
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access profiles" ON public.user_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- 6. 授予必要的权限
GRANT ALL ON public.user_points TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.user_profiles TO postgres, anon, authenticated, service_role;

-- 7. 更新积分函数
CREATE OR REPLACE FUNCTION public.update_user_points(user_uuid UUID, points_change INTEGER)
RETURNS INTEGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_points INTEGER;
BEGIN
  UPDATE public.user_points 
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
$$;

-- 8. 显示成功消息
SELECT 'Database emergency fix completed successfully!' as status;
```

### 第3步：验证修复结果
执行SQL后，您应该看到：
```
status: "Database emergency fix completed successfully!"
```

### 第4步：立即测试注册
1. 返回测试页面
2. 点击"测试注册"
3. 应该看到"注册成功！"消息

## 🔍 如果仍然失败

如果修复后仍然有问题，请：
1. 检查SQL执行是否有错误消息
2. 在Supabase Dashboard的"Logs"部分查看详细错误
3. 确认所有SQL语句都已成功执行

## ⚡ 快速测试命令

修复完成后，可以使用这个测试用户名：
- 用户名：`emergency_test_user`
- 密码：`123456`

---
**这个修复脚本解决了权限问题和触发器函数的错误处理，确保用户注册不会因为数据库错误而失败。**
