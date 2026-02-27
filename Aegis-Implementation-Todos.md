---
doc_type: todos
version: "1.0"
status: stable
last_updated: "2026-02-23"
author: "Manus AI"
tags:
  - todos
  - checklist
  - implementation
dependencies:
  - Aegis_ AI Agent Consumption Authorization Protocol - Product Specification.md
related_docs:
  - Aegis-API-Spec.md
  - Aegis-App-Flow-Spec.md
  - Aegis-Mobile-UX-Spec.md
  - Aegis-Glossary.md
quick_ref: |
  Aegis 实施清单：Phase 0～3 的 Todo（P0-1～P3-3）与 F-01～F-06 的 Feature Checklist。开发时按 Phase 顺序执行，验收时对照 Checklist 逐条勾选。
---

# Aegis: Implementation Todos & Checklist

---

## 0. 如何使用本文档

- **开发时：** 按 Phase 0 → 1 → 2 → 3 顺序执行 Todo；完成一项可将表中「状态」改为 ✅。
- **验收时：** 每完成一个 Phase 或功能模块，对照 **§2 Feature Checklist** 逐条勾选，确保满足验收标准。
- **映射关系：** 每个 Todo 支持的功能 ID 见下表「对应 Feature」列；Checklist 的 F-xx 与主 spec §3 的 Feature ID 一一对应。

---

## 1. Implementation Todos (by Phase)

### Phase 0 — 规格与设计

| ID | Task | 对应 Feature | 状态 |
|----|------|--------------|------|
| P0-1 | 完成移动端 UX 规格与关键界面说明 | F-01, F-02, F-04, F-06 | ✅ |
| P0-2 | 完成 API OpenAPI/详细 REST 规格 | F-03 | ✅ |
| P0-3 | 完成 App 端到端流程说明（含状态机） | F-04, F-05 | ✅ |

### Phase 1 — 后端

| ID | Task | 对应 Feature | 状态 |
|----|------|--------------|------|
| P1-1 | 实现 `POST /v1/request_action` 及鉴权 | F-03 | ✅ MVP 已实现；与 Spec 差异见 §5 |
| P1-2 | 实现 Action Queue、推送服务集成、Execution Engine 与 callback | F-04, F-05 | ✅ MVP 已实现（邮件触达 + Web 审批 + mock 执行 + Webhook）；与 Spec 差异见 §5 |
| P1-3 | 实现审计日志存储与查询接口 | F-06 | ✅ MVP 已实现（审计日志、dev 查询）；与 Spec 差异见 §5 |

### Phase 2 — 移动端

**启动说明：** [Aegis-Phase2-Mobile-Kickoff.md](Aegis-Phase2-Mobile-Kickoff.md) — 优先级（P2-2 优先）、技术栈建议、后端对接点、第一里程碑与下一步动作。

| ID | Task | 对应 Feature | 状态 |
|----|------|--------------|------|
| P2-1 | 实现 Secure Enclave/StrongBox 凭证存储与签名 | F-01, F-05 | ⬜ |
| **P2-2** | **审批流程与列表（拆分为子项 ↓）** | **F-04, F-06** | **✅ 审批闭环已可演示（审批详情 + 列表 + 历史）；仅推送待做** |
| P2-2a | 审批详情屏 + Deep Link (`aegis://approve?token=`) + 生物识别 | F-04 | ✅ `app/approve.tsx`、Deep Link 解析、FaceID/TouchID |
| P2-2b | 待审批列表 API (`GET /api/app/pending`) + 首页对接 | F-04 | ✅ 后端 + App FlatList 均已完成；支持 action_id 路径跳审批详情 |
| P2-2c | 历史列表 API (`GET /api/app/history`) + 历史页对接 | F-06 | ✅ 后端分页 + App 列表/状态 badge/加载更多均已完成 |
| P2-2d | 推送（FCM/APNs）集成 | F-04 | ⏸️ 本轮不做，后续 Phase 安排 |
| P2-3 | 实现钱包/信用卡添加与管理（含 PCI 金库对接） | F-02 | ⬜ |

### Phase 3 — 集成与合规

| ID | Task | 对应 Feature | 状态 |
|----|------|--------------|------|
| P3-1 | 集成支付网关（Stripe/Adyen）与链上执行 | F-05 | ⬜ |
| P3-2 | PCI 与安全审计检查项 | F-01, F-02 | ⬜ |
| P3-3 | SDK/文档供 Agent 开发者集成 | F-03 | ✅ MVP 已实现（TS SDK、OpenAPI、README、示例脚本） |

