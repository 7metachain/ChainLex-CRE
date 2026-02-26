#!/bin/bash

# ChainLex.ai 快速启动脚本
# 用于同时启动前端和后端服务

set -e

echo "🚀 ChainLex.ai 启动脚本"
echo "========================"

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18.0+"
    exit 1
fi

# 检查pnpm
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm 未安装，正在安装..."
    npm install -g pnpm
fi

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 未安装，请先安装 Python 3.11+"
    exit 1
fi

# 获取项目根目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

echo "📦 项目目录: $PROJECT_ROOT"

# 检查前端依赖
if [ ! -d "node_modules" ]; then
    echo "📥 安装前端依赖..."
    pnpm install
fi

# 检查Python依赖
if [ ! -d "chatbot/venv" ]; then
    echo "📥 创建Python虚拟环境..."
    cd chatbot
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
else
    echo "✅ Python虚拟环境已存在"
fi

# 创建日志目录
mkdir -p logs

echo ""
echo "🔧 启动服务..."
echo ""

# 启动Python后端服务（后台运行）
echo "🐍 启动Python ChatBot服务 (端口 8000)..."
cd chatbot
source venv/bin/activate
python app.py > ../logs/chatbot.log 2>&1 &
CHATBOT_PID=$!
cd ..

# 等待后端服务启动
echo "⏳ 等待后端服务启动..."
sleep 3

# 检查后端服务是否启动成功
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ ChatBot服务启动成功 (PID: $CHATBOT_PID)"
else
    echo "⚠️  ChatBot服务可能未正常启动，请检查 logs/chatbot.log"
fi

# 启动前端服务
echo "⚛️  启动Next.js前端服务 (端口 3000)..."
echo ""
echo "=========================================="
echo "✅ 服务启动完成！"
echo ""
echo "📱 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:8000"
echo "📚 API文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo "=========================================="
echo ""

# 保存PID到文件
echo $CHATBOT_PID > .chatbot.pid

# 启动前端（前台运行，这样可以看到日志）
pnpm run dev

# 清理：当脚本退出时，停止后端服务
trap "echo ''; echo '🛑 正在停止服务...'; kill $CHATBOT_PID 2>/dev/null; rm -f .chatbot.pid; echo '✅ 服务已停止'; exit" INT TERM
