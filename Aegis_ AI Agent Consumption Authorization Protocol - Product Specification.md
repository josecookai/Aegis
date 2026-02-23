---
doc_type: spec
version: "1.0"
status: draft
last_updated: "2026-02-22"
author: "Manus AI"
tags:
  - product-spec
  - vision
  - features
dependencies: []
related_docs:
  - Aegis-API-Spec.md
  - Aegis-App-Flow-Spec.md
  - Aegis-Mobile-UX-Spec.md
  - Aegis-Implementation-Todos.md
  - Aegis-Glossary.md
quick_ref: |
  Aegis 是 AI Agent 消费授权协议，作为「人机授权层」让 AI 代理可以安全地代表用户发起支付，而无需暴露用户的信用卡或私钥。核心：Agent API + Mobile App + Secure Enclave + Proxy Execution。
---

# Aegis: AI Agent Consumption Authorization Protocol - Product Specification

---

## 0. TL;DR

**Aegis** 旨在成为 **agentic economy 的通用人机授权层**，让人类可以安全地将任务委托给 AI 代理，确保每个动作（尤其是消费）都经过明确批准。

**核心价值主张：**
- **安全：** 私钥和 CVV 不离开设备，存储在 Secure Enclave/StrongBox；Agent 和后端永不接触原始凭证
- **控制：** 实时、细粒度的单笔交易控制，通过移动端推送通知和生物识别审批
- **统一：** 统一的 API 同时支持传统金融（TradFi）和去中心化金融（DeFi）

**核心组件：**
1. **Aegis Mobile App**：用户的「盾牌」，存储凭证、接收推送、审批请求
2. **Aegis API**：Agent 的入口点，单一 REST 端点 `/v1/request_action`

**核心功能（F-01～F-06）：**
- F-01: Secure Credential Vault（安全凭证库）
- F-02: Multi-Asset Support（多资产支持）
- F-03: Agent-Facing Universal API（Agent 面向的通用 API）
- F-04: Human-in-the-Loop Approval Workflow（人机闭环审批）
- F-05: Proxy Execution Engine（代理执行引擎）
- F-06: Immutable Audit Trail（不可篡改审计轨迹）

**详细规格：** 见 [API Spec](Aegis-API-Spec.md)、[App Flow Spec](Aegis-App-Flow-Spec.md)、[Mobile UX Spec](Aegis-Mobile-UX-Spec.md)

---

## 1. Vision & Mission

### 1.1. Vision

To become the universal **human authorization layer** for the agentic economy, enabling humans to delegate tasks to AI agents with absolute trust and control, ensuring that every action, especially consumption, is explicitly approved.

### 1.2. Mission

Our mission is to build **Aegis**, a consumer-grade security application that acts as a digital guardian for a user's financial assets. Aegis provides a simple, secure, and universal API for AI agents to request spending actions, which are then authorized by the human user via a real-time mobile push notification. We bridge the gap between agent autonomy and human oversight, making agent-driven commerce safe and mainstream.

### 1.3. The Problem

AI agents are rapidly evolving from passive assistants to active participants in our digital lives. They can browse, book, and buy on our behalf. However, this autonomy presents a critical security and trust gap: **how do you let an agent use your money without giving it your keys?**

- **Security Risk:** Exposing raw credit card details or crypto private keys to agent platforms is a massive security vulnerability.
- **Lack of Control:** Pre-set budgets are insufficient. Users need real-time, granular control over individual transactions.
- **Fragmentation:** The payment landscape is fragmented. Agents need a unified way to interact with both traditional finance (TradFi) and decentralized finance (DeFi).

Your idea of a "Cobo Guard for AI Agents" directly addresses this fundamental problem.

## 2. Target Audience & User Personas

### 2.1. Primary Persona: The AI Power User

