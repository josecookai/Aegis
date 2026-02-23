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
