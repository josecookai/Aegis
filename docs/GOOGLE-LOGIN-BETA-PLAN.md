# Google 登录 + Beta 上线实现计划

**目标：** 用户 Sign up with Google → 获得 API Key → 添加支付方式 → 今晚 Beta 上线  
**分工：** 4 个 Agent 并行实施

| Agent | 任务 | 预估 |
|-------|------|------|
| Agent 1 | Google 登录 | 30–45 min |
| Agent 2 | Cookie 安全 + 部署与环境变量 | 20–30 min |
| Agent 3 | Get API Key | 15–20 min |
| Agent 4 | 用户添加信用卡（支付方式） | 20–30 min |

---

## Agent 1：Google 登录

### 范围
实现 Google OAuth 2.0 登录，替代 Magic Link。

### Checklist

- [ ] **1.1 依赖安装**
  - `npm install passport passport-google-oauth20`
  - `npm install -D @types/passport @types/passport-google-oauth20`

- [ ] **1.2 Google Cloud Console 配置**
  - 创建 OAuth 2.0 凭据（Web 应用）
  - 授权重定向 URI：`{BASE_URL}/auth/google/callback`
  - 记下 Client ID、Client Secret

- [ ] **1.3 环境变量**
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`

- [ ] **1.4 新建 `src/auth/google.ts`**
  - 配置 `GoogleStrategy`：scope `profile email`
  - `passport.serializeUser` / `deserializeUser`：存 `end_user_id`
  - 在 verify callback 中：用 `profile.emails[0].value` 查找或创建 `end_users`，返回 `{ userId }`

- [ ] **1.5 路由**
  - `GET /auth/google`：`passport.authenticate('google', { scope: ['profile', 'email'] })`
  - `GET /auth/google/callback`：`passport.authenticate` → 成功则创建 `app_session`、设置 `aegis_app_session` cookie、`res.redirect('/dashboard')`；失败则 `res.redirect('/app/login?error=...')`

- [ ] **1.6 挂载**
  - 在 `app.ts` 中 `app.use(passport.initialize())`、`app.use(passport.session())`（若用 session）或直接用 cookie 方案
  - 注：可简化：callback 里手动创建 session + cookie，不用 `passport.session()`

- [ ] **1.7 登录页**
  - `renderAppLoginPage`：移除邮箱表单，改为「Sign in with Google」按钮，链接到 `GET /auth/google`
  - 保留 `/app/login` 路由

- [ ] **1.8 移除或保留 Magic Link**
  - 可选：保留 `POST /auth/magic-link/request` 作为备用，或移除相关代码

### 关键文件
| 文件 | 操作 |
|------|------|
| `src/auth/google.ts` | 新建 |
| `src/app.ts` | 挂载 passport、Google 路由 |
| `src/routes/web.ts` | 新增 `/auth/google`、`/auth/google/callback`，或在此实现 |
| `src/views.ts` | 修改 `renderAppLoginPage` |
| `src/config.ts` | 新增 `googleClientId`、`googleClientSecret` |
| `package.json` | 新增依赖 |

### 验收
- 点击「Sign in with Google」→ 跳转 Google 授权页 → 授权后回到 `/dashboard`
- 新用户自动创建 `end_users` 记录
- Session cookie 正确设置

---

## Agent 2：Cookie 安全 + 部署与环境变量

### 范围
生产环境 Cookie 安全 + 环境变量与部署配置。

### Checklist — Cookie 安全

- [ ] **2.1 根据 BASE_URL 设置 secure**
  - 当 `config.baseUrl.startsWith('https')` 时，`secure: true`
  - 涉及：`aegis_app_session`、`aegis_admin_session`、`aegis_csrf`

- [ ] **2.2 检查所有 `res.cookie` 调用**
  - `src/routes/web.ts`：magic-link verify、logout；admin login
  - 统一：`secure: isHttps`，`httpOnly: true`，`sameSite: 'lax'`

- [ ] **2.3 辅助函数**
  - 在 `src/config.ts` 新增 `isProductionHttps(): boolean`

### Checklist — 部署与环境变量

- [ ] **2.4 环境变量清单**

| 变量 | 必填 | 说明 |
|------|------|------|
| `BASE_URL` | ✅ | 生产 URL |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth |
| `STRIPE_SECRET_KEY` | 可选 | 真实扣款 |
| `STRIPE_PUBLISHABLE_KEY` | 可选 | Stripe Elements |
| `ADMIN_PASSWORD` | 建议 | 修改默认值 |
| `DB_PATH` | Railway | 持久化路径 |

- [ ] **2.5 Google OAuth 重定向 URI**
  - 在 Google Cloud Console 添加：`{BASE_URL}/auth/google/callback`

- [ ] **2.6 部署平台配置**
  - Railway/Vercel 添加环境变量
  - 更新 `docs/DEPLOYMENT.md`

### 关键文件
| 文件 | 操作 |
|------|------|
| `src/routes/web.ts` | 修改 cookie 配置 |
| `src/config.ts` | 新增 `isProductionHttps` |
| `docs/DEPLOYMENT.md` | 更新环境变量 |

### 验收
- 本地 `secure: false`，生产 `secure: true`
- 环境变量配置完整，部署成功

---

## Agent 3：Get API Key

### 范围
确保用户登录后可创建 Agent、获得 API Key，流程清晰可用。

### Checklist

- [ ] **3.1 验证现有流程**
  - `GET /settings/agents` 需 `requireAppSession`（已有）
  - `POST /api/app/agents` 创建 Agent，返回 `api_key`（已有）
  - 确认 Google 登录后的 session 可访问上述接口

- [ ] **3.2 Dashboard 入口**
  - Dashboard 明确展示「Create API Key」或「Manage Agents」入口
  - 链接到 `/settings/agents`

- [ ] **3.3 首次登录引导**
  - 可选：若用户无 Agent，Dashboard 显示醒目 CTA「Create your first API Key」

- [ ] **3.4 API Key 展示**
  - 创建后一次性展示 `api_key`，支持复制
  - 提示「Save it now — it won't be shown again」

- [ ] **3.5 文档链接**
  - Agents 页提供 OpenAPI / 集成文档链接

### 关键文件
| 文件 | 操作 |
|------|------|
| `src/views.ts` | `renderDashboardPage`、`renderAgentsPage` 微调 |
| `src/routes/web.ts` | 确认路由与鉴权 |

### 验收
- 登录 → Dashboard → Agents → 创建 Agent → 获得 API Key → 复制
- 使用该 API Key 调用 `POST /v1/request_action` 成功

---

## Agent 4：用户添加信用卡（支付方式）

### 范围
登录后在设置页填写卡信息（通过 Stripe Elements），安全存储支付方式引用。

### 说明（PCI 合规）
**不可**在数据库存储原始卡号、CVV、有效期。应使用 Stripe Elements：
- 用户在浏览器填写：卡号、有效期、CVC、持卡人姓名
- Stripe.js 在前端 tokenize，仅将 `payment_method_id` (pm_xxx) 传给后端
- 后端只存 `pm_xxx` 及元数据（brand、last4），不存敏感信息

### Checklist

- [ ] **4.1 支付方式页可访问**
  - `GET /settings/payment-methods` 需 `requireAppSession`（已有）
  - 确认 Google 登录后可访问

- [ ] **4.2 Stripe Elements 表单**
  - 已有：`#card-element` 收集卡号、有效期、CVC
  - 可选：增加 `billing_details.name` 的 `Elements` 字段，或单独 name 输入框（用于显示，不存卡面）

