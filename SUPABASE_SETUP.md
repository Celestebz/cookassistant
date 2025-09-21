# Supabase 认证系统设置指南

## 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com)
2. 注册/登录账户
3. 创建新项目
4. 记录项目 URL 和 API 密钥

## 2. 数据库设置

在 Supabase SQL 编辑器中执行以下 SQL：

```sql
-- 创建用户积分表
CREATE TABLE IF NOT EXISTS user_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户资料表
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建触发器：新用户注册时自动创建积分记录
CREATE OR REPLACE FUNCTION create_user_points()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_points (user_id, points)
  VALUES (NEW.id, 100); -- 新用户赠送100积分
  
  INSERT INTO user_profiles (user_id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_points();

-- 创建更新积分函数
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
```

## 3. 配置环境变量

复制 `backend/env.example` 到 `backend/.env` 并填入您的配置：

```bash
# Supabase配置
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# 豆包API配置
DOUBAO_API_KEY=your-doubao-api-key

# 其他配置
PORT=8787
PUBLIC_BASE_URL=http://localhost:8787
```

## 4. 更新前端配置

在以下文件中更新 Supabase 配置：

- `webtest/auth.html`
- `webtest/index_with_auth.html`

将以下配置替换为您的实际值：

```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co'
const SUPABASE_KEY = 'your-anon-key'
```

## 5. 安装依赖

```bash
# 安装 Supabase 客户端
npm install @supabase/supabase-js

# 安装后端依赖
cd backend
npm install
```

## 6. 启动服务

```bash
# 启动后端服务
cd backend
npm start

# 访问前端页面
# 认证页面: file:///path/to/webtest/auth.html
# 主页面: file:///path/to/webtest/index_with_auth.html
```

## 7. 功能说明

### 认证功能
- **注册**: 用户名 + 密码，自动赠送100积分
- **登录**: 用户名 + 密码
- **积分系统**: 每次AI分析消耗10积分

### API端点
- `GET /auth/user` - 获取用户信息
- `POST /auth/points` - 更新积分
- `POST /auth/consume-points` - 消费积分
- `POST /auth/reward-points` - 奖励积分
- `POST /auth/check-points` - 检查积分

### 数据库表
- `user_points` - 用户积分表
- `user_profiles` - 用户资料表
- `auth.users` - Supabase 内置用户表

## 8. 测试流程

1. 访问认证页面进行注册
2. 注册成功后自动获得100积分
3. 登录后可以上传图片进行AI分析
4. 每次分析消耗10积分
5. 积分不足时无法进行分析

## 9. 安全注意事项

- 确保 `SUPABASE_SERVICE_KEY` 保密，仅在服务端使用
- 在生产环境中使用 HTTPS
- 定期备份数据库
- 设置适当的 RLS (Row Level Security) 策略
