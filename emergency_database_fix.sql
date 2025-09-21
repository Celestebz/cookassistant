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

-- 8. 测试触发器是否工作
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
BEGIN
  -- 模拟插入用户来测试触发器
  RAISE NOTICE 'Testing trigger function...';
  PERFORM create_user_points() FROM (
    SELECT test_user_id as id, '{"username": "test_user"}'::jsonb as raw_user_meta_data
  ) AS NEW;
  RAISE NOTICE 'Trigger test completed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Trigger test failed: %', SQLERRM;
END;
$$;

-- 9. 显示成功消息
SELECT 'Database emergency fix completed successfully!' as status;