---

## 2. Feature Checklist (Acceptance Criteria)

与主规格 **§3 Core Features & Functionality** 中 F-01～F-06 一一对应；验收时按本表逐条勾选。

| ID | 功能名称（与主 spec 一致） | 验收标准 | 状态 |
|----|---------------------------|----------|------|
| F-01 | Secure Credential Vault | 私钥/CVV 不离开设备；仅安全芯片（Secure Enclave/StrongBox）存储与签名；Agent 与后端永不接触原始凭证 | ⬜ |
| F-02 | Multi-Asset Support | 支持 ETH/SOL 钱包添加与展示（地址/链）；支持信用卡添加与展示（掩码）；信用卡经 PCI 金库、CVV 不落库 | ⬜ |
| F-03 | Agent-Facing Universal API | API 文档完整；鉴权方式明确（API Key/OAuth）；`POST /v1/request_action` 请求/响应示例可用；支持幂等（idempotency_key） | ✅ MVP 已实现：鉴权（X-Aegis-API-Key）、request_action、idempotency_key、审计接口 |
| F-04 | Human-in-the-Loop (HITL) Approval Workflow | 推送 → 打开 App → 展示审批详情 → 批准/拒绝 → 批准前必过 Face ID/Touch ID；全流程可走通 | ⬜ MVP 为 Web 审批（magic link）；移动端推送 + App + 生物识别待 Phase 2 |
| F-05 | Proxy Execution Engine | 用户批准后，信用卡支付经金库/支付网关正确扣款并回调；加密货币支付经用户签名后由后端广播链上并回调 | ✅ MVP 已实现：mock card/crypto 执行、Webhook 回调；真实金库/链上待 Phase 3 |
| F-06 | Immutable Audit Trail | 所有 request/approve/deny 可查；记录不可篡改；App 内可筛选与查看详情（时间、状态、金额、收款方、Agent） | ✅ MVP 已实现：后端审计日志、/api/dev/actions 与 audit 可查；App 内展示待移动端 |

---

## 3. Document References

- **App 流程规格:** [Aegis-App-Flow-Spec.md](Aegis-App-Flow-Spec.md) — E2E 流程、审批状态机、子流程、异常与边界
- **API 规格:** [Aegis-API-Spec.md](Aegis-API-Spec.md) — 鉴权、端点、回调、数据模型、限流与幂等
- **移动端 UX 规格:** [Aegis-Mobile-UX-Spec.md](Aegis-Mobile-UX-Spec.md) — IA、关键界面、推送与深链、无障碍
- **测试任务分工:** [docs/Agent-Test-Tasks.md](docs/Agent-Test-Tasks.md) — 3 Agent 测试覆盖率任务、指令模板、Todo 与 Checklist
- **Demo + Tavily 任务分工:** [docs/Agent-Demo-Tavily-Tasks.md](docs/Agent-Demo-Tavily-Tasks.md) — Demo Stage 与 Tavily 式自助流程、3 Agent 指令、Todo 与 Checklist（含测试与覆盖率）

---

## 4. 进度追踪

### Phase 进度

| Phase | 总任务数 | 已完成 | 进度 | 备注 |
|-------|----------|--------|------|------|
| Phase 0 | 3 | 3 | 100% | |
| Phase 1 | 3 | 3 | 100% | |
| Phase 2 | 6 (P2-1, P2-2a~d, P2-3) | 3 (P2-2a/b/c) | 50% | 审批闭环可演示；推送 P2-2d 暂缓 |
| Phase 3 | 3 | 1 | 33% | |
| **总计** | **15** | **10** | **67%** | |

### Feature 验收进度

| Feature ID | 状态 | 验收标准 |
|------------|------|----------|
| F-01 | ⬜ | 私钥/CVV 不离开设备；仅安全芯片存储与签名 |
| F-02 | ⬜ | 支持 ETH/SOL 钱包 + 信用卡添加与展示 |
| F-03 | ✅ | API 文档完整、鉴权明确、支持幂等（MVP 已覆盖） |
| F-04 | 🔧 | 审批详情 + Deep Link + 生物识别 ✅；待审批列表 + 首页对接 ✅；推送待后续 P2-2d |
| F-05 | ✅ | 批准后支付正确执行并回调（MVP mock 已实现） |
| F-06 | ✅ | 后端审计日志 ✅；App 历史列表 + 状态 badge + 分页 ✅ |

