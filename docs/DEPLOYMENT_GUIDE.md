# ChainLex.ai 本地部署指南

## 1. 环境要求

### 1.1 系统要求
- **操作系统**: macOS / Linux / Windows (WSL2)
- **Node.js**: 18.0+ 
- **pnpm**: 8.0+ (推荐使用pnpm，项目使用pnpm-lock.yaml)
- **Python**: 3.11+
- **Git**: 最新版本

### 1.2 可选依赖
- **Foundry**: 用于智能合约编译和部署（如果测试合约部署功能）
- **钱包扩展**: MetaMask 或其他Web3钱包

## 2. 快速开始

### 2.1 克隆项目

```bash
cd /Users/jchen/Documents/boshanlu_proj/ChainLex.ai
```

### 2.2 安装前端依赖

```bash
# 使用pnpm安装依赖
pnpm install

# 如果未安装pnpm，先安装：
npm install -g pnpm
```

### 2.3 安装Python后端依赖

```bash
cd chatbot
pip install -r requirements.txt
cd ..
```

**注意**: 如果使用Python虚拟环境（推荐）：
```bash
cd chatbot
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cd ..
```

### 2.4 环境变量配置

创建 `.env.local` 文件（如果不存在）：

```bash
# AI服务配置
OPENROUTER_API_KEY="your-openrouter-api-key"  # 可选，如果使用OpenRouter
# 或者配置OpenAI API Key（在chatbot中使用）

# 数据库配置（可选，如果使用Neon）
NEON_DATABASE_URL="your-neon-database-url"

# Web3配置（可选）
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your-walletconnect-id"
```

**注意**: 
- 如果只是测试前端功能，可以暂时不配置API Key
- ChatBot服务使用KIMI API（在chatbot.py中硬编码），如需修改请编辑 `chatbot/chatbot.py`

## 3. 启动服务

### 3.1 启动Python ChatBot服务

在项目根目录下：

```bash
cd chatbot
python app.py
# 或使用uvicorn
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

服务将在 `http://localhost:8000` 启动。

**验证服务**:
```bash
curl http://localhost:8000/
# 应该返回API信息
```

### 3.2 启动Next.js前端

在项目根目录下（新开一个终端）：

```bash
pnpm run dev
```

前端将在 `http://localhost:3000` 启动。

## 4. 功能测试

### 4.1 测试合规文档生成功能

1. **访问合规工作台**:
   - 打开浏览器访问 `http://localhost:3000/compliance`

2. **测试文件上传**:
   - 点击左侧文件上传区域
   - 上传一个PDF或DOCX文件（可选）

3. **测试AI对话**:
   - 在中间对话区域输入消息，例如："我想创建一个名为CCT的代币"
   - 观察AI助手的回复
   - 检查右侧文档预览是否更新

4. **测试会话管理**:
   - 点击"New Chat"按钮创建新会话
   - 检查localStorage是否保存了会话数据

**预期行为**:
- 如果ChatBot服务运行正常，AI会回复并引导完成12章节
- 如果ChatBot服务未运行，会显示离线模式提示

### 4.2 测试合约生成功能

1. **访问合约生成器**:
   - 打开 `http://localhost:3000/contracts`

2. **配置代币参数**:
   - 修改Token Name、Symbol、Initial Supply等参数
   - 观察右侧代码预览是否实时更新

3. **测试代码高亮**:
   - 修改参数时，观察相关代码段是否高亮显示

4. **测试部署功能**（需要配置钱包和Foundry）:
   - 连接MetaMask钱包
   - 选择测试网络（Sepolia）
   - 点击"Deploy Contract"
   - 观察部署对话框的输出

**注意**: 部署功能需要：
- 配置了正确的RPC URL和私钥（在 `app/api/contract/deploy/route.ts` 中）
- Foundry已安装并配置
- 有测试网ETH用于gas费用

### 4.3 测试Dashboard功能

1. **访问Dashboard**:
   - 打开 `http://localhost:3000/dashboard`

2. **查看合约列表**:
   - 左侧显示模拟的合约列表
   - 点击不同合约查看详情

