#!/bin/bash

# Vercel 一键部署脚本
# 使用方法: ./deploy_vercel.sh

set -e

echo "🚀 开始部署到 Vercel..."

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ 请先安装 Vercel CLI:"
    echo "npm install -g vercel"
    exit 1
fi

# 检查是否已登录
if ! vercel whoami &> /dev/null; then
    echo "🔐 请先登录 Vercel:"
    echo "vercel login"
    exit 1
fi

echo "✅ 环境检查通过"

# 提交代码更改
echo "📝 提交代码更改..."
git add .
git commit -m "更新 Doubao-Seed-1.6-flash 模式配置" || echo "没有新的更改需要提交"

# 推送到远程仓库
echo "📤 推送到远程仓库..."
git push

# 部署到 Vercel
echo "🚀 部署到 Vercel..."
vercel --prod

echo "✅ 部署完成！"
echo ""
echo "📋 接下来需要做的："
echo "1. 在 Vercel 控制台配置环境变量："
echo "   - ARK_API_KEY=3dafef81-fdc1-4148-bb39-87c396f94c2a"
echo "   - SUPABASE_URL=https://bqbtkaljxsmdcpedrerg.supabase.co"
echo "   - SUPABASE_ANON_KEY=你的-anon-key"
echo "   - SUPABASE_SERVICE_KEY=你的-service-key"
echo ""
echo "2. 测试部署结果："
echo "   - 访问你的 Vercel 应用 URL"
echo "   - 检查 /health 端点"
echo "   - 测试图片上传和 AI 识别功能"
echo ""
echo "📖 详细说明请查看 VERCEL_ENV_CONFIG.md"
