---
doc_type: glossary
version: "1.0"
status: stable
last_updated: "2026-02-23"
author: "Manus AI"
tags:
  - glossary
  - terminology
  - reference
related_docs:
  - Aegis_ AI Agent Consumption Authorization Protocol - Product Specification.md
  - Aegis-API-Spec.md
  - Aegis-App-Flow-Spec.md
  - Aegis-Mobile-UX-Spec.md
quick_ref: |
  Aegis 项目统一术语表，定义所有文档中使用的关键术语，避免歧义。
---

# Aegis: Glossary（术语表）

本文档定义 Aegis 项目中所有文档使用的关键术语，按字母顺序和主题分类两种方式组织，便于 AI 和开发者快速查找和理解。

---

## 按字母顺序索引

### A

**Action Queue（动作队列）**
- **定义：** 后端系统中存储待处理请求的队列，用于异步处理 Agent 提交的审批请求。
- **使用场景：** 见 [App Flow Spec](Aegis-App-Flow-Spec.md) §1
- **相关术语：** Request, Execution Engine

**Agent（代理）**
- **定义：** AI 代理，代表用户执行任务的自动化程序。在 Aegis 中，Agent 通过 API 发起支付请求。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) §2.2
- **相关术语：** API, Callback

**API Key（API 密钥）**
- **定义：** Agent 用于认证的密钥，通过 `Authorization: Bearer <api_key>` 或 `X-Api-Key` 头传递。
- **使用场景：** 见 [API Spec](Aegis-API-Spec.md) §1.2
- **相关术语：** Authentication, OAuth

**Approval Workflow（审批工作流）**
- **定义：** 用户批准或拒绝 Agent 请求的流程，包括推送通知、App 展示、生物识别、决策提交。
- **使用场景：** 见 [App Flow Spec](Aegis-App-Flow-Spec.md) §3.2
- **相关术语：** HITL, Push Notification

**Audit Trail（审计轨迹）**
- **定义：** 所有请求、批准、拒绝的不可篡改记录，在 App 中可查询和筛选。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) F-06
- **相关术语：** Immutable, History

### C

**Callback URL（回调 URL）**
- **定义：** Agent 提供的 HTTPS URL，Aegis 在用户操作完成后向该 URL 发送 POST 请求通知结果。
- **使用场景：** 见 [API Spec](Aegis-API-Spec.md) §3
- **相关术语：** Webhook, Request ID

**Credential Vault（凭证库）**
- **定义：** 安全存储用户凭证的系统。在 Aegis 中，私钥和 CVV 存储在设备 Secure Enclave/StrongBox，信用卡数据存储在 PCI DSS 合规金库。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) F-01
- **相关术语：** Secure Enclave, PCI DSS

**CVV（卡验证值）**
- **定义：** 信用卡背面的 3-4 位验证码，用于在线支付验证。在 Aegis 中，CVV 不离开设备，不存储在后端。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) F-01, F-02
- **相关术语：** Credit Card, PCI DSS

### D

**Deep Link（深链）**
- **定义：** 从推送通知打开 App 并跳转到特定页面的链接，格式如 `aegis://approve?request_id=xxx`。
- **使用场景：** 见 [Mobile UX Spec](Aegis-Mobile-UX-Spec.md) §4.2
- **相关术语：** Universal Link, Push Notification

**Denied（已拒绝）**
- **定义：** 请求状态之一，表示用户明确拒绝了该请求。
- **使用场景：** 见 [App Flow Spec](Aegis-App-Flow-Spec.md) §2
- **相关术语：** Status, Approved

### E

**Execution Engine（执行引擎）**
- **定义：** 后端系统中负责执行支付的部分，在用户批准后调用支付网关或广播链上交易。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) F-05
- **相关术语：** Proxy Execution, Payment Gateway

**Expired（已过期）**
- **定义：** 请求状态之一，表示请求在等待用户操作时超时（如 5 分钟），自动视为拒绝。
- **使用场景：** 见 [App Flow Spec](Aegis-App-Flow-Spec.md) §2
- **相关术语：** Status, Timeout

### F

**Face ID / Touch ID**
- **定义：** iOS/Android 的生物识别技术，用于在批准支付前验证用户身份。
- **使用场景：** 见 [Mobile UX Spec](Aegis-Mobile-UX-Spec.md) §3.2
- **相关术语：** Biometric Authentication, Approval

**Feature ID（功能 ID）**
- **定义：** 主规格中定义的功能编号，格式为 F-01 至 F-06，用于追踪和验收。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) §3
- **相关术语：** Checklist, Implementation Todos

### H

**HITL（Human-in-the-Loop，人机闭环）**
- **定义：** 在自动化流程中引入人工审批环节，确保关键决策由人类做出。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) F-04
- **相关术语：** Approval Workflow, Push Notification

### I

**Idempotency Key（幂等键）**
- **定义：** 请求头中的可选字段，用于确保相同请求不会重复处理。相同 key 在有效期内返回相同 `request_id`。
- **使用场景：** 见 [API Spec](Aegis-API-Spec.md) §2.1, §5.2
- **相关术语：** Request, Idempotent

**Immutable（不可篡改）**
- **定义：** 审计记录一旦创建就不能修改或删除的特性。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) F-06
- **相关术语：** Audit Trail, History

### P

**PCI DSS（Payment Card Industry Data Security Standard）**
- **定义：** 支付卡行业数据安全标准，要求信用卡数据存储在合规的金库中。Aegis 使用 PCI DSS Level 1 认证的支付处理器。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) §5, F-02
- **相关术语：** Credit Card, Credential Vault

