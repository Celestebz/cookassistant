# 积分系统RLS问题修复指南

## 🔴 根本原因

后端使用的 `supabaseAdmin` 客户端正在使用 **anon key**（匿名密钥）而不是 **service role key**（服务角色密钥），导致无法绕过Row-Level Security (RLS)策略进行积分更新。

### 错误日志
```
new row violates row-level security policy for table "user_points"
Update result: { updatedRows: [], count: 0 }
```

## ✅ 解决方案

### 方案 1: 获取Service Role Key（推荐）

1. 登录 Supabase Dashboard: https://supabase.com/dashboard
2. 选择你的项目: `bqbtkaljxsmdcpedrerg`
3. 进入 **Settings** > **API**
4. 找到 **service_role** key（⚠️ 注意：这个key有完全访问权限，不要泄露）
5. 复制service_role key

6. 创建 `backend/.env` 文件：
```bash
SUPABASE_URL=https://bqbtkaljxsmdcpedrerg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDg0NDUsImV4cCI6MjA3NDAyNDQ0NX0._XIcJcSg_00b_iOs90QM5GNaKAg5_LEHGDrexDTFcMQ
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key_在这里
```

7. 重启服务器：
```bash
cd backend && npm start
```

### 方案 2: 修改RLS策略允许anon key更新（临时方案，不安全）

在Supabase SQL Editor中执行：

```sql
-- 允许anon角色插入和更新user_points
DROP POLICY IF EXISTS "Service role can manage all points" ON user_points;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON user_profiles;

CREATE POLICY "Allow anon inserts" ON user_points
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon updates" ON user_points
  FOR UPDATE USING (true);

CREATE POLICY "Allow anon inserts profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon updates profiles" ON user_profiles
  FOR UPDATE USING (true);
```

⚠️ **警告**: 方案2不安全，任何人都可以修改积分。仅用于开发测试。

### 方案 3: 禁用RLS（最不安全，仅用于本地开发）

```sql
ALTER TABLE user_points DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
```

## 🔍 验证修复

运行E2E测试：
```bash
node test_e2e_points.js
```

应该看到：
```
✅ E2E points test passed
```

## 📋 当前状态

- ✅ 后端代码已更新（使用service role key的代码已就绪）
- ❌ 需要设置真正的service role key环境变量
- ✅ 前端API调用已修复（使用正确的API_BASE）
- ✅ 积分扣除逻辑已完善
- ✅ 用户名显示逻辑已修复

## 🎯 完成后的功能

1. ✅ 新用户注册赠送100积分
2. ✅ 用户名正确显示
3. ✅ 登录显示剩余积分
4. ✅ AI分析扣除10积分
5. ✅ 积分不足保护

所有代码已准备就绪，只需配置service role key即可完全正常工作！
