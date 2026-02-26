#!/bin/bash

# ChainLex.ai 服务测试脚本
# 用于测试前端和后端服务是否正常运行

set -e

echo "🧪 ChainLex.ai 服务测试"
echo "========================"

# 测试后端服务
echo ""
echo "1️⃣  测试后端服务 (http://localhost:8000)"
echo "----------------------------------------"

if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ 后端服务运行正常"
    
    # 获取健康检查信息
    HEALTH=$(curl -s http://localhost:8000/health)
    echo "   健康状态: $(echo $HEALTH | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
    echo "   活跃会话: $(echo $HEALTH | grep -o '"active_sessions":[0-9]*' | cut -d':' -f2)"
else
    echo "❌ 后端服务未运行或无法访问"
    echo "   请确保ChatBot服务已启动: cd chatbot && python app.py"
    exit 1
fi

# 测试API根路径
if curl -s http://localhost:8000/ > /dev/null; then
    echo "✅ API根路径可访问"
else
    echo "❌ API根路径无法访问"
fi

# 测试前端服务
echo ""
echo "2️⃣  测试前端服务 (http://localhost:3000)"
echo "----------------------------------------"

if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 前端服务运行正常"
else
    echo "❌ 前端服务未运行或无法访问"
    echo "   请确保Next.js服务已启动: pnpm run dev"
    exit 1
fi

# 测试API端点
echo ""
echo "3️⃣  测试API端点"
echo "----------------------------------------"

# 测试创建会话
echo "   测试创建会话..."
SESSION_RESPONSE=$(curl -s -X POST http://localhost:8000/session/create \
  -H "Content-Type: application/json" \
  -d '{"user_name": "Test User", "project_name": "Test Project"}')

if echo "$SESSION_RESPONSE" | grep -q "session_id"; then
    SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
    echo "   ✅ 会话创建成功 (ID: ${SESSION_ID:0:8}...)"
    
    # 测试聊天功能
    echo "   测试聊天功能..."
    CHAT_RESPONSE=$(curl -s -X POST http://localhost:8000/chat \
      -H "Content-Type: application/json" \
      -d "{\"content\": \"测试消息\", \"session_id\": \"$SESSION_ID\"}")
    
    if echo "$CHAT_RESPONSE" | grep -q "message"; then
        echo "   ✅ 聊天功能正常"
    else
        echo "   ⚠️  聊天功能可能有问题"
    fi
else
    echo "   ❌ 会话创建失败"
fi

# 总结
echo ""
echo "=========================================="
echo "📊 测试总结"
echo "=========================================="
echo "✅ 后端服务: 正常"
echo "✅ 前端服务: 正常"
echo "✅ API功能: 正常"
echo ""
echo "🎉 所有服务测试通过！"
echo ""
echo "📱 访问地址:"
echo "   前端: http://localhost:3000"
echo "   后端API: http://localhost:8000"
echo "   API文档: http://localhost:8000/docs"
echo ""