**进度计算：** 完成一项 Todo 或勾选一项 Checklist 后更新对应状态，进度自动计算。

---

## 5. MVP 与 API/App Flow Spec 对齐说明

以下为当前 MVP 实现与 [Aegis-API-Spec.md](Aegis-API-Spec.md)、[Aegis-App-Flow-Spec.md](Aegis-App-Flow-Spec.md) 的对照；差异处后续可择一调整实现或 Spec。

### 5.1. 端点对齐

| Spec | MVP 实现 | 对齐情况 |
|------|----------|----------|
| `POST /v1/request_action` | `POST /v1/request_action` | ✅ 一致 |
| `GET /v1/requests/{request_id}` | `GET /v1/actions/:actionId` | ⚠️ 路径与参数名不同（requests/request_id vs actions/actionId）；语义一致 |
| 鉴权 `Authorization: Bearer` / `X-Api-Key` | `X-Aegis-API-Key` 或 `Authorization: Bearer` | ✅ 一致 |
| 幂等 `Idempotency-Key` | `idempotency_key`（body） | ⚠️ Spec 为 Header，MVP 为 body 字段；建议统一为 Header |
| — | `POST /v1/actions/:actionId/cancel` | MVP 多出取消端点（Spec 可补充） |
| — | `GET /v1/payment_methods/capabilities` | MVP 多出能力查询（Spec 可补充） |

### 5.2. 状态枚举对齐

| Spec（App Flow / API） | MVP（ActionStatus） | 说明 |
|------------------------|---------------------|------|
| `created` | `received` | 等价，命名不同 |
| `pending` | `awaiting_approval` | 等价，命名不同 |
| `approved` | `approved` | ✅ 一致 |
| `denied` | `denied` | ✅ 一致 |
| `expired` | `expired` | ✅ 一致 |
| `executing` | `executing` | ✅ 一致 |
| `executed` | `succeeded` | 等价，命名不同 |
| `failed` | `failed` | ✅ 一致 |
| — | `validation_failed`, `canceled` | MVP 多出；Spec 可按需补充 |

### 5.3. 响应与回调对齐

| 项目 | Spec | MVP | 说明 |
|------|------|-----|------|
| 创建请求响应 | `request_id`, `status: "pending"` | `action.action_id`, `action.status`, `links.approval_url` | 字段名不同；MVP 多返回 approval_url |
| Webhook body | `request_id`, `status`, `timestamp`, `tx_hash`, `payment_id`, `error_*` | `event_id`, `event_type`, `occurred_at`, `action: { id, status, ... }`, `execution: { payment_id, tx_hash, ... }` | 结构不同；MVP 为嵌套对象，信息等价 |
| Webhook 签名 | 建议 `X-Aegis-Signature` | 有 webhook_secret，发送逻辑见 store/webhook | 实现可对照 Spec §3.2 校验 |

### 5.4. 流程对齐

| 阶段 | Spec | MVP | 说明 |
|------|------|-----|------|
| 触达用户 | 推送（含 request_id） | 邮件 magic link（含 approval_url） | MVP 为 Web 审批，无移动端推送 |
| 用户决策 | App 审批详情 + Face ID/Touch ID | Web 审批页 + 模拟 passkey/OTP 源 | 流程等价，平台不同 |
| 执行与回调 | Execution Engine → callback_url | Mock card/crypto → Webhook 队列 → callback_url | ✅ 流程一致（MVP 为 mock） |

**结论：** MVP 与 Spec 在「请求创建 → 审批 → 执行 → 回调」主流程上一致；端点路径、状态命名、响应/回调结构存在差异，可在 Phase 1 中统一为 Spec 或同步更新 Spec。

---

## 6. OpenClaw / Manus 测试场景 Todo

**测试目标：** OpenClaw 通过 MCP 使用 Aegis → 用户在网页添加信用卡 → OpenClaw 发起支付 Cursor 月费 → 用户审批 → 扣款成功。

**文档索引：** [OpenClaw-Setup](docs/OpenClaw-Setup.md) | [Manus-Setup](docs/Manus-Setup.md) | [E2E-Verification-Checklist](docs/E2E-Verification-Checklist.md)

### 6.1. 部署与公网可达（G1）

