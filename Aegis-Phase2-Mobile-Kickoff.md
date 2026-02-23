---
doc_type: plan
version: "1.0"
status: draft
last_updated: "2026-02-23"
author: "Manus AI"
tags:
  - phase2
  - mobile
  - kickoff
related_docs:
  - Aegis-Implementation-Todos.md
  - Aegis-Mobile-UX-Spec.md
  - Aegis-App-Flow-Spec.md
  - Aegis-API-Spec.md
quick_ref: |
  Phase 2 移动端启动说明：P2-2 优先（推送 + 审批 UI + 生物识别），再 P2-3（资产）、P2-1（Secure Enclave 签名）。技术栈可选 React Native/Expo、Flutter 或原生。
---

# Aegis Phase 2：移动端启动说明

**目标：** 尽快有移动端，实现「推送 → 打开 App → 审批详情 → 批准/拒绝 → 生物识别」闭环（F-04），并逐步覆盖资产管理与安全芯片签名。

---

## 1. Phase 2 任务与优先级

| 优先级 | ID | Task | 说明 |
|--------|-----|------|------|
| **P0** | P2-2 | 推送接收、审批 UI、Face ID/Touch ID 校验 | 先跑通 HITL 全流程，与现有后端/Web 审批并行可测 |
| P1 | P2-3 | 钱包/信用卡添加与管理（含 PCI 金库对接） | 审批时需选择支付方式；可先 mock 或单卡 |
| P2 | P2-1 | Secure Enclave/StrongBox 凭证存储与签名 | 加密货币签名、敏感数据存芯片；可先做「审批 + 生物识别」，签名后续 |

**建议顺序：** 先做 P2-2（审批闭环）→ 再做 P2-3（资产管理）→ 最后 P2-1（安全芯片深度集成）。

---

## 2. 技术栈建议

| 选项 | 适用场景 | 说明 |
|------|----------|------|
| **React Native + Expo** | 快速出双端、团队偏前端 | 推送用 Expo Notifications；Deep Link 用 expo-linking；生物识别用 expo-local-authentication |
| **Flutter** | 双端一致、偏 Dart 生态 | 推送用 firebase_messaging；Deep Link 用 uni_links / app_links；生物识别用 local_auth |
| **原生 iOS + Android** | 对 Secure Enclave/StrongBox 要求高、长期维护 | 推送 APNs/FCM；Universal Links / App Links；LocalAuthentication / BiometricPrompt |

**推荐起步：** React Native (Expo) 或 Flutter，便于 1～2 周内完成「列表 + 详情 + 批准/拒绝 + 生物识别 + Deep Link」可演示版本；Secure Enclave 集成可在 P2-1 阶段用原生模块或 channel 补充。

---

## 3. 与后端/Spec 的对接点

- **用户与设备**：移动端需「登录/注册」及「上报推送 token」（FCM/APNs token）到后端；当前 MVP 为邮件 magic link，移动端上线后需新增「设备注册 + 推送 token」接口（或复用现有用户体系）。
- **待审批列表**：拉取当前用户 `status = awaiting_approval` 的请求。需后端提供 **App 侧接口**（如 `GET /v1/me/pending_requests` 或 `GET /v1/actions?status=awaiting_approval`），用户鉴权（Session / OAuth / 设备 token）。
- **审批详情**：按 `request_id`（或 `action_id`）拉取单条详情，与现有 `GET /v1/actions/:actionId` 或 `GET /v1/requests/:id` 对齐；移动端使用用户鉴权。
- **提交决策**：**批准/拒绝** 需后端提供 **App 侧接口**（如 `POST /v1/me/requests/:id/approve`、`POST /v1/me/requests/:id/deny`），请求体可含「批准时选的 payment_method」等；当前 MVP 为 Web 表单提交，需在后端增加面向 App 的端点或在现有 approval 流程上增加鉴权方式。
- **推送**：后端在「新请求入队」后，除发邮件外，向该用户已注册设备的 FCM/APNs 发推送，payload 含 `request_id` 或 `action_id`；Deep Link 为 `aegis://approve?request_id=xxx`（或 Universal Link）。

以上对接点在 [Aegis-API-Spec.md](Aegis-API-Spec.md) 中可注明「App 专用」并与 Agent 端点区分。