3. **测试报告功能**:
   - 切换到"Monthly Report"或"SAR"标签
   - 点击"Preview"查看报告预览
   - 点击"Report"测试报告提交功能

4. **查看图表**:
   - 观察交易量折线图
   - 观察持有人分布饼图
   - 测试图表交互（鼠标悬停）

## 5. 常见问题排查

### 5.1 ChatBot服务无法连接

**症状**: 前端显示"ChatBot service offline"

**解决方案**:
1. 检查Python服务是否运行：
   ```bash
   curl http://localhost:8000/health
   ```

2. 检查端口是否被占用：
   ```bash
   lsof -i :8000  # macOS/Linux
   netstat -ano | findstr :8000  # Windows
   ```

3. 检查Python依赖是否完整：
   ```bash
   cd chatbot
   pip list | grep -E "fastapi|langchain|langgraph"
   ```

4. 查看Python服务日志，检查错误信息

### 5.2 前端无法启动

**症状**: `pnpm run dev` 报错

**解决方案**:
1. 检查Node.js版本：
   ```bash
   node -v  # 应该是18.0+
   ```

2. 清除缓存重新安装：
   ```bash
   rm -rf node_modules .next
   pnpm install
   ```

3. 检查端口3000是否被占用

### 5.3 AI对话无响应

**症状**: 发送消息后没有回复

**解决方案**:
1. 检查浏览器控制台是否有错误
2. 检查ChatBot API是否正常：
   ```bash
   curl -X POST http://localhost:8000/chat \
     -H "Content-Type: application/json" \
     -d '{"content": "test", "session_id": null}'
   ```

3. 检查KIMI API配置（在chatbot.py中）：
   - 确认API Key是否有效
   - 检查API endpoint是否正确

### 5.4 合约部署失败

**症状**: 部署时出现错误

**解决方案**:
1. 检查Foundry是否安装：
   ```bash
   forge --version
   ```

2. 检查部署脚本中的路径是否正确（`app/api/contract/deploy/route.ts`）
3. 检查RPC URL和私钥配置
4. 确认测试网账户有足够的ETH

## 6. 开发模式说明

### 6.1 前端热重载
- Next.js默认支持热重载
- 修改代码后自动刷新浏览器

### 6.2 Python服务热重载
- 使用 `uvicorn --reload` 启动时支持热重载
- 修改Python代码后自动重启服务

### 6.3 调试技巧

**前端调试**:
- 使用浏览器开发者工具
- 检查Network标签查看API请求
- 检查Console查看错误信息

**后端调试**:
- 查看终端输出的日志
- 使用Python调试器（pdb）：
  ```python
  import pdb; pdb.set_trace()
  ```

## 7. 生产环境部署准备

### 7.1 构建前端

```bash
pnpm run build
pnpm run start
```

### 7.2 配置环境变量

- 使用环境变量管理服务（如Vercel、Railway）
- 不要将敏感信息提交到代码仓库

### 7.3 数据库配置

- 配置Neon数据库连接
- 运行数据库迁移（如果使用Prisma）

### 7.4 安全配置

- 配置CORS策略
- 设置API限流
- 启用HTTPS
- 配置防火墙规则

## 8. 测试清单

完成部署后，请测试以下功能：

- [ ] 前端页面可以正常访问
- [ ] ChatBot服务可以正常响应
- [ ] 文件上传功能正常
- [ ] AI对话功能正常
- [ ] 文档预览功能正常
- [ ] 合约代码生成功能正常
- [ ] 参数修改时代码实时更新
- [ ] Dashboard可以正常显示
- [ ] 报告预览功能正常
- [ ] 图表交互正常

## 9. 下一步

部署成功后，你可以：

1. **自定义配置**:
   - 修改AI模型配置
   - 添加更多区块链网络
   - 自定义合规模板

2. **扩展功能**:
   - 集成真实的KYC服务
   - 添加更多报告模板
   - 实现数据持久化

3. **性能优化**:
   - 添加缓存层
   - 优化API响应时间
   - 实现增量更新

## 10. 获取帮助

如果遇到问题：

1. 查看项目README.md
2. 检查CLAUDE.md了解项目结构
3. 查看development-plan.md了解开发计划
4. 检查GitHub Issues（如果有）