| ID | Task | 说明 | 状态 |
|----|------|------|------|
| G1-1 | 部署 Aegis 后端到公网 | Vercel / Railway / VPS；需持久化 DB（SQLite 或迁移到 Vercel Postgres） | ⬜ |
| G1-2 | 配置 `BASE_URL` 与 `STRIPE_SECRET_KEY` | 生产环境变量；Stripe 测试模式 key 即可 | ⬜ |
| G1-3 | 部署 MCP HTTP Server | 与后端同域或独立子域；监听 `/mcp` 或 `:8080/mcp` | ⬜ |
| G1-4 | 配置 MCP 的 `AEGIS_API_URL` | 指向已部署后端公网 URL | ⬜ |
| G1-5 | 验证 OpenClaw 可访问 | `curl` 或 OpenClaw 配置 MCP endpoint 后能列出 tools | ⬜ |

### 6.2. 网页添加信用卡（G2）

| ID | Task | 说明 | 状态 |
|----|------|------|------|
| G2-1 | 新增「添加支付方式」路由 | 如 `/settings/payment-methods` 或 `/dev/add-card`（MVP 可放 dev） | ✅ `/dev/add-card` |
| G2-2 | 集成 Stripe Elements | 前端加载 Stripe.js；CardElement 收集卡号、有效期、CVC；不落库 | ✅ |
| G2-3 | 创建 Stripe PaymentMethod | 前端 `stripe.createPaymentMethod()`；将 `payment_method_id` 传后端 | ✅ |
| G2-4 | 后端保存 PaymentMethod | 新建 `POST /api/app/payment-methods` 或扩展现有 dev endpoint；关联 `usr_demo` | ✅ `POST /api/dev/payment-methods` |
| G2-5 | 绑定 Stripe Customer | 若无 Customer 则创建；`attach` PaymentMethod 到 Customer；设 default | ✅ |
| G2-6 | 展示已添加的卡（掩码） | 列表页显示 `Visa **** 4242` 等；支持删除/设默认 | ✅ |

### 6.3. 用户身份与权限（G3，可选）

| ID | Task | 说明 | 状态 |
|----|------|------|------|
| G3-1 | 登录/注册流程 | 多人使用时需；单用户测试可继续用 `usr_demo` | ⬜ |
| G3-2 | 添加卡页鉴权 | 需登录或 session 才能添加卡；MVP 可先用 `user_id` 参数 | ⬜ |

### 6.4. 端到端测试流程（验收）

| ID | Task | 说明 | 状态 |
|----|------|------|------|
| E2E-1 | OpenClaw 配置 MCP | 填入 MCP URL、确认 tools 可见 | ✅ 文档就绪；MCP Server 验证通过 |
| E2E-2 | 用户在网页添加卡 | 打开添加卡页 → 填写 Stripe 测试卡 → 保存成功 | ✅ G2 已实现 |
| E2E-3 | OpenClaw 发起支付 | `aegis_request_payment` 或 `POST /v1/request_action` | ✅ REST + MCP 验证通过 |
| E2E-4 | 用户审批 | 打开 approval_url 或 App → 批准 → Face ID/密码 | ✅ Web + App 可演示 |
| E2E-5 | 扣款成功 | `aegis_get_payment_status` 返回 `succeeded`；Stripe Dashboard 可见 charge | ✅ mock 通过；真实扣款需 Stripe |

### 6.5. 执行顺序建议

```
G1-1 → G1-2 → G1-3 → G1-4 → G1-5   # 先打通公网
G2-1 → G2-2 → G2-3 → G2-4 → G2-5 → G2-6   # 再实现添加卡
E2E-1 → E2E-2 → E2E-3 → E2E-4 → E2E-5   # 最后跑通全流程
```

**依赖关系：** G2 依赖 G1（后端已部署）；E2E 依赖 G1 + G2。

### 6.6. 验收结果与 Bug 列表

详见 [docs/E2E-Verification-Checklist.md](docs/E2E-Verification-Checklist.md)。Peer Review（Agent A 部署、Agent B PCI）见该文档 §5。

| # | 类型 | 描述 |
|---|------|------|
| 1 | 文档 | REST 示例需含 `idempotency_key`、`recipient_reference`（已补充） |
| 2 | API | `idempotency_key` 建议统一为 Header |
| 3 | Dev | `POST /api/dev/actions/:id/decision` 需 admin 登录（✅ 已由中间件保护，测试覆盖：`tests/app.test.ts`） |
| 4 | MCP | `recipient_reference` 可扩展为可选参数 |

---

## 7. Demo Stage Checklist — 何时算「可用」

**目标流程：** OpenClaw 学会 Aegis Skill → 用户网页登录并提交信用卡 → OpenClaw 通过 Aegis 完成「支付 Cursor 月费」的扣款。

