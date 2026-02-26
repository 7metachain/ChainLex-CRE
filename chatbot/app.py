# -*- coding: utf-8 -*-
"""
RWA代币发行说明书Chatbot的FastAPI服务
基于原有的LangGraph智能交互Agent系统
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import json
import uuid
from datetime import datetime
import asyncio
from contextlib import asynccontextmanager

from chatbot import (
    DocumentState, SECTION_TITLES, SECTION_NAMES, build_intelligent_agent,
    initialize_agent, state_to_json
)


# ==================== 数据模型 ====================
class ChatMessage(BaseModel):
    """聊天消息模型"""
    content: str = Field(..., description="用户输入内容")
    session_id: Optional[str] = Field(None, description="会话ID")

class ChatResponse(BaseModel):
    """聊天响应模型"""
    session_id: str = Field(..., description="会话ID")
    message: str = Field(..., description="AI助手回复")
    current_section: int = Field(..., description="当前处理章节")
    section_title: str = Field(..., description="当前章节标题")
    section_complete: bool = Field(..., description="当前章节是否完成")
    conversation_history: List[Dict[str, Any]] = Field(..., description="对话历史")
    document_state: Dict[str, Any] = Field(..., description="文档状态")
    last_completed_section: Optional[int] = Field(None, description="刚完成的章节索引")

class SessionCreate(BaseModel):
    """创建会话模型"""
    user_name: Optional[str] = Field(None, description="用户名称")
    project_name: Optional[str] = Field(None, description="项目名称")
    jurisdiction: Optional[str] = Field(None, description="法域选择 (hk/sg/us/ae)")

class SessionInfo(BaseModel):
    """会话信息模型"""
    session_id: str
    user_name: Optional[str]
    project_name: Optional[str]
    current_section: int
    created_at: datetime
    last_activity: datetime
    total_messages: int
    section_complete: bool

class DocumentExport(BaseModel):
    """文档导出模型"""
    session_id: str
    format: str = Field("markdown", description="导出格式: markdown, json")
    include_history: bool = Field(True, description="是否包含对话历史")

class RiskAssessmentRequest(BaseModel):
    """风险评估请求模型（Mock）"""
    wallet_address: str = Field(..., description="待评估钱包地址")
    chain: str = Field("sepolia", description="链名称")
    provider: str = Field("mock-chainalysis", description="风控数据源")

class RiskAssessmentResponse(BaseModel):
    """风险评估响应模型（Mock）"""
    wallet_address: str
    chain: str
    provider: str
    score: int
    level: str
    is_blacklisted: bool
    reason: str
    assessed_at: str

# ==================== 全局状态管理 ====================
class SessionManager:
    """会话管理器"""

    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.agent_instances: Dict[str, Any] = {}

    def create_session(self, user_name: Optional[str] = None, project_name: Optional[str] = None, jurisdiction: Optional[str] = None) -> str:
        """创建新会话"""
        session_id = str(uuid.uuid4())

        # 初始化文档状态
        initial_state = {
            "current_section": 0,
            "section_contents": {name: {} for name in SECTION_NAMES},
            "filled_placeholders": {name: {} for name in SECTION_NAMES},
            "pending_placeholders": {name: [] for name in SECTION_NAMES},
            "interaction_mode": "ask",
            "conversation_history": [],
            "last_user_input": "",
            "ai_summary": "",
            "agent_response": "",
            "section_complete": False,
            "extracted_info": {},
            "jurisdiction": jurisdiction  # 保存法域信息
        }

        # 创建会话记录
        self.sessions[session_id] = {
            "user_name": user_name,
            "project_name": project_name,
            "jurisdiction": jurisdiction,
            "created_at": datetime.now(),
            "last_activity": datetime.now(),
            "total_messages": 0,
            "state": initial_state
        }

        # 为会话创建Agent实例
        self.agent_instances[session_id] = build_intelligent_agent()

        return session_id

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取会话信息"""
        return self.sessions.get(session_id)

    def update_session(self, session_id: str, **kwargs):
        """更新会话信息"""
        if session_id in self.sessions:
            self.sessions[session_id].update(kwargs)
            self.sessions[session_id]["last_activity"] = datetime.now()

    def get_agent(self, session_id: str):
        """获取会话的Agent实例"""
        return self.agent_instances.get(session_id)

    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            if session_id in self.agent_instances:
                del self.agent_instances[session_id]
            return True
        return False

    def get_all_sessions(self) -> List[SessionInfo]:
        """获取所有会话信息"""
        sessions_info = []
        for session_id, session_data in self.sessions.items():
            sessions_info.append(SessionInfo(
                session_id=session_id,
                user_name=session_data.get("user_name"),
                project_name=session_data.get("project_name"),
                current_section=session_data["state"]["current_section"],
                created_at=session_data["created_at"],
                last_activity=session_data["last_activity"],
                total_messages=session_data["total_messages"],
                section_complete=session_data["state"]["section_complete"]
            ))
        return sessions_info

