# 🔧 Vercel 环境变量配置指南

## 更新后的环境变量配置

现在使用 Doubao-Seed-1.6-flash 模式，需要在 Vercel 控制台配置以下环境变量：

### 必需的环境变量

```bash
# Supabase 配置
SUPABASE_URL=https://bqbtkaljxsmdcpedrerg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxYnRrYWxqeHNtZGNwZWRyZXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDg0NDUsImV4cCI6MjA3NDAyNDQ0NX0._XIcJcSg_00b_iOs90QM5GNaKAg5_LEHGDrexDTFcMQ
SUPABASE_SERVICE_KEY=your-service-key-here

# 豆包 API 配置 - Doubao-Seed-1.6-flash 模式
ARK_API_KEY=3dafef81-fdc1-4148-bb39-87c396f94c2a

# 生产环境配置
NODE_ENV=production
PUBLIC_BASE_URL=https://your-app.vercel.app
```

### 在 Vercel 控制台设置环境变量

1. **访问 Vercel 控制台**
   - 登录 [vercel.com](https://vercel.com)
   - 选择你的项目

2. **进入环境变量设置**
   - 点击项目设置 (Settings)
   - 选择 "Environment Variables" 选项卡

3. **添加环境变量**
   按照上面的列表，逐一添加每个环境变量：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `ARK_API_KEY` ⭐ **这是新增的**
   - `NODE_ENV`
   - `PUBLIC_BASE_URL`

4. **重新部署**
   - 保存环境变量后
   - 触发重新部署：`vercel --prod`

## 🧪 测试新的 API 配置

### 本地测试
```bash
# 运行测试脚本
node test_doubao_seed.js
```

### 部署后测试
1. 访问你的 Vercel 应用
2. 上传一张菜品图片
3. 检查是否能正常识别并生成菜谱

## 🔍 故障排除

### 如果 API 调用失败：

1. **检查环境变量**
   ```bash
   # 在 Vercel 控制台检查环境变量是否正确设置
   ```

2. **检查 API 密钥**
   - 确认 `ARK_API_KEY` 正确设置
   - 确认密钥格式正确（无多余空格）

3. **检查网络连接**
   - 确认 Vercel 能访问豆包 API
   - 检查防火墙设置

### 常见错误解决：

**错误 1：API 密钥无效**
```
解决方案：检查 ARK_API_KEY 是否正确设置
```

**错误 2：网络超时**
```
解决方案：检查 Vercel 函数超时设置
```

**错误 3：CORS 错误**
```
解决方案：检查后端 CORS 配置
```

## 📊 性能优化建议

1. **API 调用优化**
   - 设置合适的超时时间
   - 添加重试机制
   - 缓存常见结果

2. **错误处理**
   - 添加详细的错误日志
   - 实现降级方案
   - 用户友好的错误提示

## 🎯 部署检查清单

- [ ] 环境变量已正确设置
- [ ] API 密钥有效
- [ ] 重新部署完成
- [ ] 健康检查通过
- [ ] 图片上传功能正常
- [ ] AI 识别功能正常
- [ ] 积分系统正常

现在你的应用已经配置了最新的 Doubao-Seed-1.6-flash 模式，应该能够提供更准确的菜品识别和菜谱生成功能！🎉
