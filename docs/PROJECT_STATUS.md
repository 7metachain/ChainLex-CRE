# 项目进度

> 分支：`codex/mock-oracle-closed-loop`
> 更新日期：2026-02-26

---

## 一、项目架构总览

ChainLex.ai 由三个核心模块组成：

| 模块 | 定位 | 一句话描述 |
|------|------|-----------|
| **LexStudio** | Automated Legal Engineering | 将法律文本转化为可执行的智能合约逻辑 |
| **LexOracle** | Hybrid Oracle Framework | 将链下合规数据（KYC/AML）喂入链上合约 |
| **LexEnforcer** | Legally Binding Execution | 链上触发条件满足时，自动执行强制性法律动作 |

三个模块的数据流关系：

```
LexStudio (生成合约)
    ↓ 部署
链上合约 (uRWA + ChainlinkRisk)
    ↓ Transfer 事件
LexOracle (获取风控数据 → 写回链上)
    ↓ RiskAssessmentUpdated 事件
LexEnforcer (冻结代币 / 生成 SAR / 通知监管)
    ↓
Dashboard (实时展示)
```

---

## 二、各模块完成度概览

| 模块 | 完成度 | 状态 |
|------|--------|------|
| LexStudio | ~70% | 核心功能可用，合约部署路径需修复 |
| **LexOracle** | **~45%** | **链下数据流已通，链上闭环未完成** |
| LexEnforcer | ~10% | 合约函数已有，自动触发逻辑不存在 |
| Dashboard | ~50% | 已改造为真实 API 数据驱动 |

---

## 三、LexOracle 详细进度（重点）

### 3.1 架构设计

LexOracle 的完整闭环：

```
① 链上事件 (Transfer)
    ↓
② CRE Workflow / 本地 Daemon（监听事件）
    ↓
③ 调用外部风控 API（GoPlus / Mock）
    ↓
④ DON 共识聚合（CRE 特有）
    ↓
⑤ 写回 ChainlinkRisk.updateRiskAssessment()
    ↓
⑥ 链上 emit RiskAssessmentUpdated 事件
    ↓
⑦ Dashboard 实时展示
```

### 3.2 已完成的部分

#### ✅ 链上合约：ChainlinkRisk.sol

- **文件**：`contracts/ChainlinkRisk.sol`（333 行）
- 完整的风险数据结构：`RiskAssessment`（level, score, lastUpdated, reason, isBlacklisted）
- 五档风险等级：`UNKNOWN → LOW → MEDIUM → HIGH → BLOCKED`
- `updateRiskAssessment()`：授权调用者写入风控数据
- `isUserAllowed()` / `isTransferAllowed()`：查询接口，被 uRWA 合约调用
- `emergencyFreeze()` / `clearRiskAssessment()`：应急管理功能
- `getBatchRiskAssessments()`：批量查询
- 事件：`RiskAssessmentUpdated`、`ChainlinkConfigUpdated`、`RiskThresholdUpdated`

#### ✅ 链上合约：uRWA.sol 与 ChainlinkRisk 集成

- **文件**：`contracts/uRWA.sol`（434 行）
- `_update()` 重写：每次转账自动检查 `isTransferAllowed()`
- `mint()` / `forceTransfer()`：调用 `isUserAllowed()` 检查
- 双模式切换：`enableRiskAssessment` + `enableWhitelist`，优雅降级

#### ✅ Mock 风控 API（Python 后端）

- **文件**：`chatbot/app.py` → `POST /risk-assessment`
- 接收钱包地址，返回确定性风险评分（同一地址结果可复现）
- 评分映射：0-399 LOW / 400-699 MEDIUM / 700-899 HIGH / 900+ BLOCKED
- 特殊规则：地址末尾为 `dead` 自动标记为制裁黑名单
- 返回完整的 `RiskAssessmentResponse`（score, level, is_blacklisted, reason, assessed_at）

#### ✅ Next.js Oracle API 层

- **`POST /api/oracle/mock-assess`**（`app/api/oracle/mock-assess/route.ts`）
  - 前端调用入口 → 转发到 Python `/risk-assessment` → 记录结果到数据库/内存
- **`GET /api/oracle/attestations`**（`app/api/oracle/attestations/route.ts`）
  - 查询历史风控记录，支持分页（最多 100 条）

#### ✅ 数据持久化层