# 全局会话管理器
session_manager = SessionManager()

# ==================== 应用生命周期管理 ====================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动和关闭时的处理"""
    print("🚀 RWA代币发行说明书Chatbot服务启动")
    print("📋 基于LangGraph的智能交互Agent系统")
    yield
    print("👋 RWA代币发行说明书Chatbot服务关闭")

# ==================== FastAPI应用 ====================
app = FastAPI(
    title="RWA代币发行说明书Chatbot API",
    description="基于LangGraph的智能交互Agent系统，用于生成RWA代币发行说明书",
    version="1.0.0",
    lifespan=lifespan
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该设置具体的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== API路由 ====================

@app.get("/", tags=["系统"])
async def root():
    """API根路径"""
    return {
        "message": "RWA代币发行说明书Chatbot API",
        "version": "1.0.0",
        "status": "running",
        "sections_count": len(SECTION_TITLES),
        "available_sections": SECTION_TITLES
    }

@app.post("/session/create", response_model=Dict[str, str], tags=["会话管理"])
async def create_session(session_data: SessionCreate):
    """创建新的聊天会话"""
    try:
        session_id = session_manager.create_session(
            user_name=session_data.user_name,
            project_name=session_data.project_name,
            jurisdiction=session_data.jurisdiction
        )

        session = session_manager.get_session(session_id)

        return {
            "session_id": session_id,
            "message": "会话创建成功",
            "current_section": "0",
            "section_title": SECTION_TITLES[0],
            "user_name": session_data.user_name or "匿名用户",
            "project_name": session_data.project_name or "未命名项目"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建会话失败: {str(e)}")

@app.post("/risk-assessment", response_model=RiskAssessmentResponse, tags=["风控Mock"])
async def assess_risk(payload: RiskAssessmentRequest):
    """Mock 风险评估接口，用于演示 Oracle 闭环"""
    address = payload.wallet_address.strip()
    if not address.startswith("0x") or len(address) != 42:
        raise HTTPException(status_code=400, detail="钱包地址格式无效")

    try:
        # 使用地址尾部字节生成稳定评分，保证同一地址结果可复现
        seed = int(address[-8:], 16)
        score = seed % 1001

        if score >= 900:
            level = "BLOCKED"
        elif score >= 700:
            level = "HIGH"
        elif score >= 400:
            level = "MEDIUM"
        else:
            level = "LOW"

        is_blacklisted = score >= 950 or address.lower().endswith("dead")
        if is_blacklisted:
            level = "BLOCKED"

        reason = (
            "Sanctions match risk detected"
            if is_blacklisted
            else f"Mock risk model score={score}"
        )

        return RiskAssessmentResponse(
            wallet_address=address,
            chain=payload.chain,
            provider=payload.provider,
            score=score,
            level=level,
            is_blacklisted=is_blacklisted,
            reason=reason,
            assessed_at=datetime.now().isoformat()
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="钱包地址解析失败")

@app.get("/session/list", response_model=List[SessionInfo], tags=["会话管理"])
async def list_sessions():
    """获取所有会话列表"""
    return session_manager.get_all_sessions()

@app.get("/session/{session_id}", response_model=SessionInfo, tags=["会话管理"])
async def get_session_info(session_id: str):
    """获取指定会话信息"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    return SessionInfo(
        session_id=session_id,
        user_name=session.get("user_name"),
        project_name=session.get("project_name"),
        current_section=session["state"]["current_section"],
        created_at=session["created_at"],
        last_activity=session["last_activity"],
        total_messages=session["total_messages"],
        section_complete=session["state"]["section_complete"]
    )

@app.delete("/session/{session_id}", tags=["会话管理"])
async def delete_session(session_id: str):
    """删除指定会话"""
    if not session_manager.get_session(session_id):
        raise HTTPException(status_code=404, detail="会话不存在")

    if session_manager.delete_session(session_id):
        return {"message": "会话已删除"}
    else:
        raise HTTPException(status_code=500, detail="删除会话失败")

@app.post("/chat", response_model=ChatResponse, tags=["聊天交互"])
async def chat(message: ChatMessage):
    """与聊天机器人交互"""

    # 如果没有提供session_id，创建新会话
    if not message.session_id:
        session_id = session_manager.create_session()
    else:
        session_id = message.session_id
        if not session_manager.get_session(session_id):
            raise HTTPException(status_code=404, detail="会话不存在")

    try:
        session = session_manager.get_session(session_id)
        state = session["state"]
        agent = session_manager.get_agent(session_id)

        # 更新用户输入
        state["last_user_input"] = message.content
        state["conversation_history"].append({
            "role": "user",
            "content": message.content,
            "section": state["current_section"],
            "timestamp": datetime.now().isoformat()
        })

        # 使用Agent处理用户输入
        agent_executor = initialize_agent()
        state_json = state_to_json(state)
        
        # 获取法域信息并生成合规提示
        jurisdiction = session.get("jurisdiction") or state.get("jurisdiction")
        jurisdiction_prompt = ""
        if jurisdiction:
            jurisdiction_guidance = {
                "hk": "用户选择了香港法域。请特别注意：香港证监会(SFC)的监管要求，包括专业投资者(PI)限制、私募发行要求(≤50人，单笔≥HKD 500k)、以及相关的KYC/AML合规要求。",
                "sg": "用户选择了新加坡法域。请特别注意：新加坡金融管理局(MAS)的监管框架，包括证券法、支付服务法(PSA)的相关要求，以及数字代币的监管分类。",
                "us": "用户选择了美国法域。请特别注意：美国SEC的证券法要求，包括Howey测试、合格投资者(Accredited Investor)标准、以及各州不同的监管要求。",
                "ae": "用户选择了阿联酋法域。请特别注意：ADGM(阿布扎比全球市场)或DIFC(迪拜国际金融中心)的监管框架，以及相关的数字资产监管要求。"
            }
            jurisdiction_prompt = jurisdiction_guidance.get(jurisdiction.lower(), "")

        agent_input = f"""
用户输入：{message.content}

当前状态：
{state_json}
{jurisdiction_prompt}

请根据用户输入和当前状态，选择合适的工具来处理。
"""

        # 异步执行Agent
        result = await asyncio.to_thread(agent_executor.invoke, {"input": agent_input})

        # 保存Agent响应
        agent_response = result.get("output", "")
        state["agent_response"] = agent_response
        state["conversation_history"].append({
            "role": "assistant",
            "content": agent_response,
            "section": state["current_section"],
            "timestamp": datetime.now().isoformat()
        })

        # 分析交互模式
        tool_output = agent_response.lower()
        if "自动填写" in tool_output or "autofill" in tool_output:
            state["interaction_mode"] = "fill"
        elif "确认" in tool_output or "confirm" in tool_output:
            state["interaction_mode"] = "confirm"
            # 模拟确认操作
            if state["current_section"] < len(SECTION_TITLES):
                # 先标记当前章节完成，然后递增
                completed_section = state["current_section"]
                state["current_section"] += 1
                # 为新章节重置完成状态
                state["section_complete"] = False
                # 在响应中包含刚完成的章节信息
                state["last_completed_section"] = completed_section
        elif "总结" in tool_output or "summarize" in tool_output:
            state["interaction_mode"] = "ask"
        else:
            state["interaction_mode"] = "auto"

        # 更新会话信息
        session_manager.update_session(session_id,
            total_messages=session["total_messages"] + 2,  # 用户+助手
            state=state
        )

        current_section_idx = state["current_section"]
        if current_section_idx >= len(SECTION_TITLES):
            current_section_idx = len(SECTION_TITLES) - 1
            section_title = "文档已完成"
        else:
            section_title = SECTION_TITLES[current_section_idx]

        return ChatResponse(
            session_id=session_id,
            message=agent_response,
            current_section=current_section_idx,
            section_title=section_title,
            section_complete=state["section_complete"],
            conversation_history=state["conversation_history"][-10:],  # 返回最近10条
            document_state={k: v for k, v in state.items() if k != "conversation_history"},
            last_completed_section=state.get("last_completed_section")
        )

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ Chat error: {error_detail}")
        raise HTTPException(status_code=500, detail=f"聊天处理失败: {repr(e)}\n{error_detail}")

@app.get("/session/{session_id}/state", tags=["会话管理"])
async def get_session_state(session_id: str):
    """获取会话的完整状态"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    return {
        "session_id": session_id,
        "state": session["state"],
        "metadata": {
            "total_messages": session["total_messages"],
            "created_at": session["created_at"],
            "last_activity": session["last_activity"]
        }
    }

@app.post("/session/{session_id}/export", tags=["文档导出"])
async def export_document(session_id: str, export_data: DocumentExport):
    """导出文档"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    state = session["state"]

    try:
        if export_data.format.lower() == "markdown":
            # 生成Markdown文档
            document_content = f"""# {session.get('project_name', 'RWA代币发行说明书')}

## 项目信息
- 用户名称: {session.get('user_name', '未设置')}
- 生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
- 处理章节数: {state.get('current_section', 0)}/{len(SECTION_TITLES)}
- 对话轮数: {len(state.get('conversation_history', []))}

## 章节完成情况
"""

            for i, title in enumerate(SECTION_TITLES):
                if i < state.get('current_section', 0):
                    document_content += f"✅ 第{i+1}节 {title}\n"
                else:
                    document_content += f"⏸️ 第{i+1}节 {title}\n"

            if export_data.include_history:
                document_content += f"""

## 对话历史
"""
                history = state.get('conversation_history', [])
                for item in history:
                    role = "👤 用户" if item['role'] == 'user' else "🤖 助手"
                    document_content += f"\n### {role} (第{item.get('section', 'N/A')}节)\n"
                    document_content += f"{item['content']}\n"

            return {
                "format": "markdown",
                "content": document_content,
                "filename": f"RWA_memo_{session_id[:8]}.md"
            }

        elif export_data.format.lower() == "json":
            # 导出JSON格式
            export_data = {
                "session_info": {
                    "session_id": session_id,
                    "user_name": session.get("user_name"),
                    "project_name": session.get("project_name"),
                    "created_at": session["created_at"],
                    "last_activity": session["last_activity"]
                },
                "document_state": state,
                "metadata": {
                    "total_messages": session["total_messages"],
                    "sections_total": len(SECTION_TITLES),
                    "sections_completed": state.get("current_section", 0)
                }
            }

            if export_data.include_history:
                export_data["conversation_history"] = state.get("conversation_history", [])

            return {
                "format": "json",
                "content": json.dumps(export_data, ensure_ascii=False, indent=2, default=str),
                "filename": f"RWA_state_{session_id[:8]}.json"
            }

        else:
            raise HTTPException(status_code=400, detail="不支持的导出格式")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")

@app.get("/health", tags=["系统"])
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_sessions": len(session_manager.sessions),
        "system": "RWA Chatbot Service"
    }

# ==================== 启动服务 ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