- [ ] **4.3 持卡人姓名**
  - Stripe Elements 支持 `payment_method_data.billing_details.name`
  - 在 `createPaymentMethod` 时传入 `billing_details: { name: form.name.value }`

- [ ] **4.4 存储逻辑**
  - 后端 `POST /api/app/payment-methods` 已实现：接收 `payment_method_id`，存 `payment_methods` 表
  - 存：`external_token` (pm_xxx)、`alias` (如 "Visa **** 4242")、`metadata_json` (brand, last4, stripe_customer_id)

- [ ] **4.5 Dashboard 入口**
  - Dashboard 明确展示「Add payment method」或「Payment Methods」入口
  - 链接到 `/settings/payment-methods`

- [ ] **4.6 首次添加引导**
  - 可选：若用户无支付方式，Dashboard 提示「Add a card to enable payments」

- [ ] **4.7 测试卡**
  - 页面上注明测试卡：`4242 4242 4242 4242`，任意未来日期，任意 CVC

### 关键文件
| 文件 | 操作 |
|------|------|
| `src/views.ts` | `renderPaymentMethodsPage`：可选增加 name 输入、Stripe billing_details；`renderDashboardPage`：支付方式入口 |
| `src/routes/app.ts` | 确认 `POST /api/app/payment-methods` 逻辑 |

### 验收
- 登录 → Payment Methods → 填写卡信息（Stripe Elements）→ 保存
- 列表中显示新卡（如 "Visa **** 4242"）
- 数据库 `payment_methods` 表有记录，且**无**原始卡号/CVV

---

## 实施顺序与依赖

```
Agent 1 (Google 登录)     ─┬─→ 必须最先，其他依赖登录流程
Agent 2 (Cookie + 部署)   ─┤   可与 Agent 1 并行
Agent 3 (Get API Key)     ─┤   依赖 Agent 1 完成
Agent 4 (信用卡)          ─┘   依赖 Agent 1 完成
```

**建议执行顺序：**
1. **Agent 1** 与 **Agent 2** 并行
2. **Agent 1** 完成后，**Agent 3** 与 **Agent 4** 并行
3. **Agent 2** 最后做部署验证

---

## 总验收清单

- [ ] 用户点击「Sign in with Google」→ 授权 → 进入 Dashboard
- [ ] 用户可创建 Agent，获得 API Key，可复制
- [ ] 用户可添加支付方式（Stripe Elements），卡信息不落库
- [ ] 生产环境 Cookie 安全（secure: true when HTTPS）
- [ ] 部署成功，环境变量正确