- **Who they are:** Early adopters, tech professionals, entrepreneurs, and busy individuals who leverage AI agents (like Manus, OpenAI's Operator, etc.) to automate daily tasks such as scheduling, travel booking, shopping, and research.
- **Goals:**
    - Delegate complex, multi-step tasks to agents without fear of unauthorized spending.
    - Maintain a high level of security over their financial assets.
    - Have a simple, intuitive way to approve or deny agent actions from their phone.
- **Pain Points:**
    - "I want my agent to book a flight, but I would never paste my credit card CVV into a prompt."
    - "I'm worried an agent might misunderstand my request and buy the wrong thing or get scammed."

### 2.2. Secondary Persona: The Agent Developer

- **Who they are:** Developers and companies building agentic applications.
- **Goals:**
    - Easily integrate a secure payment and action-authorization mechanism into their agents.
    - Offload the complexity and liability of handling user credentials.
    - Provide their users with a trustworthy and professional experience.
- **Pain Points:**
    - "Building a secure vault for user credit cards is a massive compliance headache (PCI DSS)."
    - "Users are hesitant to grant my agent broad permissions, which limits its capabilities."

## 3. Core Features & Functionality

Aegis consists of two main components: the **Aegis Mobile App** (the human's shield) and the **Aegis API** (the agent's entrypoint).

| Feature ID | Feature Name | Description |
|------------|--------------|-------------|
| F-01 | **Secure Credential Vault** | The Aegis mobile app will use the device's **Secure Enclave / StrongBox** to store and manage encrypted user credentials. **Crucially, raw private keys and CVVs will never leave the device's hardware security module and are never exposed to the agent or our backend.** |
| F-02 | **Multi-Asset Support** | Users can add and manage multiple financial instruments:
- **Crypto Wallets:** Import an existing ETH/SOL private key. The app will support signing transactions for major stablecoins (USDT, USDC).
- **Credit Cards:** Add credit card details (name, number, expiry, CVV). All data is encrypted and stored in a **PCI DSS Level 1 compliant vault** via our payment processor. |
| F-03 | **Agent-Facing Universal API** | A single, simple REST API endpoint (`/v1/request_action`) for any authenticated agent to submit a proposed action. The request will be abstract and declarative (e.g., "Pay $150 to United Airlines"), not a raw transaction. |
| F-04 | **Human-in-the-Loop (HITL) Approval Workflow** | When an agent calls the API, Aegis triggers a **real-time push notification** to the user's mobile device. The notification will contain structured details of the request (Amount, Recipient, Description). The user can approve or deny with a single tap (using Face ID/Touch ID for authentication). |
| F-05 | **Proxy Execution Engine** | Upon user approval, the Aegis backend executes the payment on behalf of the agent. 
- For crypto, it sends the user-signed transaction to the blockchain.
- For credit cards, it uses the vaulted card details to make the payment via a payment gateway (e.g., Stripe, Adyen). |
| F-06 | **Immutable Audit Trail** | Every request, approval, and denial is logged and displayed in the Aegis app, providing the user with a complete, transparent history of all agent activities. |

## 4. System Architecture & User Flow

### 4.1. High-Level Architecture

```mmd
flowchart TD
    subgraph AI Agent Platform
        A[AI Agent]
    end

    subgraph Aegis Cloud Backend
        B(Aegis API Gateway) -- validates agent request --> C{Action Queue}
        C -- new request --> D[Push Notification Service]
        F[Execution Engine] -- executes payment --> G[Payment Gateways / Blockchain]
        H[User Approval DB] -- stores decision --> F
    end

    subgraph User's Mobile Device
        E(Aegis Mobile App)
        subgraph Secure Enclave
            I[Private Keys / CVV]
        end
    end

    A -- 1. POST /v1/request_action --> B
    D -- 2. Sends Push Notification --> E
    E -- 3. User Approves/Denies --> H
    E -- signs with --> I
```

### 4.2. User Approval Flow

1.  **Agent Request:** An AI agent needs to make a payment. It makes a secure, authenticated call to `https://api.aegis.com/v1/request_action`.
    
    **API Request Body (Example):**
    ```json
    {
      "action_type": "payment",
      "details": {
        "amount": "149.99",
        "currency": "USD",
        "recipient_name": "United Airlines",
        "description": "Flight UA-241 SFO to LAX",
        "payment_method_preference": "credit_card"
      },
      "callback_url": "https://agent.example.com/payment_status"
    }
    ```

2.  **Push Notification:** The Aegis backend validates the request and sends a push notification to the user's registered device.
    
    - **Title:** `Aegis: Approval Request`
    - **Body:** `Your AI agent wants to pay $149.99 to United Airlines.`

3.  **Human Approval:** The user opens the notification. The Aegis app displays the full request details. The user taps "Approve" or "Deny" and authenticates with Face ID/Touch ID.

4.  **Proxy Execution:**
    - If **Approved**, the Aegis mobile app signs the approval confirmation and sends it to the backend. The backend's Execution Engine retrieves the vaulted credentials and completes the payment.
    - If **Denied**, the request is terminated.

5.  **Confirmation:** The Aegis backend sends a status update (e.g., `success`, `failed`, `denied`) to the agent's `callback_url`.

## 5. Security & Compliance

This is the most critical aspect of the product.

- **Credential Isolation:** The core principle is that **agents never touch raw credentials**. They only interact with an abstract API.
- **Hardware-Level Security:** All cryptographic signing and credential storage on the user's device will leverage the platform's Secure Enclave (iOS) or StrongBox (Android).
- **PCI DSS Compliance:** For credit card data, we will partner with a PCI DSS Level 1 certified payment processor (e.g., Stripe, Adyen) to handle all storage and processing. Our backend will never store raw CVVs.
- **End-to-End Encryption:** All communication between the agent, our backend, and the mobile app will be encrypted using TLS 1.3.
- **Agent Authentication:** Agents must be registered and authenticated with Aegis using a secure token (e.g., API Key, OAuth) before they can make requests.

## 6. Go-to-Market & Monetization

### 6.1. Go-to-Market Strategy

1.  **Phase 1 (Developer Focus):** Launch an SDK and partner with major agent development frameworks (e.g., LangChain, LlamaIndex) and platforms. Make it incredibly easy for developers to integrate Aegis.
2.  **Phase 2 (Consumer Focus):** Market directly to AI power users through tech communities, social media, and partnerships with popular agent applications.

### 6.2. Monetization Model

A freemium model is recommended to drive adoption:

- **Free Tier:**
    - Up to 10 transactions per month.
    - 1 linked crypto wallet, 1 linked credit card.
    - Standard support.
- **Pro Tier ($5/month):**
    - Unlimited transactions.
    - Unlimited linked wallets and cards.
    - Priority support.
    - Advanced features (see Roadmap).

## 7. Future Roadmap

- **Rule-Based Policies:** Allow users to create rules for auto-approval (e.g., "Auto-approve any transaction under $20 from Amazon").
- **Team & Family Accounts:** Enable multi-user approval workflows for business or family use cases.
- **Expanded Asset Support:** Add support for more blockchains (e.g., Bitcoin Lightning) and payment methods (e.g., ACH, PayPal).
- **Action Authorization:** Extend beyond payments to authorize other sensitive agent actions (e.g., "Delete all files in my Dropbox," "Post a tweet on my behalf").
- **Reputation System:** Build a trust score for registered agents based on their activity and user approval rates.

---

## 8. Specification Index & Implementation

本主规格作为总纲；以下附录与独立文档提供可执行、可验收的细节，供开发与评审使用。

| 文档 | 说明 |
|------|------|
| [Aegis-Implementation-Todos.md](Aegis-Implementation-Todos.md) | **Implementation Todos & Checklist** — 按 Phase 的 Todo 与按 F-01～F-06 的验收 Checklist |
| [Aegis-App-Flow-Spec.md](Aegis-App-Flow-Spec.md) | **Appendix C: App Flow** — 端到端流程、审批状态机、关键子流程、异常与边界（含 Mermaid 图） |
| [Aegis-API-Spec.md](Aegis-API-Spec.md) | **Appendix B: API** — 鉴权、POST /v1/request_action、GET /v1/requests/:id、Webhook 回调、数据模型、限流与幂等 |
| [Aegis-Mobile-UX-Spec.md](Aegis-Mobile-UX-Spec.md) | **Appendix A: Mobile UX** — 设计原则、信息架构、关键界面、推送与深链、无障碍与国际化 |

### 8.1. Implementation Todos & Checklist（摘要）

**Todos（按阶段）：**

- **Phase 0 — 规格与设计：** 完成移动端 UX 规格、API 规格、App 端到端流程说明（含状态机）。
- **Phase 1 — 后端：** 实现 POST /v1/request_action 及鉴权；Action Queue、推送、Execution Engine 与 callback；审计日志存储与查询。
- **Phase 2 — 移动端：** 实现 Secure Enclave/StrongBox 凭证存储与签名；推送接收、审批 UI、Face ID/Touch ID；钱包/信用卡添加与管理（含 PCI 金库对接）。
- **Phase 3 — 集成与合规：** 集成支付网关与链上执行；PCI 与安全审计；SDK/文档供 Agent 开发者集成。

**Checklist（按功能）：**

| ID | 验收要点 |
|----|----------|
| F-01 | 私钥/CVV 不离开设备，仅安全芯片存储与签名 |
| F-02 | 支持 ETH/SOL 钱包 + 信用卡添加与展示（掩码） |
| F-03 | API 文档完整、鉴权明确、请求/响应与幂等 |
| F-04 | 推送 → 打开 App → 审批详情 → 批准/拒绝 → 生物识别 |
| F-05 | 批准后信用卡/加密货币支付正确执行并回调 |
| F-06 | 所有 request/approve/deny 可查、不可篡改 |

完整 Todo 与 Checklist 表格见 [Aegis-Implementation-Todos.md](Aegis-Implementation-Todos.md)。

---

This document provides the foundational product specification for Aegis. Detailed UX, API, and app flow specifications are maintained in the linked appendix documents above. The next steps are to execute against the Implementation Todos and validate each feature using the Checklist.
