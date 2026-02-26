# Aegis End-user Auth Setup（Google / GitHub / Email+Password）

> 终端用户登录/注册入口：`/auth`

## 1. 支持模式

- Google OAuth
- GitHub OAuth
- Email + Password
- Password reset link request（请求重置链接，最小闭环）

默认入口：`/auth?mode=signup`

## 2. 本地开发（最小闭环）

只验证 Email+Password 时，无需配置 OAuth。

```bash
npm install
npm run dev
open http://localhost:3000/auth
```

## 3. 环境变量

`.env` / 部署环境中可配置：

```bash
PASSWORD_HASH_PEPPER=change_me
AUTH_OAUTH_STATE_TTL_MINUTES=10

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=
```

若未配置 Google/GitHub，页面会显示 provider 按钮，但不可用（降级行为）。

## 4. OAuth 回调地址（本地）

- Google: `http://localhost:3000/auth/oauth/google/callback`
- GitHub: `http://localhost:3000/auth/oauth/github/callback`

若未显式设置 `*_OAUTH_REDIRECT_URI`，后端默认使用 `BASE_URL + callback path`。

### 4.1 真实 OAuth 配置校验（推荐先做）

启动服务后检查：

```bash
curl http://localhost:3000/auth/oauth/providers
```

预期（示例）：

- `google.enabled=true`（已配置 Google）
- `github.enabled=true`（已配置 GitHub）
- `redirect_uri` 与你在 Google/GitHub 控制台配置的 callback URL 完全一致

如果 `enabled=false`：

1. 检查 `CLIENT_ID/CLIENT_SECRET` 是否已设置
2. 检查环境变量是否被进程读取（重启服务）
3. 检查 `BASE_URL` / `*_OAUTH_REDIRECT_URI` 是否正确

## 5. 账号绑定规则（当前实现）

- 认证成功后，以 email 为主键查找现有 `end_users`
- 命中 active 用户：自动绑定并登录
- 未命中：自动创建新的 `end_user` 并登录
- 命中 inactive 用户：拒绝登录（`INACTIVE_USER`）

## 6. 常见错误码

| 错误码 | 含义 | 处理建议 |
|--------|------|----------|
| `INVALID_CREDENTIALS` | 邮箱或密码错误 | 检查邮箱/密码；登录错误不区分具体原因 |
| `EMAIL_ALREADY_REGISTERED` | 邮箱已注册 | 切换到 Sign in 或走重置流程（后续可加） |
| `WEAK_PASSWORD` | 密码过弱 | 至少 8 位 |
| `OAUTH_PROVIDER_NOT_ENABLED` | Provider 未配置 | 补齐 `CLIENT_ID/CLIENT_SECRET` |
| `OAUTH_INVALID_STATE` | OAuth state 无效/重放 | 重新发起登录 |
| `OAUTH_STATE_EXPIRED` | OAuth state 过期 | 重新发起登录 |
| `OAUTH_TOKEN_EXCHANGE_FAILED` | code 换 token 失败 | 检查 client secret、callback URL |
| `OAUTH_PROFILE_FETCH_FAILED` | 拉取 profile/email 失败 | 检查 provider scope 和 API 可用性 |
| `OAUTH_EMAIL_REQUIRED` | Provider 未返回 email | 确认授权 scope（GitHub 需要 `user:email`） |

## 6.1 密码重置（当前范围）

当前已支持（最小闭环）：

- `POST /auth/password-reset/request`（请求重置链接）
- `GET /auth/password-reset?token=...`（重置密码表单）
- `POST /auth/password-reset/confirm`（提交新密码）
- 若账号存在，请求阶段会写入 dev email outbox（`/dev/emails`）

## 7. 验证建议

自动化测试：

```bash
npx vitest run tests/auth.test.ts
```

Auth smoke E2E（本地）：

```bash
./scripts/auth-e2e-smoke.sh
# 或
npm run e2e:auth
```

手工验收：

1. `/auth` 页面可打开，三种模式可见
2. Email+Password 注册成功并显示已登录态
3. 退出后 Email+Password 登录成功
4. 未配置 OAuth 时 provider 按钮降级行为正确
5. 配置 OAuth 后 Google/GitHub callback 成功登录
6. Sign in 页点击 `Forgot password?` 可成功请求重置链接（查看 `/dev/emails`）
7. 打开 reset link，提交新密码后可用新密码登录
8. `GET /auth/oauth/providers` 返回的 `enabled` 与 callback URL 配置正确

## 8. 用户门户与登录态（补充）

- `/dashboard`
- `/settings/payment-methods`
- `/settings/api-keys`

以上页面当前优先使用 `app_session` cookie 识别用户；仍兼容 `?user_id=` 以便内部联调与回归测试。
