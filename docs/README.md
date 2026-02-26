# ChainLex.ai 文档中心

欢迎来到ChainLex.ai文档中心！这里包含了项目的完整文档，帮助你快速了解和使用这个项目。

## 📚 文档目录

### 1. 业务逻辑文档
**文件**: [BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md)

**内容**:
- 项目概述和核心价值主张
- 完整的业务流程图（三个阶段）
- 技术架构详解
- 核心功能模块说明
- 合规与安全机制
- 业务场景示例

**适合阅读人群**: 产品经理、业务分析师、新加入的开发者

### 2. 部署指南
**文件**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

**内容**:
- 环境要求和依赖安装
- 详细部署步骤
- 功能测试指南
- 常见问题排查
- 开发模式说明
- 生产环境部署准备

**适合阅读人群**: 开发者、运维人员

### 3. 项目评估文档
**文件**: [PROJECT_EVALUATION.md](./PROJECT_EVALUATION.md)

**内容**:
- 技术架构评估
- 业务逻辑评估
- 代码质量评估
- 安全性评估
- 性能评估
- 风险评估和改进建议

**适合阅读人群**: 技术负责人、投资人、项目评估人员

## 🚀 快速开始

### 方式1: 使用启动脚本（推荐）

```bash
# 进入项目目录
cd /Users/jchen/Documents/boshanlu_proj/ChainLex.ai

# 运行启动脚本
./scripts/start.sh
```

这个脚本会：
- 自动检查环境依赖
- 安装缺失的依赖
- 同时启动前端和后端服务
- 显示服务访问地址

### 方式2: 手动启动

#### 步骤1: 安装依赖

```bash
# 安装前端依赖
pnpm install

# 安装Python依赖
cd chatbot
pip install -r requirements.txt
cd ..
```

#### 步骤2: 启动后端服务

```bash
cd chatbot
python app.py
# 服务将在 http://localhost:8000 启动
```

#### 步骤3: 启动前端服务（新终端）

```bash
pnpm run dev
# 服务将在 http://localhost:3000 启动
```

### 方式3: 测试服务

```bash
# 运行测试脚本
./scripts/test-services.sh
```

## 📖 其他重要文档

### 项目根目录文档

- **README.md** - 项目概述和快速开始
- **PRD.md** - 产品需求文档
- **development-plan.md** - 开发计划
- **CLAUDE.md** - 开发指南（给AI助手的说明）

### API文档

- **chatbot/README_API.md** - ChatBot API完整文档
- **http://localhost:8000/docs** - Swagger UI（服务启动后）

## 🎯 使用场景

### 场景1: 我想了解这个项目是做什么的
👉 阅读 [BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md) 第1-2章

### 场景2: 我想快速部署并测试
👉 阅读 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 第2-4章

### 场景3: 我想评估这个项目是否靠谱
👉 阅读 [PROJECT_EVALUATION.md](./PROJECT_EVALUATION.md) 全文

### 场景4: 我想开发新功能
👉 阅读 [CLAUDE.md](../CLAUDE.md) 和 [development-plan.md](../development-plan.md)

### 场景5: 我遇到了问题
👉 查看 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 第5章（常见问题排查）

## 🔍 文档更新记录

- **2024-01-19**: 创建业务逻辑文档、部署指南、项目评估文档
- **2024-01-19**: 创建快速启动脚本和测试脚本

## 💡 提示

1. **首次使用**: 建议先阅读业务逻辑文档，了解项目整体架构
2. **部署测试**: 使用启动脚本可以快速开始，无需手动配置
3. **遇到问题**: 查看部署指南的常见问题章节
4. **评估项目**: 查看项目评估文档，了解项目的优缺点

## 📞 获取帮助

如果文档中没有找到答案，可以：

1. 查看项目根目录的 README.md
2. 检查代码注释
3. 查看API文档（服务启动后访问 /docs）
4. 检查GitHub Issues（如果有）

---

**祝您使用愉快！** 🎉