**Payment Gateway（支付网关）**
- **定义：** 处理信用卡支付的第三方服务，如 Stripe、Adyen。Aegis 后端通过支付网关执行扣款。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) F-05
- **相关术语：** Execution Engine, Credit Card

**Payment Rail（支付通道）**
- **定义：** 支付方式类型，如 `card`（信用卡）或 `crypto`（加密货币）。
- **使用场景：** 见 [API Spec](Aegis-API-Spec.md) §2.1
- **相关术语：** Payment Method Preference, Multi-Asset Support

**Private Key（私钥）**
- **定义：** 加密货币钱包的私钥，用于签名交易。在 Aegis 中，私钥仅存储在设备 Secure Enclave/StrongBox，不离开设备。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) F-01, F-02
- **相关术语：** Secure Enclave, Crypto Wallet

**Push Notification（推送通知）**
- **定义：** 后端向用户设备发送的通知，包含审批请求的简要信息，点击后打开 App 到审批详情页。
- **使用场景：** 见 [Mobile UX Spec](Aegis-Mobile-UX-Spec.md) §4.1
- **相关术语：** Deep Link, Approval Workflow

### R

**Request ID（请求 ID）**
- **定义：** 唯一标识一条审批请求的字符串，格式如 `req_abc123xyz`，由 `POST /v1/request_action` 返回。
- **使用场景：** 见 [API Spec](Aegis-API-Spec.md) §2.1
- **相关术语：** Request, Callback

**Request Status（请求状态）**
- **定义：** 请求的当前状态，枚举值：`created`, `pending`, `approved`, `denied`, `expired`, `executing`, `executed`, `failed`。
- **使用场景：** 见 [App Flow Spec](Aegis-App-Flow-Spec.md) §2
- **相关术语：** State Machine, Status

### S

**Secure Enclave / StrongBox**
- **定义：** iOS/Android 设备的安全芯片，用于存储私钥和 CVV，确保敏感数据不离开设备。
- **使用场景：** 见 [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) F-01
- **相关术语：** Credential Vault, Private Key

**Status（状态）**
- **定义：** 见 Request Status

### T

**Transaction Hash（交易哈希）**
- **定义：** 加密货币交易在链上的唯一标识符，格式如 `0xabc123...`。在回调中通过 `tx_hash` 字段返回。
- **使用场景：** 见 [API Spec](Aegis-API-Spec.md) §3.1
- **相关术语：** Crypto Payment, Callback

### U

**Universal Link（通用链接）**
- **定义：** iOS/Android 的深度链接标准，格式如 `https://app.aegis.com/approve?request_id=xxx`，可在未安装 App 时降级到网页。
- **使用场景：** 见 [Mobile UX Spec](Aegis-Mobile-UX-Spec.md) §4.2
- **相关术语：** Deep Link, Push Notification

**User ID（用户 ID）**
- **定义：** 唯一标识 Aegis 用户的字符串，格式如 `usr_demo`。Agent 在请求中可指定 `user_id`（若与多用户绑定）。
- **使用场景：** 见 [API Spec](Aegis-API-Spec.md) §2.1
- **相关术语：** Agent, Authentication

### W

**Webhook（网络钩子）**
- **定义：** 见 Callback URL

---

## 按主题分类

### 认证与安全

- **API Key**: Agent 认证方式
- **OAuth**: Agent 认证方式（可选）
- **Face ID / Touch ID**: 用户生物识别
- **Secure Enclave / StrongBox**: 设备安全芯片
- **PCI DSS**: 信用卡数据合规标准
- **Credential Vault**: 凭证存储系统

### 支付相关

- **Payment Gateway**: 支付网关（Stripe、Adyen）
- **Payment Rail**: 支付通道类型（card/crypto）
- **CVV**: 卡验证值
- **Private Key**: 加密货币私钥
- **Transaction Hash**: 链上交易哈希

### 流程与状态

- **Request ID**: 请求唯一标识
- **Request Status**: 请求状态枚举
- **HITL**: 人机闭环审批
- **Approval Workflow**: 审批工作流
- **Execution Engine**: 执行引擎
- **Action Queue**: 动作队列

### 通知与交互

- **Push Notification**: 推送通知
- **Deep Link**: 深度链接
- **Universal Link**: 通用链接
- **Callback URL**: 回调 URL
- **Webhook**: 网络钩子

### 数据与记录

- **Audit Trail**: 审计轨迹
- **Immutable**: 不可篡改
- **History**: 历史记录

### 系统组件

- **Agent**: AI 代理
- **User ID**: 用户标识
- **Feature ID**: 功能编号（F-01～F-06）

---

## 使用说明

- **查找术语：** 使用 Ctrl+F（或 Cmd+F）搜索关键词
- **理解上下文：** 每个术语包含「使用场景」链接到相关文档章节
- **扩展术语：** 新增术语时按字母顺序添加到对应位置，并更新主题分类

---

## 相关文档

- [主规格](Aegis_%20AI%20Agent%20Consumption%20Authorization%20Protocol%20-%20Product%20Specification.md) - 产品愿景与核心功能
- [API Spec](Aegis-API-Spec.md) - API 端点与数据模型
- [App Flow Spec](Aegis-App-Flow-Spec.md) - 流程与状态机
- [Mobile UX Spec](Aegis-Mobile-UX-Spec.md) - 移动端界面与交互