---

## 4. 第一里程碑：P2-2 可演示范围（约 1～2 周）

### 4.1. 范围

- **待审批列表**：一屏列表，展示 pending 请求（金额、收款方、时间）；点击进详情。
- **审批详情**：大字号金额与收款方、描述；主按钮「批准」「拒绝」；批准前触发 Face ID/Touch ID（或设备 PIN 降级）。
- **Deep Link**：支持 `aegis://approve?request_id=xxx`（或 `https://app.aegis.com/approve?request_id=xxx`），从推送或外部打开直接进入该 request 的审批详情。
- **提交决策**：调用后端「App 侧」批准/拒绝接口；成功后展示 Toast 或结果页，并返回列表。
- **推送**：后端集成 FCM/APNs，新请求时向已绑定设备发推送；推送正文含金额与收款方，点击打开 App 并带上 `request_id`。

### 4.2. 后端需补齐（若尚未有）

- 设备注册与推送 token 存储（表 + 接口）。
- 面向 App 的「待审批列表」与「单条详情」接口（用户鉴权）。
- 面向 App 的「批准/拒绝」接口（用户鉴权；可与现有 Web 审批共用一个业务逻辑，仅鉴权不同）。
- 新请求时除邮件外再发 FCM/APNs 推送。

### 4.3. 当前进度（App 已搭建）

- **仓库位置**：根目录下 `app/`（Expo SDK 52 + Expo Router）。
- **已实现**：审批详情屏（`app/app/approve.tsx`）、Deep Link `aegis://approve?token=<magic_link_token>`、生物识别（expo-local-authentication）后提交批准/拒绝；后端 App 侧 API 见 [Aegis-API-Spec.md §9](Aegis-API-Spec.md)。
- **运行与验证**：见 `app/README.md`（`npm install`、`expo start`、真机需配置 `EXPO_PUBLIC_API_URL`）。

### 4.4. 移动端仓库建议（可选独立仓库）

- **方式 A**：本仓库下新建目录 `app/`（如 `app/react-native` 或 `app/flutter`），与后端、文档同仓。
- **方式 B**：独立仓库 `Aegis-Mobile`，README 中说明与 Aegis 后端、API Spec、Mobile UX Spec 的对应关系。

---

## 5. 下一步动作

**第一里程碑（审批闭环）已完成的项：**

1. **技术栈**：Expo SDK 52 + Expo Router，项目在 `app/`。
2. **App 侧 API**：见 [Aegis-API-Spec.md §9](Aegis-API-Spec.md)（`GET /api/app/approval?token=`、`POST /api/app/approval/decision`）；后端已实现并挂载。
3. **第一个屏幕**：审批详情页 `app/app/approve.tsx`，用 token 拉取详情并展示金额/收款方/描述，批准/拒绝按钮对接上述 API。
4. **Deep Link**：`aegis://approve?token=<magic_link_token>`，从链接进入即打开审批详情并带 token。
5. **生物识别**：批准前调用 `expo-local-authentication`，通过后再提交 `decision_source: app_biometric`。

**后续可做：**

- 在 [Aegis-Implementation-Todos.md](Aegis-Implementation-Todos.md) 中将 P2-2 子项勾选并更新「第一里程碑」完成情况。
- 真机/模拟器 E2E：后端 `npm run dev`，从 `/dev/emails` 取 token，在设备上打开 `aegis://approve?token=TOKEN` 验证全流程。
- 设备注册与推送（FCM/APNs）、待审批列表接口，见 §4.2。

---

## 6. 参考文档

- **界面与交互**：[Aegis-Mobile-UX-Spec.md](Aegis-Mobile-UX-Spec.md) — 主导航、待审批列表、审批详情、推送与深链、无障碍
- **流程与状态**：[Aegis-App-Flow-Spec.md](Aegis-App-Flow-Spec.md) — 收到审批请求子流程、状态机、与 API/UX 对齐表
- **API**：[Aegis-API-Spec.md](Aegis-API-Spec.md) — 现有 Agent 端点；App 专用端点待补充
- **任务清单**：[Aegis-Implementation-Todos.md](Aegis-Implementation-Todos.md) — P2-1、P2-2、P2-3 与 F-04 验收标准