- **文件**：`lib/oracle-attestations.ts`
- `OracleAttestation` 类型定义：id, walletAddress, chain, provider, score, level, isBlacklisted, reason, status, createdAt
- 双模式存储：
  - 有 `NEON_DATABASE_URL` → 自动建表，写入 Postgres
  - 无数据库 → 回退到内存存储（`globalThis` 数组）
- 提供 `recordOracleAttestation()` + `listOracleAttestations()` 

#### ✅ 前端 Oracle Monitor 组件

- **文件**：`components/dashboard/oracle-monitor.tsx`
- 输入钱包地址 + "Assess Risk" 按钮，手动触发评估
- 实时展示所有历史风控记录（地址、评分、风险等级 Badge、原因、时间）
- 已集成到 `/dashboard` 页面

#### ✅ CRE 本地模拟器（Go）

- **文件**：`cre/local-runner/main.go`
- 命令行工具：`go run . -wallet 0x...`
- 调用 Python 的 `/risk-assessment` API
- 输出 JSON 格式的风控结果

#### ✅ Dashboard Overview 改造

- **文件**：`components/dashboard/overview.tsx`
- 已从硬编码 `MOCK_CONTRACTS` 改为从 `/api/dashboard/overview` 获取真实数据
- 4 个统计卡片（Total Deployments, Deployed, Oracle Checks, High Risk Alerts）
- Oracle 风控记录表格（地址、链、评分、等级、原因、时间）
- 图表改为基于真实 attestation 数据：风险评分趋势折线图 + 风险等级分布饼图
- 15 秒自动轮询刷新

### 3.3 未完成的部分

#### ❌ 链上事件监听（自动触发）

**现状**：所有风控评估都需要手动触发（前端点按钮 或 命令行运行 Go 工具）。

**需要做**：
- `cre/local-runner/main.go` 改为 long-running daemon
- 用 `go-ethereum/ethclient` 订阅 Sepolia 上 `uRWA` 合约的 `Transfer` 事件
- 监听到 Transfer 后自动调用风控 API

**涉及文件**：`cre/local-runner/main.go`（需大幅改造）

#### ❌ 链上写入（写回 ChainlinkRisk）

**现状**：风控结果只存在 Next.js 的内存/数据库中，没有写回链上合约。

**需要做**：
- Go daemon 获取风控结果后，用 `abigen` 生成的 Go 绑定调用 `ChainlinkRisk.updateRiskAssessment()`
- 需要一个有 `authorizedCaller` 权限的私钥来签名交易
- 或部署一个 `CREReportReceiver` 中间合约

**涉及文件**：
- `cre/local-runner/main.go`（新增链上写入逻辑）
- `contracts/ChainlinkRisk.sol`（需将 CRE 地址加为 authorizedCaller）

#### ❌ Chainlink Aggregator 配置

**现状**：`ChainlinkRisk.sol` 中 `config.riskScoreAggregator` 和 `config.blacklistAggregator` 默认为 `address(0)`，`getRiskScoreFromChainlink()` 和 `getBlacklistStatusFromChainlink()` 永远返回默认值。

**需要做**：
- 部署后调用 `setChainlinkConfig()` 配置真实的 Aggregator 地址
- 或直接通过 `updateRiskAssessment()` 喂数据（绕过 Aggregator，当前的可行路径）

#### ❌ 真实风控 API 集成

**现状**：使用 Mock 风控 API（基于地址哈希生成确定性假评分）。

**可选真实数据源**：
- GoPlus Security API（免费，无需审批）：`GET https://api.gopluslabs.io/api/v1/address_security/{address}`
- OFAC 制裁名单（免费，官方公开数据）
- Chainalysis / Elliptic / TRM Labs（企业付费，需商务对接）

**涉及文件**：`chatbot/app.py` 的 `/risk-assessment` 端点

#### ❌ CRE WASM 编译与 DON 部署

**现状**：`cre/local-runner/main.go` 是普通 Go 程序，不是 CRE Workflow。

**需要做**：
- 安装 CRE SDK（`github.com/smartcontractkit/chainlink-cre/sdk`）
- 将逻辑迁移到 CRE `Workflow()` 函数格式
- 编译为 WASM：`GOOS=wasip1 GOARCH=wasm go build -o risk-workflow.wasm .`
- 用 `cre-cli deploy` 注册到 DON

**注意**：CRE SDK 目前仍处于 Early Access 阶段，本地模拟可以先用当前方案。

#### ❌ DON 共识聚合


