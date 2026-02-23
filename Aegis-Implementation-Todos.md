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
| P0-1 | 完成移动端 UX 规格与关键界面说明 | F-01, F-02, F-04, F-06 | ⬜ |
| P0-2 | 完成 API OpenAPI/详细 REST 规格 | F-03 | ⬜ |
| P0-3 | 完成 App 端到端流程说明（含状态机） | F-04, F-05 | ⬜ |

### Phase 1 — 后端

| ID | Task | 对应 Feature | 状态 |
|----|------|--------------|------|
| P1-1 | 实现 `POST /v1/request_action` 及鉴权 | F-03 | ⬜ |
| P1-2 | 实现 Action Queue、推送服务集成、Execution Engine 与 callback | F-04, F-05 | ⬜ |
| P1-3 | 实现审计日志存储与查询接口 | F-06 | ⬜ |

### Phase 2 — 移动端

| ID | Task | 对应 Feature | 状态 |
|----|------|--------------|------|
| P2-1 | 实现 Secure Enclave/StrongBox 凭证存储与签名 | F-01, F-05 | ⬜ |
| P2-2 | 实现推送接收、审批 UI、Face ID/Touch ID 校验 | F-04 | ⬜ |
| P2-3 | 实现钱包/信用卡添加与管理（含 PCI 金库对接） | F-02 | ⬜ |

### Phase 3 — 集成与合规

| ID | Task | 对应 Feature | 状态 |
|----|------|--------------|------|
| P3-1 | 集成支付网关（Stripe/Adyen）与链上执行 | F-05 | ⬜ |
| P3-2 | PCI 与安全审计检查项 | F-01, F-02 | ⬜ |
| P3-3 | SDK/文档供 Agent 开发者集成 | F-03 | ⬜ |

---

## 2. Feature Checklist (Acceptance Criteria)

与主规格 **§3 Core Features & Functionality** 中 F-01～F-06 一一对应；验收时按本表逐条勾选。

| ID | 功能名称（与主 spec 一致） | 验收标准 | 状态 |
|----|---------------------------|----------|------|
| F-01 | Secure Credential Vault | 私钥/CVV 不离开设备；仅安全芯片（Secure Enclave/StrongBox）存储与签名；Agent 与后端永不接触原始凭证 | ⬜ |
| F-02 | Multi-Asset Support | 支持 ETH/SOL 钱包添加与展示（地址/链）；支持信用卡添加与展示（掩码）；信用卡经 PCI 金库、CVV 不落库 | ⬜ |
| F-03 | Agent-Facing Universal API | API 文档完整；鉴权方式明确（API Key/OAuth）；`POST /v1/request_action` 请求/响应示例可用；支持幂等（idempotency_key） | ⬜ |
| F-04 | Human-in-the-Loop (HITL) Approval Workflow | 推送 → 打开 App → 展示审批详情 → 批准/拒绝 → 批准前必过 Face ID/Touch ID；全流程可走通 | ⬜ |
| F-05 | Proxy Execution Engine | 用户批准后，信用卡支付经金库/支付网关正确扣款并回调；加密货币支付经用户签名后由后端广播链上并回调 | ⬜ |
| F-06 | Immutable Audit Trail | 所有 request/approve/deny 可查；记录不可篡改；App 内可筛选与查看详情（时间、状态、金额、收款方、Agent） | ⬜ |

---

## 3. Document References

- **App 流程规格:** [Aegis-App-Flow-Spec.md](Aegis-App-Flow-Spec.md) — E2E 流程、审批状态机、子流程、异常与边界
- **API 规格:** [Aegis-API-Spec.md](Aegis-API-Spec.md) — 鉴权、端点、回调、数据模型、限流与幂等
- **移动端 UX 规格:** [Aegis-Mobile-UX-Spec.md](Aegis-Mobile-UX-Spec.md) — IA、关键界面、推送与深链、无障碍

---

## 4. 进度追踪

### Phase 进度

| Phase | 总任务数 | 已完成 | 进度 |
|-------|----------|--------|------|
| Phase 0 | 3 | 0 | 0% |
| Phase 1 | 3 | 0 | 0% |
| Phase 2 | 3 | 0 | 0% |
| Phase 3 | 3 | 0 | 0% |
| **总计** | **12** | **0** | **0%** |

### Feature 验收进度

| Feature ID | 状态 | 验收标准 |
|------------|------|----------|
| F-01 | ⬜ | 私钥/CVV 不离开设备；仅安全芯片存储与签名 |
| F-02 | ⬜ | 支持 ETH/SOL 钱包 + 信用卡添加与展示 |
| F-03 | ⬜ | API 文档完整、鉴权明确、支持幂等 |
| F-04 | ⬜ | 推送 → App → 审批详情 → 批准/拒绝 → 生物识别 |
| F-05 | ⬜ | 批准后支付正确执行并回调 |
| F-06 | ⬜ | 所有 request/approve/deny 可查、不可篡改 |

**进度计算：** 完成一项 Todo 或勾选一项 Checklist 后更新对应状态，进度自动计算。
