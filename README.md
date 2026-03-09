# ChainLex.ai

> AI-driven RWA compliance platform with Chainlink CRE oracle integration

## CRE Workflow: LexOracle Risk Guard

The Chainlink CRE workflow lives in [`lexoracle-risk-guard/`](./lexoracle-risk-guard/). It provides DON-attested compliance data (Compliance Feed) for tokenized real-world assets.

- **Workflow:** [`lexoracle-risk-guard/risk-oracle/workflow.go`](./lexoracle-risk-guard/risk-oracle/workflow.go)
- **Project config:** [`project.yaml`](./project.yaml)
- **Contracts:** [`contracts/`](./contracts/) (ChainlinkRisk, uRWA, LexOracleConsumer, ComplianceVault)
- **Simulate:** `cd lexoracle-risk-guard && cre workflow simulate risk-oracle --target staging-settings`
- **Broadcast tx:** [`0xc0cb...1804`](https://sepolia.etherscan.io/tx/0xc0cb044ac59393c10e668b66d280ba152136ed2730e3843898bd0f6757aa1804) (real Sepolia transaction)

See [`lexoracle-risk-guard/README.md`](./lexoracle-risk-guard/README.md) for full architecture and deployment details.

---

> AI驱动的RWA代币合规发行工作台 - 让现实世界资产上链变得简单合规

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-green)](https://www.python.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8+-purple)](https://soliditylang.org/)

## 🌟 项目愿景

ChainLex.ai是一个革命性的AI驱动工作台，专门为现实世界资产（RWA）代币化发行而设计。我们结合了先进的AI技术和成熟的合规框架，让传统资产发行方能够轻松、快速、合规地将资产上链。

### 🎯 核心使命

- **降低门槛**：让非技术背景的传统机构也能轻松发行RWA代币
- **合规先行**：内置完整的合规文档生成和审查流程
- **AI赋能**：利用大语言模型自动化生成专业的法律和技术文档
- **端到端**：从文档起草到智能合约部署的一站式解决方案

## 🚀 快速开始

### 环境要求

- **Node.js**: 18.0+
- **pnpm**: 8.0+
- **Python**: 3.11+

### 1. 克隆项目

```bash
git clone https://github.com/your-org/chainlex-ai.git
cd chainlex-ai
```

### 2. 安装依赖

```bash
# 前端依赖
pnpm install

# Python后端依赖
cd chatbot
pip install -r requirements.txt
cd ..
```

### 3. 环境配置

创建 `.env.local` 文件（可选）：

```env
# AI服务 (如果使用OpenRouter)
OPENROUTER_API_KEY="your-openrouter-api-key"

# 数据库 (如果需要持久化存储)
NEON_DATABASE_URL="your-neon-database-url"
```

### 4. 启动服务

**启动AI后端服务** (端口8000)：
```bash
cd chatbot
python app.py
# 或
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

**启动前端应用** (端口3000)：
```bash
pnpm run dev
```

### 5. 访问应用

- 🌐 前端界面: http://localhost:3000
- 🔧 AI服务API: http://localhost:8000
- 📚 API文档: http://localhost:8000/docs

## 🏗️ 系统架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   前端 Next.js  │◄──►│   AI后端 FastAPI │◄──►│  内存状态管理    │
│                 │    │                  │    │                 │
│ • 合规工作台     │    │ • LangGraph Agent │    │ • 会话数据       │
│ • 合约生成器     │    │ • 文档生成       │    │ • 用户状态       │
│ • 进度追踪       │    │ • 状态管理       │    │ • 章节进度       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│  Web3 Integration│    │   OpenAI/KIMI    │
│                 │    │                  │
│ • wagmi + viem   │    │ • 文档起草       │
│ • WalletConnect  │    │ • 合规审查       │
│ • 多链支持       │    │ • 智能问答       │
└─────────────────┘    └──────────────────┘
```

## 🧠 AI技术原理

### LangGraph智能代理系统

我们采用了LangGraph框架构建了一个复杂的状态机系统：

```python
# 核心AI工作流
12章节文档生成 → 交互式编辑 → 合规审查 → 智能合约生成
```

**关键技术特性**：

1. **多轮对话管理**: 维护12个章节的上下文状态
2. **智能内容生成**: 基于用户输入自动生成专业的法律文档
3. **章节进度追踪**: 实时追踪文档生成进度
4. **内存状态管理**: 基于内存的会话状态持久化

### AI能力矩阵

| 功能模块 | AI技术 | 应用场景 |
|---------|--------|----------|
| 📝 文档生成 | OpenAI/KIMI API | RWA发行说明书起草 |
| 🔍 合规审查 | 内置知识库 | 监管要求匹配检查 |
| 💬 智能交互 | LangGraph Chain | 自然语言问答交互 |
| 📊 章节管理 | 状态机 | 12章节进度管理 |

## 🏛️ RWA技术实现

### ERC-7943代币标准

我们实现了最新的ERC-7943标准，专门为RWA代币设计：

```solidity
contract XAU_RWA_Token is ERC20, AccessControlEnumerable {
    // 🔒 合规控制机制
    mapping(address => bool) public whitelisted;
    mapping(address => uint256) public frozen;

    // 🛡️ 三重权限管理
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ENFORCER_ROLE = keccak256("ENFORCER_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = keccak256("DEFAULT_ADMIN_ROLE");
}
```

**核心合规特性**：

- ✅ **白名单机制**: 只有KYC验证用户可以参与交易
- 🧊 **资产冻结**: 监管要求的资产冻结功能
- 🔄 **强制转移**: 紧急情况下的资产强制转移
- 📊 **透明审计**: 完整的链上操作记录

### 多链部署支持

| 区块链 | 测试网 | 特性 | 状态 |
|--------|--------|------|------|
| Ethereum | Sepolia | 最成熟的DeFi生态 | ✅ 已支持 |
| BSC | BSC Testnet | 低费用高TPS | ✅ 已支持 |
| Avalanche | Fuji | 子网技术优势 | ✅ 已支持 |

## 📋 功能模块

### 1. 📊 合规工作台 (Compliance Workbench)

- **12章节文档生成**: 覆盖完整的RWA发行要求
- **AI辅助起草**: 智能填充专业法律条款
- **实时预览**: Markdown格式文档实时渲染
- **进度追踪**: 可视化的章节进度指示器

### 2. 🔧 合约生成器 (Contract Generator)

- **参数化配置**: 可视化配置代币参数
- **实时代码生成**: 基于配置动态生成Solidity代码
- **语法高亮**: 智能代码高亮和错误检测
- **一键部署**: 集成测试网部署功能

### 3. 📈 仪表板 (Dashboard)

- **合约监控**: 已部署合约的实时监控
- **事件追踪**: 链上事件的实时同步
- **数据分析**: 代币流通和持有人统计
- **风险预警**: 异常行为实时告警

## 🛠️ 技术栈

### 前端技术
- **Next.js 15**: React全栈框架，App Router
- **TypeScript**: 类型安全的JavaScript
- **Tailwind CSS**: 原子化CSS框架
- **shadcn/ui**: 高质量组件库
- **wagmi + viem**: 现代化Web3工具链

### 后端技术
- **FastAPI**: 高性能Python Web框架
- **LangGraph**: 复杂AI工作流编排
- **OpenAI/KIMI API**: 大语言模型接口
- **内存状态管理**: 基于内存的会话持久化
- **LangChain**: AI应用开发框架

### 区块链技术
- **Solidity 0.8**: 智能合约开发语言
- **ERC-7943**: RWA代币标准
- **OpenZeppelin**: 安全的合约库
- **Hardhat**: 合约开发和测试框架

## 🧪 开发指南

### 本地开发

```bash
# 启动开发环境
pnpm run dev          # 前端开发服务器
cd chatbot && python app.py  # AI后端服务

# 代码检查
pnpm run lint          # ESLint检查
pnpm run build         # 生产构建
```

### 测试

```bash
# 前端测试
pnpm run test          # 单元测试
pnpm run test:e2e      # 端到端测试

# 合约测试
cd contracts
npx hardhat test       # 智能合约测试
```

### 部署

```bash
# 前端部署 (Vercel)
vercel --prod

# 合约部署
npx hardhat run scripts/deploy.js --network mainnet
```

## 🤝 贡献指南

我们欢迎社区贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详细信息。

### 开发流程

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](./LICENSE) 文件了解详情。

## 🙏 致谢

- [LangChain](https://langchain.com/) - AI应用开发框架
- [KIMI AI](https://kimi.moonshot.cn/) - 强大的AI对话能力
- [Vercel](https://vercel.com/) - 优秀的部署平台
- [LangGraph](https://langchain-ai.github.io/langgraph/) - 状态机AI框架

## 📞 联系我们

- 🌐 项目主页: [ChainLex.ai](https://chainlex-ai.vercel.app)
- 📧 邮箱: contact@chainlex.ai
- 💬 Discord: [加入社区](https://discord.gg/chainlex-ai)
- 🐦 Twitter: [@ChainLexAI](https://twitter.com/chainlexai)

---

<div align="center">
  <p>🚀 让现实世界资产轻松上链，开启DeFi新纪元</p>
  <p>Made with ❤️ by the ChainLex.ai Team</p>
</div>