**需要做**：CRE Workflow 中使用 `consensusMedianAggregation`，多个 DON 节点各自调用风控 API，对结果取中值共识。这是部署到 DON 后才需要的，本地模拟可跳过。

---

## 四、LexStudio 进度

### 已完成
- ✅ `/compliance` 页面：三栏布局（文件上传 + AI 聊天 + 文档预览）
- ✅ Python Chatbot 后端（FastAPI + LangGraph）：12 章节引导式合规文档生成
- ✅ 多法域支持（HK / SG / US / AE）
- ✅ Markdown / PDF 导出
- ✅ `/contracts` 页面：ERC-7943 合约参数配置 + 实时代码预览
- ✅ 合约部署 API（`/api/contract/deploy`）：Foundry `forge create` 流式部署

### 未完成
- ❌ 部署路径硬编码为 `/Users/bi4o/Desktop/ETHshanghai/Fcontracts`（另一台机器），本机无法运行
- ❌ Private Key / Etherscan API Key 硬编码在源码中，安全隐患

---

## 五、LexEnforcer 进度

### 已完成
- ✅ `uRWA.sol` 中 `setFrozen()` 函数：冻结用户代币
## 一、项目架构总览

ChainLex.ai 由三个核心模块组成：

| 模块 | 定位 | 一句话描述 |
|------|------|-----------|
| **LexStudio** | Automated Legal Engineering | 将法律文本转化为可执行的智能合约逻辑 |
| **LexOracle** | Hybrid Oracle Framework | 将链下合规数据（KYC/AML）喂入链上合约 |
| **LexEnforcer** | Legally Binding Execution | 链上触发条件满足时，自动执行强制性法律动作 |

三个模块的数据流关系：

```
LexStudio (生成合约)
    ↓ 部署
链上合约 (uRWA + ChainlinkRisk)
    ↓ Transfer 事件
LexOracle (获取风控数据 → 写回链上)
    ↓ RiskAssessmentUpdated 事件
LexEnforcer (冻结代币 / 生成 SAR / 通知监管)
    ↓
Dashboard (实时展示)
```

---

## 二、各模块完成度概览

| 模块 | 完成度 | 状态 |
|------|--------|------|
| LexStudio | ~70% | 核心功能可用，合约部署路径需修复 |
| **LexOracle** | **~45%** | **链下数据流已通，链上闭环未完成** |
| LexEnforcer | ~10% | 合约函数已有，自动触发逻辑不存在 |
| Dashboard | ~50% | 已改造为真实 API 数据驱动 |

---

## 三、LexOracle 详细进度

### 3.1 架构设计

LexOracle 的完整闭环：

```
① 链上事件 (Transfer)
    ↓
② CRE Workflow / 本地 Daemon（监听事件）
    ↓
③ 调用外部风控 API（GoPlus / Mock）
    ↓
④ DON 共识聚合（CRE 特有）
    ↓
⑤ 写回 ChainlinkRisk.updateRiskAssessment()
    ↓
⑥ 链上 emit RiskAssessmentUpdated 事件
    ↓
⑦ Dashboard 实时展示
```

### 3.2 已完成的部分

#### ✅ 链上合约：ChainlinkRisk.sol

- **文件**：`contracts/ChainlinkRisk.sol`（333 行）
- 完整的风险数据结构：`RiskAssessment`（level, score, lastUpdated, reason, isBlacklisted）
- 五档风险等级：`UNKNOWN → LOW → MEDIUM → HIGH → BLOCKED`
- `updateRiskAssessment()`：授权调用者写入风控数据
- `isUserAllowed()` / `isTransferAllowed()`：查询接口，被 uRWA 合约调用
- `emergencyFreeze()` / `clearRiskAssessment()`：应急管理功能
- `getBatchRiskAssessments()`：批量查询
- 事件：`RiskAssessmentUpdated`、`ChainlinkConfigUpdated`、`RiskThresholdUpdated`

#### ✅ 链上合约：uRWA.sol 与 ChainlinkRisk 集成

- **文件**：`contracts/uRWA.sol`（434 行）
- `_update()` 重写：每次转账自动检查 `isTransferAllowed()`
- `mint()` / `forceTransfer()`：调用 `isUserAllowed()` 检查
- 双模式切换：`enableRiskAssessment` + `enableWhitelist`，优雅降级

#### ✅ Mock 风控 API（Python 后端）

