#!/bin/bash

# 自动部署脚本
# 使用方法: ./deploy.sh [platform]
# 支持的平台: vercel, railway, digitalocean, vps

set -e

PLATFORM=${1:-"vercel"}
PROJECT_DIR=$(pwd)

echo "🚀 开始部署到 $PLATFORM..."

# 检查必要的工具
check_requirements() {
    echo "📋 检查部署要求..."
    
    case $PLATFORM in
        "vercel")
            if ! command -v vercel &> /dev/null; then
                echo "❌ 请先安装 Vercel CLI: npm install -g vercel"
                exit 1
            fi
            ;;
        "railway")
            if ! command -v railway &> /dev/null; then
                echo "❌ 请先安装 Railway CLI: npm install -g @railway/cli"
                exit 1
            fi
            ;;
        "vps")
            if ! command -v pm2 &> /dev/null; then
                echo "❌ 请先安装 PM2: npm install -g pm2"
                exit 1
            fi
            ;;
    esac
    
    echo "✅ 环境检查通过"
}

# 准备环境变量
prepare_env() {
    echo "🔧 准备环境变量..."
    
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/env.production" ]; then
            cp backend/env.production backend/.env
            echo "📝 已复制生产环境配置到 .env"
        else
            echo "❌ 未找到环境配置文件，请先创建 backend/.env"
            exit 1
        fi
    fi
    
    echo "✅ 环境变量准备完成"
}

# Vercel 部署
deploy_vercel() {
    echo "🚀 部署到 Vercel..."
    
    # 检查是否已登录
    if ! vercel whoami &> /dev/null; then
        echo "🔐 请先登录 Vercel: vercel login"
        exit 1
    fi
    
    # 部署
    vercel --prod
    
    echo "✅ Vercel 部署完成"
    echo "📝 请在 Vercel 控制台配置环境变量："
    echo "   - SUPABASE_URL"
    echo "   - SUPABASE_ANON_KEY"
    echo "   - SUPABASE_SERVICE_KEY"
    echo "   - DOUBAO_API_KEY"
}

# Railway 部署
deploy_railway() {
    echo "🚂 部署到 Railway..."
    
    # 检查是否已登录
    if ! railway whoami &> /dev/null; then
        echo "🔐 请先登录 Railway: railway login"
        exit 1
    fi
    
    # 部署
    railway up
    
    echo "✅ Railway 部署完成"
    echo "📝 请在 Railway 控制台配置环境变量"
}

# DigitalOcean 部署
deploy_digitalocean() {
    echo "🌊 部署到 DigitalOcean..."
    
    if [ ! -f ".do/app.yaml" ]; then
        echo "❌ 未找到 DigitalOcean 应用配置文件"
        echo "请先创建 .do/app.yaml 文件"
        exit 1
    fi
    
    echo "📝 请手动在 DigitalOcean 控制台创建应用"
    echo "1. 访问 https://cloud.digitalocean.com/apps"
    echo "2. 创建新应用"
    echo "3. 上传代码或连接 GitHub"
    echo "4. 配置环境变量"
}

# VPS 部署
deploy_vps() {
    echo "🖥️ 部署到 VPS..."
    
    # 安装依赖
    echo "📦 安装依赖..."
    cd backend
    npm install --production
    cd ..
    
    # 启动应用
    echo "🚀 启动应用..."
    pm2 start backend/src/index.js --name "cook-assistant"
    pm2 save
    
    # 设置开机自启
    pm2 startup
    
    echo "✅ VPS 部署完成"
    echo "📝 请配置 Nginx 反向代理"
    echo "📝 请配置 SSL 证书"
}

# 主部署流程
main() {
    echo "🎯 开始部署流程..."
    
    check_requirements
    prepare_env
    
    case $PLATFORM in
        "vercel")
            deploy_vercel
            ;;
        "railway")
            deploy_railway
            ;;
        "digitalocean")
            deploy_digitalocean
            ;;
        "vps")
            deploy_vps
            ;;
        *)
            echo "❌ 不支持的平台: $PLATFORM"
            echo "支持的平台: vercel, railway, digitalocean, vps"
            exit 1
            ;;
    esac
    
    echo "🎉 部署完成！"
    echo "📖 详细说明请查看 DEPLOYMENT_GUIDE.md"
}

# 运行主流程
main