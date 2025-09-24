# 🚀 应用部署指南

## 项目概述
这是一个 AI 烹饪助手应用，包含：
- **后端**：Node.js + Fastify API 服务器
- **前端**：HTML/JavaScript 单页应用
- **数据库**：Supabase PostgreSQL
- **AI 服务**：豆包 API

## 📋 部署前准备

### 1. 环境变量配置
创建生产环境配置文件：

```bash
# 复制环境变量模板
cp backend/env.example backend/.env.production
```

编辑 `backend/.env.production`：
```env
# Supabase配置
SUPABASE_URL=https://bqbtkaljxsmdcpedrerg.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# 豆包API配置
DOUBAO_API_KEY=your-doubao-api-key

# 生产环境配置
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://your-domain.com
```

### 2. 数据库准备
确保 Supabase 数据库表已创建（参考 `SUPABASE_SETUP.md`）

---

## 🎯 方案一：Vercel 部署（推荐）

### 步骤 1：准备 Vercel 配置

创建 `vercel.json`：
```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/src/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/src/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "webtest/index_with_auth.html"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 步骤 2：部署到 Vercel

1. **安装 Vercel CLI**：
```bash
npm install -g vercel
```

2. **登录 Vercel**：
```bash
vercel login
```

3. **部署项目**：
```bash
vercel --prod
```

4. **配置环境变量**：
在 Vercel 控制台中设置：
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `DOUBAO_API_KEY`

### 步骤 3：自定义域名
1. 在 Vercel 控制台添加自定义域名
2. 更新 `PUBLIC_BASE_URL` 环境变量

---

## 🚂 方案二：Railway 部署

### 步骤 1：准备 Railway 配置

Railway 会自动检测 `railway.json` 配置。

### 步骤 2：部署到 Railway

1. **连接 GitHub**：
   - 访问 [Railway](https://railway.app)
   - 连接你的 GitHub 仓库

2. **自动部署**：
   - Railway 会自动检测 Node.js 项目
   - 自动安装依赖并启动

3. **配置环境变量**：
   在 Railway 控制台设置所有必要的环境变量

### 步骤 3：获取部署 URL
Railway 会提供一个 `https://your-app.railway.app` 的 URL

---

## 🌊 方案三：DigitalOcean App Platform

### 步骤 1：创建 App Spec

创建 `.do/app.yaml`：
```yaml
name: cook-assistant
services:
- name: api
  source_dir: /backend
  github:
    repo: your-username/your-repo
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: SUPABASE_URL
    value: your-supabase-url
  - key: SUPABASE_ANON_KEY
    value: your-anon-key
  - key: SUPABASE_SERVICE_KEY
    value: your-service-key
  - key: DOUBAO_API_KEY
    value: your-doubao-key
  - key: PUBLIC_BASE_URL
    value: https://your-app.ondigitalocean.app

static_sites:
- name: frontend
  source_dir: /webtest
  github:
    repo: your-username/your-repo
    branch: main
  build_command: echo "No build required"
  output_dir: /
```

### 步骤 2：部署到 DigitalOcean

1. 访问 [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. 创建新应用
3. 上传或连接 GitHub 仓库
4. 配置环境变量

---

## 🖥️ 方案四：自建 VPS 部署

### 步骤 1：服务器准备

**推荐服务器配置**：
- **CPU**: 1-2 核
- **内存**: 1-2GB
- **存储**: 20GB SSD
- **系统**: Ubuntu 20.04+

### 步骤 2：安装必要软件

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2 进程管理器
sudo npm install -g pm2

# 安装 Nginx
sudo apt install nginx -y
```

### 步骤 3：部署应用

```bash
# 克隆项目
git clone https://github.com/your-username/your-repo.git
cd your-repo

# 安装依赖
cd backend
npm install --production

# 配置环境变量
cp env.example .env
# 编辑 .env 文件

# 启动应用
pm2 start src/index.js --name "cook-assistant"
pm2 save
pm2 startup
```

### 步骤 4：配置 Nginx

创建 `/etc/nginx/sites-available/cook-assistant`：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # API 代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静态文件
    location / {
        root /path/to/your-project/webtest;
        index index_with_auth.html;
        try_files $uri $uri/ /index_with_auth.html;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/cook-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 步骤 5：配置 SSL（可选）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com
```

---

## 🔧 部署后配置

### 1. 更新前端配置

编辑 `webtest/index_with_auth.html`，更新 API 地址：
```javascript
// 将 localhost 替换为你的域名
const API_BASE_URL = 'https://your-domain.com';
```

### 2. 测试部署

1. **健康检查**：
   ```bash
   curl https://your-domain.com/health
   ```

2. **API 测试**：
   ```bash
   curl https://your-domain.com/
   ```

3. **前端测试**：
   访问 `https://your-domain.com`

### 3. 监控和维护

**使用 PM2 监控**：
```bash
pm2 status
pm2 logs cook-assistant
pm2 monit
```

**设置自动重启**：
```bash
pm2 startup
pm2 save
```

---

## 🚨 故障排除

### 常见问题

1. **端口冲突**：
   - 检查端口是否被占用
   - 修改 `PORT` 环境变量

2. **环境变量未生效**：
   - 重启应用服务
   - 检查变量名拼写

3. **数据库连接失败**：
   - 检查 Supabase 配置
   - 验证网络连接

4. **静态文件 404**：
   - 检查文件路径
   - 验证 Nginx 配置

### 日志查看

```bash
# PM2 日志
pm2 logs cook-assistant

# Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 📊 性能优化

### 1. 启用 Gzip 压缩

在 Nginx 配置中添加：
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

### 2. 设置缓存

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. 数据库连接池

在 `backend/src/index.js` 中优化 Supabase 连接配置。

---

## 🔒 安全建议

1. **使用 HTTPS**：所有生产环境必须使用 SSL
2. **环境变量安全**：不要在代码中硬编码敏感信息
3. **防火墙配置**：只开放必要端口
4. **定期更新**：保持系统和依赖包最新
5. **备份策略**：定期备份数据库和代码

---

## 📞 技术支持

如果遇到部署问题，请检查：
1. 环境变量是否正确配置
2. 端口是否可访问
3. 数据库连接是否正常
4. 日志中的错误信息

选择最适合你需求的部署方案，开始部署你的 AI 烹饪助手应用吧！🎉
