#!/bin/bash

echo "🚀 开始部署修复版本..."

# 检查Git状态
echo "📋 检查Git状态..."
git status

# 添加所有更改
echo "📝 添加所有更改..."
git add .

# 提交更改
echo "💾 提交更改..."
git commit -m "fix: 修复健康检查失败问题

- 简化健康检查端点，避免数据库连接问题
- 添加根路径健康检查端点
- 增加启动延迟和错误处理
- 更新Railway配置，使用正确的健康检查路径
- 延长健康检查超时时间到300秒"

# 推送到远程仓库
echo "📤 推送到远程仓库..."
git push origin main

echo "✅ 部署完成！请检查Railway部署状态。"
echo "🔗 健康检查端点: /health"
echo "🔗 根路径端点: /"
echo "⏱️ 健康检查超时: 300秒"