- **文件**：`chatbot/app.py` → `POST /risk-assessment`
- 接收钱包地址，返回确定性风险评分（同一地址结果可复现）
- 评分映射：0-399 LOW / 400-699 MEDIUM / 700-899 HIGH / 900+ BLOCKED
- 特殊规则：地址末尾为 `dead` 自动标记为制裁黑名单
- 返回完整的 `RiskAssessmentResponse`（score, level, is_blacklisted, reason, assessed_at）

#### ✅ Next.js Oracle API 层

- **`POST /api/oracle/mock-assess`**（`app/api/oracle/mock-assess/route.ts`）
  - 前端调用入口 → 转发到 Python `/risk-assessment` → 记录结果到数据库/内存
- **`GET /api/oracle/attestations`**（`app/api/oracle/attestations/route.ts`）
  - 查询历史风控记录，支持分页（最多 100 条）

#### ✅ 数据持久化层

- **文件**：`lib/oracle-attestations.ts`
- `OracleAttestation` 类型定义：id, walletAddress, chain, provider, score, level, isBlacklisted, reason, status, createdAt
- 双模式存储：
  - 有 `NEON_DATABASE_URL` → 自动建表，写入 Postgres
  - 无数据库 → 回退到内存存储（`globalThis` 数组）
- 提供 `recordOracleAttestation()` + `listOracleAttestations()` 函数

#### ✅ 前端 Oracle Monitor 组件

- **文件**：`components/dashboard/oracle-monitor.tsx`
- 输入钱包地址 + "Assess Risk" 按钮，手动触发评估
- 实时展示所有历史风控记录（地址、评分、风险等级 Badge、原因、时间）
- 已集成到 `/dashboard` 页面

#### ✅ CRE 本地模拟器（Go）

- **文件**：`cre/local-runner/main.go`
- 命令行工具：`go run . -wallet 0x...`
- 调用 Python 的 `/risk-assessment` API
- 输出 JSON 格式的风控结果

#### ✅ Dashboard Overview 改造

- **文件**：`components/dashboard/overview.tsx`
- 已从硬编码 `MOCK_CONTRACTS` 改为从 `/api/dashboard/overview` 获取真实数据
- 4 个统计卡片（Total Deployments, Deployed, Oracle Checks, High Risk Alerts）
- Oracle 风控记录表格（地址、链、评分、等级、原因、时间）
- 图表改为基于真实 attestation 数据：风险评分趋势折线图 + 风险等级分布饼图
- 15 秒自动轮询刷新

### 3.3 未完成的部分

#### ❌ 链上事件监听（自动触发）

**现状**：所有风控评估都需要手动触发（前端点按钮 或 命令行运行 Go 工具）。

**需要做**：
- `cre/local-runner/main.go` 改为 long-running daemon
- 用 `go-ethereum/ethclient` 订阅 Sepolia 上 `uRWA` 合约的 `Transfer` 事件
- 监听到 Transfer 后自动调用风控 API

**涉及文件**：`cre/local-runner/main.go`（需大幅改造）

#### ❌ 链上写入（写回 ChainlinkRisk）

**现状**：风控结果只存在 Next.js 的内存/数据库中，没有写回链上合约。

**需要做**：
- Go daemon 获取风控结果后，用 `abigen` 生成的 Go 绑定调用 `ChainlinkRisk.updateRiskAssessment()`
- 需要一个有 `authorizedCaller` 权限的私钥来签名交易
- 或部署一个 `CREReportReceiver` 中间合约

**涉及文件**：
- `cre/local-runner/main.go`（新增链上写入逻辑）
- `contracts/ChainlinkRisk.sol`（需将 CRE 地址加为 authorizedCaller）

#### ❌ Chainlink Aggregator 配置

**现状**：`ChainlinkRisk.sol` 中 `config.riskScoreAggregator` 和 `config.blacklistAggregator` 默认为 `address(0)`，`getRiskScoreFromChainlink()` 和 `getBlacklistStatusFromChainlink()` 永远返回默认值。

**需要做**：
- 部署后调用 `setChainlinkConfig()` 配置真实的 Aggregator 地址
- 或直接通过 `updateRiskAssessment()` 喂数据（绕过 Aggregator，当前的可行路径）

#### ❌ 真实风控 API 集成

**现状**：使用 Mock 风控 API（基于地址哈希生成确定性假评分）。

