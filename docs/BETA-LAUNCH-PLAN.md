# Beta 上线开发计划

**目标：** 今晚完成 Beta 级上线，让真实用户 Sign up 获得自己的 API Key  
**时间：** 今晚（2–4 小时）

---

## 1. 当前状态 vs 目标

| 能力 | 当前 | Beta 目标 |
|------|------|-----------|
| 用户注册 | Magic Link 创建用户 ✓ | 同左，但需**真实发邮件** |
| 邮件投递 | 仅落 `email_outbox`，/dev/emails 查看 | **Resend 真实发送** |
| 登录后流程 | verify → `/` | verify → `/dashboard`（或 redirect） |
| API Key | 创建 Agent 即得 ✓ | 同左 ✓ |
| 部署 | Railway/Vercel 已有 | 确认生产 URL、环境变量 |

---

## 2. 必做项（今晚上线）

### 2.1 真实邮件发送（Resend）

**问题：** 当前 `queueEmail` 只写入 `email_outbox`，不发真实邮件。

**方案：** 集成 Resend（免费 tier 3000 封/月，API 简单）

| 步骤 | 内容 | 预估 |
|------|------|------|
| 1 | `npm install resend` | 1 min |
| 2 | 新增 `RESEND_API_KEY` 环境变量 | — |
| 3 | 新建 `src/services/emailSender.ts`：若 `RESEND_API_KEY` 存在则调用 Resend 发邮件，否则 fallback 到 outbox | 15 min |
| 4 | `NotificationService` 调用 `emailSender.send()` 而非仅 `store.queueEmail` | 5 min |
| 5 | 配置 `EMAIL_FROM` 为 Resend 验证域名（如 `onboarding@resend.dev` 或自有域名） | — |

**Resend 示例：**
```ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
await resend.emails.send({ from: 'Aegis <onboarding@resend.dev>', to, subject, html: bodyHtml });
```

---

### 2.2 Magic Link 支持 redirect

**问题：** 用户从 `/app/login?redirect=/dashboard` 提交邮箱后，邮件里的链接没有 `redirect`，点开落到 `/`。

**方案：**

| 步骤 | 内容 | 预估 |
|------|------|------|
| 1 | `POST /auth/magic-link/request` 接受 body `{ email, redirect?: string }` | 2 min |
| 2 | `requestLoginMagicLink(email, redirect?)` 传入 redirect | 2 min |
| 3 | `sendLoginMagicLinkEmail` 在 URL 中追加 `&redirect=...` | 2 min |
| 4 | 前端 `/app/login` 表单提交时带上 `redirect` 参数 | 2 min |

---

### 2.3 Cookie secure 与 sameSite

**问题：** 生产环境 HTTPS 下，`secure: false` 可能导致 cookie 不生效。

**方案：**

| 步骤 | 内容 | 预估 |
|------|------|------|
| 1 | 当 `BASE_URL.startsWith('https')` 时，设置 `secure: true` | 3 min |
| 2 | `sameSite: 'lax'` 保持（支持从邮件链接跳转） | — |

---

### 2.4 首页 CTA 强化

**问题：** 新用户需要一眼看到「开始使用」。

**方案：**

| 步骤 | 内容 | 预估 |
|------|------|------|
| 1 | 首页主 CTA 增加「Get API Key」或「Sign up」按钮，链接到 `/app/login` | 5 min |
| 2 | 副文案：「Sign up → Get API Key → Integrate in minutes」 | 2 min |

---

### 2.5 部署与环境变量检查

**清单：**

| 变量 | 必填 | 说明 |
|------|------|------|
| `BASE_URL` | ✅ | 生产 URL，如 `https://aegis-production-xxx.up.railway.app` |
| `RESEND_API_KEY` | ✅ | Resend API Key |
| `EMAIL_FROM` | ✅ | Resend 验证过的发件地址，如 `Aegis <onboarding@resend.dev>` |
| `STRIPE_SECRET_KEY` | 可选 | 若需真实扣款 |
| `STRIPE_PUBLISHABLE_KEY` | 可选 | 添加卡页 |
| `ADMIN_PASSWORD` | 建议 | 修改默认值 |
| `DB_PATH` | Railway | 持久化路径，如 `/data/aegis.db` |

---

## 3. 可选（今晚后补）

| 项 | 说明 |
|----|------|
| 限流 | Magic link 请求限流（如 5 次/分钟/IP）防滥用 |
| 欢迎邮件 | 首次 sign up 发欢迎邮件 + 快速开始链接 |
| 错误页 | 404、500 友好页 |
| 监控 | Sentry / Logtail 等 |

---

## 4. 实施顺序（今晚）

```
1. Resend 集成（约 25 min）
   → 本地用 RESEND_API_KEY 测试发一封邮件

2. Magic link redirect（约 10 min）
   → 本地 /app/login?redirect=/dashboard 全流程验证

3. Cookie secure（约 5 min）

4. 首页 CTA（约 5 min）

5. 部署检查
   → Railway/Vercel 配置 RESEND_API_KEY、EMAIL_FROM、BASE_URL
   → 触发 redeploy
   → 真实邮箱 E2E：sign up → 收邮件 → 点链接 → dashboard → 创建 Agent → 复制 API Key
```

**总计：** 约 45–60 分钟开发 + 15 分钟部署验证

---

## 5. 验收标准

- [ ] 用户输入邮箱 → 收到真实邮件（非 dev outbox）
- [ ] 点击邮件链接 → 跳转 `/dashboard`（或指定 redirect）
- [ ] Dashboard 显示用户信息
- [ ] 创建 Agent → 获得 API Key，可复制
- [ ] 使用该 API Key 调用 `POST /v1/request_action` 成功

---

## 6. 关键文件

| 文件 | 变更 |
|------|------|
| `src/services/emailSender.ts` | 新建，Resend 封装 |
| `src/services/notifications.ts` | 调用 emailSender |
| `src/services/aegis.ts` | `requestLoginMagicLink(email, redirect?)` |
| `src/routes/web.ts` | magic-link/request 接受 redirect；cookie secure |
| `src/views.ts` | 首页 CTA；login 表单传 redirect |
| `package.json` | 新增 `resend` 依赖 |
