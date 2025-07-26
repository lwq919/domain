#!/bin/bash

echo "🚀 开始构建优化..."

# 检查Node.js版本
echo "📋 检查环境..."
node_version=$(node -v)
echo "Node.js版本: $node_version"

# 安装依赖
echo "📦 安装依赖..."
npm install

# 代码检查
echo "🔍 代码检查..."
npm run lint
npm run type-check

# 构建项目
echo "🏗️ 构建项目..."
npm run build

# 分析包大小
echo "📊 分析包大小..."
npm run analyze

echo "✅ 构建完成！"
echo ""
echo "📁 构建输出目录: dist/"
echo "📈 查看包大小分析结果"
echo "🌐 预览构建结果: npm run preview" 