**可选真实数据源**：
- GoPlus Security API（免费，无需审批）：`GET https://api.gopluslabs.io/api/v1/address_security/{address}`
- OFAC 制裁名单（免费，官方公开数据）
- Chainalysis / Elliptic / TRM Labs（企业付费，需商务对接）

**涉及文件**：`chatbot/app.py` 的 `/risk-assessment` 端点

#### ❌ CRE WASM 编译与 DON 部署

**现状**：`cre/local-runner/main.go` 是普通 Go 程序，不是 CRE Workflow。

**需要做**：
- 安装 CRE SDK（`github.com/smartcontractkit/chainlink-cre/sdk`）
- 将逻辑迁移到 CRE `Workflow()` 函数格式
- 编译为 WASM：`GOOS=wasip1 GOARCH=wasm go build -o risk-workflow.wasm .`
- 用 `cre-cli deploy` 注册到 DON

**注意**：CRE SDK 目前仍处于 Early Access 阶段，本地模拟可以先用当前方案。

#### ❌ DON 共识聚合

**现状**：不存在。

**需要做**：CRE Workflow 中使用 `consensusMedianAggregation`，多个 DON 节点各自调用风控 API，对结果取中值共识。这是部署到 DON 后才需要的，本地模拟可跳过。

---

## 四、LexStudio 进度

### 已完成
- ✅ `/compliance` 页面：三栏布局（文件上传 + AI 聊天 + 文档预览）
- ✅ Python Chatbot 后端（FastAPI + LangGraph）：12 章节引导式合规文档生成
- ✅ 多法域支持（HK / SG / US / AE）
- ✅ Markdown / PDF 导出
- ✅ `/contracts` 页面：ERC-7943 合约参数配置 + 实时代码预览
- ✅ 合约部署 API（`/api/contract/deploy`）：Foundry `forge create` 流式部署

### 未完成
- ❌ 部署路径硬编码为 `/Users/bi4o/Desktop/ETHshanghai/Fcontracts`（另一台机器），本机无法运行
- ❌ Private Key / Etherscan API Key 硬编码在源码中，安全隐患

---

## 五、LexEnforcer 进度

### 已完成
- ✅ `uRWA.sol` 中 `setFrozen()` 函数：冻结用户代币
- ✅ `uRWA.sol` 中 `forceTransfer()` 函数：强制转移代币（合规追回场景）
- ✅ `ChainlinkRisk.sol` 中 `emergencyFreeze()` 函数：紧急冻结高风险地址
- ✅ Dashboard 中 SAR（可疑活动报告）模板预览功能（`/markdowns/SAR.md`）
- ✅ Dashboard 中 Monthly Report 模板预览功能（`/markdowns/Monthly.md`）
- ✅ Dashboard 中 "Report to Exchange / Regulatory Agency" 按钮交互

### 未完成
- ❌ **自动触发逻辑**：没有任何代码监听 `RiskAssessmentUpdated` 事件来自动执行冻结/报告
- ❌ **CRE Workflow B**：LexEnforcer 需要一个独立的 CRE Workflow，监听 `RiskAssessmentUpdated` 事件，当 `level >= HIGH` 时自动调用 `setFrozen()` 并生成 SAR
- ❌ **SAR 动态生成**：当前 SAR 报告是静态 Markdown 模板，应基于风控数据动态填充（涉事地址、评分、交易详情）
- ❌ **监管通知集成**：Report to Exchange / Regulatory 按钮目前只改变前端状态，没有实际的 API 调用或邮件/webhook 通知

### LexEnforcer 与 LexOracle 的依赖关系

LexEnforcer 的触发源是 LexOracle 写入链上后产生的 `RiskAssessmentUpdated` 事件。因此：

```
LexOracle 的链上写入（第 3.3 节 ❌ 项）完成之前，
LexEnforcer 的自动触发逻辑无法运行。
```

优先级：先完成 LexOracle 的链上闭环，再建设 LexEnforcer。

---

## 六、Dashboard 进度

### 已完成
- ✅ 从硬编码 `MOCK_CONTRACTS` 改为调用 `/api/dashboard/overview` API 获取真实数据
- ✅ 4 个统计卡片：Total Deployments / Deployed / Oracle Checks / High Risk Alerts
- ✅ Deployment 列表（左侧栏）：展示真实部署记录，支持搜索过滤
- ✅ Oracle 风控记录表格：展示 wallet、chain、score、level（带颜色 Badge）、reason、time
- ✅ 风险评分趋势折线图（基于真实 attestation 数据）
- ✅ 风险等级分布饼图（LOW / MEDIUM / HIGH / BLOCKED 分布）
- ✅ 15 秒自动轮询刷新
- ✅ Oracle Monitor 组件：手动输入地址触发风控评估 + 实时展示结果
- ✅ 报告预览功能：Monthly Report / SAR 的 Markdown 渲染
- ✅ Report to Authority 对话框（Exchange / Regulatory Agency）

