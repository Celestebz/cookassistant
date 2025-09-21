# 🚀 快速启动指南

## ✅ Supabase配置已完成

您的Supabase项目配置已成功更新到所有相关文件中：
- **项目URL**: `https://bqbtkaljxsmdcpedrerg.supabase.co`
- **API密钥**: 已配置到所有前端和后端文件

## 📋 下一步操作

### 1. 创建数据库表

在Supabase控制台中执行以下SQL：

1. 访问 [Supabase控制台](https://supabase.com/dashboard)
2. 选择您的项目
3. 进入 **SQL Editor**
4. 执行以下SQL代码：

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

### 2. 启动后端服务

```bash
cd backend
npm start
```

### 3. 测试认证系统

打开以下页面进行测试：

- **认证测试页面**: `file:///Users/celeste/Documents/04 AIGC/coding/cook/webtest/auth_test.html`
- **登录注册页面**: `file:///Users/celeste/Documents/04 AIGC/coding/cook/webtest/auth.html`
- **主应用页面**: `file:///Users/celeste/Documents/04 AIGC/coding/cook/webtest/index_with_auth.html`

## 🧪 测试流程

1. **打开认证测试页面**
2. **点击"测试 Supabase 连接"** - 应该显示连接成功
3. **测试注册功能**：
   - 输入用户名：`testuser`
   - 输入密码：`123456`
   - 点击"测试注册"
4. **测试登录功能**：
   - 点击"测试登录"
5. **测试积分系统**：
   - 点击"获取用户信息"查看积分
   - 测试消费和奖励积分功能

## 🎯 功能特性

- ✅ **简化注册**：只需用户名和密码
- ✅ **首次注册奖励**：自动获得100积分
- ✅ **积分系统**：每次AI分析消耗10积分
- ✅ **安全认证**：JWT令牌验证
- ✅ **前后端集成**：完整的API端点

## 🔧 故障排除

如果遇到问题：

1. **检查后端服务**：确保 `npm start` 成功运行
2. **检查数据库表**：确保SQL已正确执行
3. **检查浏览器控制台**：查看是否有JavaScript错误
4. **检查网络连接**：确保能访问Supabase服务

## 📞 支持

如果遇到任何问题，请检查：
- 后端服务是否正常运行
- 数据库表是否正确创建
- 浏览器控制台是否有错误信息