> **说明：** 「OpenClaw 在 Cursor 付费网站填写信用卡」有两种理解：  
> - **方式 A（Aegis 流程）**：用户卡存于 Aegis → OpenClaw 发起支付请求 → 用户审批 → Aegis 用 Stripe 扣款，收款方显示为「Cursor」。资金经 Aegis 的 Stripe 账户，Cursor 需另行对接才能收到款项。  
> - **方式 B（浏览器自动填写）**：OpenClaw 获取卡号并填入 Cursor 官网表单。需把卡号暴露给 Agent，存在 PCI 与安全风险，Aegis 当前不采用此方式。

本 Checklist 针对 **方式 A**。

### 7.1. 可用状态定义

**Demo 可用** = 以下 3 个阶段全部通过。

---

### 7.2. 阶段一：OpenClaw 能学会并使用 Skill

| # | 验收项 | 通过标准 | 状态 |
|---|--------|----------|------|
| D1-1 | OpenClaw 可发现 Aegis 工具 | 配置 MCP 后，OpenClaw 能列出 `aegis_request_payment`、`aegis_get_payment_status`、`aegis_cancel_payment`、`aegis_list_capabilities` | ⬜ |
| D1-2 | OpenClaw 能理解 Skill 用法 | 给 OpenClaw 提供 SKILL.md 或说明后，能正确调用 `aegis_request_payment` 并传入 amount、recipient、description | ⬜ |
| D1-3 | OpenClaw 能轮询状态 | 调用 `aegis_get_payment_status` 获取 action 状态，并能识别 `succeeded`、`denied`、`expired` | ⬜ |

---

### 7.3. 阶段二：用户网页登录并提交信用卡

| # | 验收项 | 通过标准 | 状态 |
|---|--------|----------|------|
| D2-1 | 用户可访问添加卡页面 | 打开 `/dev/add-card` 或 `/settings/payment-methods`，页面正常加载 | ⬜ |
| D2-2 | 用户可输入卡信息 | Stripe Elements 表单可输入卡号、有效期、CVC、持卡人；无报错 | ⬜ |
| D2-3 | 提交后卡被保存 | 点击保存后，后端返回成功；`aegis_list_capabilities` 能查到该卡（掩码展示） | ⬜ |
| D2-4 | 卡信息不落库 | 卡号、CVV 仅经 Stripe 令牌化，Aegis 数据库无明文存储 | ⬜ |
| D2-5 | 登录/身份（可选） | 单用户 demo 可用 `usr_demo`；多人需有登录并绑定 user_id | ⬜ |

---

### 7.4. 阶段三：OpenClaw 完成「支付 Cursor」扣款

| # | 验收项 | 通过标准 | 状态 |
|---|--------|----------|------|
| D3-1 | OpenClaw 发起支付请求 | 调用 `aegis_request_payment(amount: "20", recipient_name: "Cursor", description: "Cursor Pro 月费")` 成功，返回 action_id | ⬜ |
| D3-2 | 用户收到审批入口 | 通过 approval_url、邮件或 App 进入审批页，能看到金额、收款方、描述 | ⬜ |
| D3-3 | 用户批准后扣款成功 | 用户点击批准 → `aegis_get_payment_status` 返回 `succeeded`；Stripe Dashboard 有对应 charge | ⬜ |
| D3-4 | 扣款使用用户已添加的卡 | 扣款来自用户在阶段二添加的 PaymentMethod，非硬编码测试卡 | ⬜ |

---

### 7.5. 综合判定

| 条件 | 结果 |
|------|------|
| D1-1～D1-3 全过 | OpenClaw 已学会并可使用 Skill |
| D2-1～D2-5 全过 | 用户可在网页登录并提交信用卡 |
| D3-1～D3-4 全过 | OpenClaw 可通过 Aegis 完成「支付 Cursor」扣款 |
| **上述 12 项全部通过** | **Demo 可用** |

---

### 7.6. 与 Cursor 官网的关系

当前流程中，Aegis 负责：用户审批 → 用 Stripe 扣款 → 资金进入 Aegis 的 Stripe 账户。  
**Cursor 官网不会自动收到这笔钱**；若要让 Cursor 实际到账，需要：

- Cursor 提供支付/账单 API 供 Aegis 调用，或  
- 用户手动在 Cursor 官网用同一张卡支付。

Demo 阶段的目标是：**验证 OpenClaw → Aegis → 用户审批 → Stripe 扣款** 全流程可跑通。