### 未完成
- ❌ **链上事件实时监听**：Dashboard 不读取链上事件，只从后端 API 拉取（通过轮询）
- ❌ **合约地址展示**：Deployment 列表不显示已部署合约的链上地址（`lib/db.ts` 的 `DeploymentRecord` 中缺少 `contractAddress` 字段）
- ❌ **链上数据读取**：不读取合约的 `totalSupply()`、`balanceOf()` 等链上状态

---

## 七、基础设施进度

### 已完成
- ✅ Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn/ui
- ✅ Python FastAPI 后端（chatbot + mock 风控 API）
- ✅ wagmi + viem 配置（`lib/wagmi.ts`，支持 Sepolia / Base Sepolia / Polygon Amoy）
- ✅ Neon Postgres 数据层（`lib/db.ts` + `lib/oracle-attestations.ts`），支持无数据库回退
- ✅ OpenRouter AI 集成（替换了过期的 iflow.cn API）
- ✅ CRE 本地模拟器骨架（`cre/local-runner/`）

### 未完成
- ❌ 数据库未配置（`NEON_DATABASE_URL` 为空，所有数据存在内存中，重启丢失）
- ❌ 合约部署路径硬编码为另一台机器的路径
- ❌ 无测试（前端、后端、合约均无测试覆盖）
- ❌ 无 CI/CD 配置

---

## 八、待办优先级排序（Hackathon 视角）

### P0 — 必须完成（构成 Demo 核心故事线）

| # | 任务 | 预计耗时 | 所属模块 |
|---|------|---------|---------|
| 1 | CRE daemon 监听 Transfer 事件 | 1 天 | LexOracle |
| 2 | CRE daemon 获取风控结果后写回 ChainlinkRisk 合约 | 1 天 | LexOracle |
| 3 | 将合约部署到 Sepolia 并配置 authorizedCaller | 0.5 天 | LexOracle |
| 4 | 端到端演示：Transfer → 自动风控 → 链上更新 → Dashboard 展示 | 0.5 天 | 全链路 |

### P1 — 强烈建议（提升 Demo 说服力）

| # | 任务 | 预计耗时 | 所属模块 |
|---|------|---------|---------|
| 5 | 替换 Mock API 为 GoPlus 真实风控数据 | 0.5 天 | LexOracle |
| 6 | LexEnforcer 自动冻结高风险地址 | 1 天 | LexEnforcer |
| 7 | SAR 报告动态生成（基于风控数据填充） | 0.5 天 | LexEnforcer |
| 8 | 修复合约部署路径，本机可部署 | 0.5 天 | LexStudio |

### P2 — 锦上添花

| # | 任务 | 预计耗时 | 所属模块 |
|---|------|---------|---------|
| 9 | CRE WASM 编译 + DON 注册 | 2 天 | LexOracle |
| 10 | Dashboard 链上事件实时监听（WebSocket） | 1 天 | Dashboard |
| 11 | 配置 Neon 数据库持久化 | 0.5 天 | 基础设施 |
| 12 | 合约测试套件（Foundry test） | 1 天 | 基础设施 |

---

## 九、CRE DON 部署准备状态（2026-03-08 更新）

### 已完成

| # | 改动 | 状态 |
|---|------|------|
| 1 | GoPlus 公网 API 作为主数据源，去掉 localhost | ✅ |
| 2 | project.yaml 加到仓库根目录 + don-family: zone-a | ✅ |
| 3 | 多数据源聚合（GoPlus + 可选内部 API），DON median 共识 | ✅ |
| 4 | Consumer 合约 3 层 DON 验证（Forwarder/WorkflowId/Temporal） | ✅ |
| 5 | uRWA donFreeze() — 只有 DON 能冻结，发行方不能调用 | ✅ |
| 6 | CRE simulate 通过（score=807, TX_STATUS_SUCCESS） | ✅ |
| 7 | 合约部署到 Sepolia（ChainlinkRisk + uRWA + Consumer） | ✅ |
| 8 | ChainlinkRisk 授权 Consumer 为 authorizedCaller | ✅ |
| 9 | 审计回调 API（POST /api/oracle/audit-ingest） | ✅ |

