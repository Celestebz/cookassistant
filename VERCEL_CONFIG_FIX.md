# 🔧 Vercel 配置错误修复指南

## 问题描述
你遇到的错误：`The functions property cannot be used in conjunction with the builds property. Please remove one of them.`

这是因为在 `vercel.json` 中同时使用了 `functions` 和 `builds` 属性，Vercel 不允许这种配置。

## ✅ 解决方案

### 方案一：使用简化的 builds 配置（推荐）

使用当前的 `vercel.json` 配置（已修复）：
```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/src/index.js",
      "use": "@vercel/node",
      "config": {
        "maxDuration": 30
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/src/index.js"
    },
    {
      "src": "/jobs/(.*)",
      "dest": "backend/src/index.js"
    },
    {
      "src": "/auth/(.*)",
      "dest": "backend/src/index.js"
    },
    {
      "src": "/uploads/(.*)",
      "dest": "backend/src/index.js"
    },
    {
      "src": "/health",
      "dest": "backend/src/index.js"
    },
    {
      "src": "/",
      "dest": "webtest/index.html"
    },
    {
      "src": "/(.*)",
      "dest": "webtest/index.html"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 方案二：使用更简单的配置

如果方案一仍有问题，可以尝试使用 `vercel-simple.json`：
```bash
# 重命名配置文件
mv vercel.json vercel-old.json
mv vercel-simple.json vercel.json
```

### 方案三：使用现代配置格式

如果上述方案都不行，可以尝试使用 `vercel-modern.json`：
```bash
# 重命名配置文件
mv vercel.json vercel-old.json
mv vercel-modern.json vercel.json
```

## 🚀 重新部署步骤

1. **提交修复后的配置**
   ```bash
   git add .
   git commit -m "修复 Vercel 配置错误"
   git push
   ```

2. **重新部署到 Vercel**
   ```bash
   vercel --prod
   ```

3. **或者使用一键部署脚本**
   ```bash
   ./deploy_vercel.sh
   ```

## 🔍 故障排除

### 如果仍然出现配置错误：

1. **检查配置文件语法**
   ```bash
   # 验证 JSON 语法
   cat vercel.json | jq .
   ```

2. **尝试最简单的配置**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "backend/src/index.js",
         "use": "@vercel/node"
       }
     ]
   }
   ```

3. **检查 Vercel CLI 版本**
   ```bash
   vercel --version
   # 如果版本过旧，更新：
   npm install -g vercel@latest
   ```

### 常见错误解决：

**错误 1：路由配置错误**
```
解决方案：简化路由规则，避免复杂的正则表达式
```

**错误 2：构建失败**
```
解决方案：检查 Node.js 版本兼容性
```

**错误 3：环境变量未生效**
```
解决方案：在 Vercel 控制台重新设置环境变量
```

## 📊 部署后验证

部署成功后，请验证以下功能：

- [ ] 首页能正常加载
- [ ] API 端点响应正常：`/health`
- [ ] 用户注册功能正常
- [ ] 图片上传功能正常
- [ ] AI 识别功能正常（使用新的 Doubao-Seed-1.6-flash 模式）

## 🎯 下一步

1. **配置环境变量**（在 Vercel 控制台）：
   - `ARK_API_KEY=3dafef81-fdc1-4148-bb39-87c396f94c2a`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`

2. **测试部署结果**：
   - 访问你的 Vercel 应用 URL
   - 测试所有功能是否正常

现在配置错误应该已经修复了！🎉
