# 4 Agent 运行指南

复制下方对应 Prompt 到 Cursor Composer，或使用 `mcp_task` 批量启动。

---

## Agent 1 Prompt（Google 登录）

```
你负责实现 Google OAuth 登录。请严格按 docs/GOOGLE-LOGIN-BETA-PLAN.md 中「Agent 1：Google 登录」的 Checklist 执行。

任务：
1. 安装 passport、passport-google-oauth20 及类型定义
2. 在 src/config.ts 新增 googleClientId、googleClientSecret（从 process.env 读取）
3. 新建 src/auth/google.ts：配置 GoogleStrategy，用 profile.emails[0].value 查找或创建 end_users，在 verify callback 中返回 userId
4. 在 web 路由或新建 auth 路由中实现：
   - GET /auth/google：redirect 到 Google 授权
   - GET /auth/google/callback：接收 code，创建 app_session，设置 aegis_app_session cookie，redirect 到 /dashboard
5. 修改 renderAppLoginPage：移除邮箱表单，改为「Sign in with Google」按钮，链接到 /auth/google
6. 在 app.ts 中挂载 passport.initialize() 及 Google 路由

注意：callback 中可简化实现，不用 passport.session()，手动创建 session 并 set cookie 即可。
完成后运行 npm test 确保通过。
```

---

## Agent 2 Prompt（Cookie 安全 + 部署）

```
你负责 Cookie 安全与部署配置。请严格按 docs/GOOGLE-LOGIN-BETA-PLAN.md 中「Agent 2：Cookie 安全 + 部署与环境变量」执行。

任务：
1. 在 src/config.ts 新增 isProductionHttps(): boolean（当 baseUrl.startsWith('https') 时返回 true）
2. 查找所有 res.cookie 调用（src/routes/web.ts 等），当 isProductionHttps() 时设置 secure: true
3. 确保 httpOnly: true、sameSite: 'lax'
4. 更新 docs/DEPLOYMENT.md：补充 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、BASE_URL 等环境变量说明
5. 添加 Google OAuth 重定向 URI 配置说明：{BASE_URL}/auth/google/callback

完成后运行 npm test 确保通过。
```

---

## Agent 3 Prompt（Get API Key）

```
你负责 Get API Key 流程优化。请严格按 docs/GOOGLE-LOGIN-BETA-PLAN.md 中「Agent 3：Get API Key」执行。

任务：
1. 确认 /settings/agents 和 POST /api/app/agents 在 requireAppSession 下正常工作
2. 在 renderDashboardPage 中强化「Create API Key」或「Manage Agents」入口，链接到 /settings/agents
3. 若用户无 Agent，Dashboard 显示醒目 CTA「Create your first API Key」
4. 确认 renderAgentsPage 创建 Agent 后一次性展示 api_key 并支持复制，提示「Save it now — it won't be shown again」
5. Agents 页提供 OpenAPI 文档链接（/docs/openapi.yaml）

注意：不要修改登录逻辑，只优化 Dashboard 和 Agents 页的展示与入口。
完成后运行 npm test 确保通过。
```

---

## Agent 4 Prompt（用户添加信用卡）

```
你负责用户添加支付方式流程。请严格按 docs/GOOGLE-LOGIN-BETA-PLAN.md 中「Agent 4：用户添加信用卡」执行。

任务：
1. 确认 /settings/payment-methods 在 requireAppSession 下可访问
2. 在 renderPaymentMethodsPage 中，Stripe Elements 的 createPaymentMethod 增加 billing_details.name（持卡人姓名），可从表单单独输入框获取
3. 在 renderDashboardPage 中强化「Add payment method」或「Payment Methods」入口，链接到 /settings/payment-methods
4. 若用户无支付方式，Dashboard 显示提示「Add a card to enable payments」
5. 页面上注明测试卡：4242 4242 4242 4242

注意：使用 Stripe Elements tokenize，后端只存 payment_method_id，不存原始卡号/CVV。现有 POST /api/app/payment-methods 已正确实现，只需确保前端传 billing_details。
完成后运行 npm test 确保通过。
```

---

## 如何让 4 个 Agent 自动运行

### 方式一：Cursor Composer 手动（推荐，避免冲突）

1. 打开 4 个 Composer 对话（或 4 个 Cursor 窗口）
2. 先运行 **Agent 1**，等待完成
3. 再并行运行 **Agent 2、3、4**（各粘贴对应 Prompt）

### 方式二：mcp_task 批量启动（需 Cursor Agent 模式）

在 Agent 模式下，可依次调用 `mcp_task` 启动子 Agent：

**第一步：先跑 Agent 1**
```
使用 mcp_task，subagent_type: generalPurpose，prompt 为 Agent 1 的完整任务描述
```

**第二步：Agent 1 完成后，并行跑 Agent 2、3、4**
```
同时发起 3 个 mcp_task，分别对应 Agent 2、3、4 的 prompt
```

### 方式三：单次消息启动（示例）

在 Cursor 中发送：

```
按 docs/AGENT-PROMPTS.md 和 docs/GOOGLE-LOGIN-BETA-PLAN.md，依次执行 4 个 Agent 任务：

1. 先执行 Agent 1（Google 登录），完成后
2. 并行执行 Agent 2、3、4

请按顺序完成，每步运行 npm test 验证。
```

由主 Agent 串行/并行调度子任务。

### 依赖关系

```
Agent 1 (Google) ──必须完成──┐
                             ├──→ Agent 3 (API Key)
                             └──→ Agent 4 (信用卡)
Agent 2 (Cookie+部署) ──可并行 Agent 1──→ 最后验证部署
```

**建议顺序：** Agent 1 → (Agent 2 ∥ Agent 3 ∥ Agent 4) → 部署验证

---

## 一键启动（复制到 Cursor）

在 Cursor Composer 中粘贴以下内容，让 AI 自动调度 4 个 Agent：

```
请按 docs/AGENT-PROMPTS.md 和 docs/GOOGLE-LOGIN-BETA-PLAN.md 执行 Beta 上线任务。

执行顺序：
1. 先完成 Agent 1（Google 登录）— 必须最先
2. Agent 1 完成后，并行执行 Agent 2、3、4

每个 Agent 的完整 Prompt 见 docs/AGENT-PROMPTS.md。请依次实现，每步运行 npm test 验证。
```

或使用 mcp_task 分别启动（在 Agent 模式下）：

- `mcp_task(subagent_type="generalPurpose", prompt="[Agent 1 的完整 prompt]")` — 先执行
- 完成后并行：`mcp_task` x3，分别传入 Agent 2、3、4 的 prompt