### 待审批

- CRE Early Access DON 部署权限 — 已提交申请，等待 Chainlink 团队回复
- 回复邮件草稿已准备：`cre/workflows/real-estate-tokenization/reply-to-thomas.md`

### Sepolia 合约地址（最新 v2）

| 合约 | 地址 | 说明 |
|------|------|------|
| ChainlinkRisk | `0x376c431443FFFFaf23A97Ae2698664F58e3e9e5A` | Compliance Feed（合规数据层） |
| uRWA v2 (ccTMMF) | `0x704c1ea432B9bab6F9DFc6a7425a1fe6358c0a77` | RWA 代币 + DON 冻结 |
| LexOracleConsumer v2 | `0xF97B5E5d8724cf9e6C2e5f3C7920e31669c1Dafe` | DON 报告接收器（3 层验证） |
| **ComplianceVault** | `0x71eb1C48A9504f226fE703606a7a3276a5F85815` | **第三方金库（DON 必要性的核心论据）** |

### 为什么 DON 部署是自然必要的

ComplianceVault 代表第三方协议（金库运营方 ≠ 代币发行方）。金库在允许用户存入 ccTMMF 之前，调用 `ChainlinkRisk.isUserAllowed()` 检查合规状态。

- 如果合规数据由代币发行方通过 simulate 写入 → 金库不信任（利益冲突）
- 如果合规数据由 Chainlink DON 独立验证并写入 → 金库可以信任（与 Price Feed 相同的信任模型）

这使得 ChainlinkRisk 从"内部风控工具"升级为"公开 Compliance Feed"，DON 是第三方信任的基础。

---

## 十、关键文件索引

| 文件 | 说明 | 模块 |
|------|------|------|
| `contracts/ChainlinkRisk.sol` | 链上风控数据存储合约 | LexOracle |
| `contracts/uRWA.sol` | ERC-7943 RWA 代币合约，集成风控检查 + DON 冻结 | LexStudio / LexOracle |
| `contracts/LexOracleConsumer.sol` | CRE DON 报告接收器（3 层验证） | LexOracle |
| `contracts/IComplianceFeed.sol` | 合规数据 Feed 标准接口 | LexOracle |
| `contracts/ComplianceVault.sol` | 第三方合规准入金库（DON 信任消费者） | LexOracle |
| `lexoracle-risk-guard/risk-oracle/workflow.go` | CRE Workflow（GoPlus + 多源共识 + 链上写入） | LexOracle |
| `lexoracle-risk-guard/project.yaml` | CRE 项目配置 | LexOracle |
| `project.yaml` | CRE 项目配置（根目录副本） | LexOracle |
| `chatbot/app.py` | Python 后端：合规聊天 + Mock 风控 API | LexStudio / LexOracle |
| `chatbot/chatbot.py` | LangGraph 智能代理（12 章节文档生成） | LexStudio |
| `cre/local-runner/main.go` | CRE 本地模拟器（命令行风控调用） | LexOracle |
| `app/api/oracle/mock-assess/route.ts` | Next.js Oracle 评估 API | LexOracle |
| `app/api/oracle/attestations/route.ts` | Next.js Oracle 记录查询 API | LexOracle |
| `lib/oracle-attestations.ts` | Oracle 风控记录持久化层 | LexOracle |
| `app/api/dashboard/overview/route.ts` | Dashboard 汇总数据 API | Dashboard |
| `components/dashboard/oracle-monitor.tsx` | Oracle 手动触发 + 记录展示组件 | Dashboard |
| `components/dashboard/overview.tsx` | Dashboard 主面板（统计 + 列表 + 图表） | Dashboard |
| `components/compliance/document-workbench.tsx` | 合规文档工作台（AI 聊天 + 文档预览） | LexStudio |
| `components/contracts/contract-generator.tsx` | 合约参数配置 + 代码生成 | LexStudio |
| `app/api/contract/deploy/route.ts` | 合约部署 API（Foundry） | LexStudio |
| `lib/wagmi.ts` | wagmi 链配置（Sepolia / Base Sepolia / Polygon Amoy） | 基础设施 |
| `lib/db.ts` | Neon Postgres 数据库层 | 基础设施 |
| `lib/ai.ts` | OpenRouter AI 调用工具 | 基础设施 |