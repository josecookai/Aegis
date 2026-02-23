# Aegis: E2E Demo 手动测试脚本

> 用于演示 Aegis 从「Agent 创建请求 → App 审批 → 查看历史」的完整闭环。
> 最后更新：2026-02-23

---

## 前置条件

- Node.js 18+
- Xcode + iOS Simulator（或 Expo Go）
- 项目根目录已执行 `npm install`
- `app/` 目录已执行 `npm install`
- `.env` 文件已基于 `.env.example` 创建（默认值即可）

---

## Step 1: 启动后端

```bash
cd /path/to/Holdis
npm run dev
```

预期输出：服务器在 `http://localhost:3000` 启动。可访问 `http://localhost:3000/healthz` 验证健康检查返回 `ok`。

---

## Step 2: 启动 Expo App

新开终端：

```bash
cd /path/to/Holdis/app
npx expo start --ios
```

等待 iOS Simulator 打开并加载 Aegis App。首页应显示「暂无待审批请求」空状态。

---

## Step 3: 用 curl 创建一条审批请求

```bash
curl -X POST http://localhost:3000/v1/request_action \
  -H 'X-Aegis-API-Key: aegis_demo_agent_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "action_type": "payment",
    "end_user_id": "usr_demo",
    "details": {
      "amount": "49.99",
      "currency": "USD",
      "recipient_name": "OpenAI",
      "description": "GPT-4 API credits top-up"
    },
    "callback_url": "https://httpbin.org/post"
  }'
```

**预期响应（201）：**

```json
{
  "action": {
    "action_id": "act_xxxxxxxx",
    "status": "awaiting_approval",
    ...
  },
  "links": {
    "approval_url": "http://localhost:3000/approve/mltok_xxxxxxxx"
  }
}
```

记下响应中的 `action_id`。

---

## Step 3.5: 在 App 首页验证 pending 卡片

在模拟器中的 Aegis App 首页，**下拉刷新**（或等自动轮询）。

**预期：** 首页从空状态变为展示一张 pending 卡片：
- 金额：**$49.99 USD**
- 收款方：**OpenAI**
- 描述：GPT-4 API credits top-up
- 时间戳

> 也可以用 curl 验证：`curl "http://localhost:3000/api/app/pending?user_id=usr_demo"`，应返回 `count: 1`。

---

## Step 4: 获取 Magic Link Token

打开浏览器访问：

```
http://localhost:3000/dev/emails
```

找到最新一封发送给 `demo.user@example.com` 的邮件，其中包含审批链接，格式如：

```
http://localhost:3000/approve/mltok_xxxxxxxx
```

从 URL 中提取 token（`mltok_xxxxxxxx` 部分）。

---

## Step 5: 进入审批详情页（两种方式任选）

**方式 A — 从首页点击卡片（推荐，验证完整链路）：**

在模拟器中点击 Step 3.5 看到的 pending 卡片，App 自动跳转到审批详情页。

**方式 B — 通过 Deep Link：**

在终端中执行（将 `TOKEN` 替换为 Step 4 提取的 token）：

```bash
xcrun simctl openurl booted "aegis://approve?token=mltok_xxxxxxxx"
```

**两种方式预期结果相同，** 审批详情页展示：
- 金额：$49.99 USD
- 收款方：OpenAI
- 描述：GPT-4 API credits top-up

---

## Step 6: 完成审批流程

在模拟器的审批详情页中：

1. **查看详情** — 确认金额、收款方、描述正确
2. **点击「批准」** — 触发 FaceID 弹窗（模拟器中选择 Features → Face ID → Matching Face 模拟通过）
3. **确认结果** — 应看到成功提示 Alert（「已批准，正在处理」）
4. **返回首页** — 自动或手动返回；首页应无更多待审批卡片

---

## Step 6.5: 在 App 中验证首页清空 + 历史记录

1. **返回首页** — 批准成功后返回首页，pending 卡片应已消失，恢复空状态「暂无待审批请求」
2. **切到历史 Tab** — 底部导航点击「历史」，应看到一条记录：
   - 金额：$49.99 USD
   - 收款方：OpenAI
   - 状态 badge：**已批准** / **已完成**（取决于 mock 执行进度）

---

## Step 7: 验证待审批列表 API

确认请求已不在 pending 列表中：

```bash
curl "http://localhost:3000/api/app/pending?user_id=usr_demo"
```

**预期响应：**

```json
{
  "items": [],
  "count": 0
}
```

---

## Step 8: 验证历史列表 API

确认记录出现在历史中：

```bash
curl "http://localhost:3000/api/app/history?user_id=usr_demo&limit=10&offset=0"
```

**预期响应：**

```json
{
  "items": [
    {
      "action_id": "act_xxxxxxxx",
      "status": "approved",
      ...
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

`status` 应为 `approved`、`executing` 或 `succeeded`（取决于 mock 执行速度）。

---

## Step 9: （可选）验证 Agent 状态查询

```bash
curl http://localhost:3000/v1/actions/act_xxxxxxxx \
  -H 'X-Aegis-API-Key: aegis_demo_agent_key'
```

应返回该 action 的完整信息及终态。

---

## 预期结果 Checklist

| # | 检查项 | 预期 | 通过 |
|---|--------|------|------|
| 1 | 后端启动无报错 | `localhost:3000/healthz` 返回 ok | ⬜ |
| 2 | App 首页展示空状态 | 「暂无待审批请求」 | ⬜ |
| 3 | curl 创建请求返回 201 | 响应含 `action_id` 和 `approval_url` | ⬜ |
| 4 | **首页展示 pending 卡片** | 下拉刷新后出现卡片：$49.99、OpenAI | ⬜ |
| 5 | `/dev/emails` 显示审批邮件 | 包含 magic link token | ⬜ |
| 6 | 进入审批详情页（卡片点击或 Deep Link） | 金额 $49.99、收款方 OpenAI | ⬜ |
| 7 | 点击批准触发 FaceID | 模拟器弹出生物识别 | ⬜ |
| 8 | 批准后首页 pending 卡片消失 | 恢复空状态「暂无待审批请求」 | ⬜ |
| 9 | **历史 Tab 展示已完成记录** | 一条记录，状态 badge 为「已批准」/「已完成」 | ⬜ |
| 10 | `GET /api/app/pending` 返回空 | `count: 0` | ⬜ |
| 11 | `GET /api/app/history` 返回记录 | 含已批准的 action | ⬜ |
| 12 | Agent 查询状态为终态 | `approved` / `executing` / `succeeded` | ⬜ |

---

## 故障排查

| 问题 | 解决 |
|------|------|
| `ECONNREFUSED localhost:3000` | 确认后端已启动；检查 `.env` 中 `PORT=3000` |
| Deep Link 无响应 | 确认 `app.json` 中配置了 `aegis://` scheme；确认模拟器中 App 已安装 |
| FaceID 未弹出 | Simulator → Features → Enroll → Face ID；批准时选 Matching Face |
| API 返回 401 | 检查 `X-Aegis-API-Key` 是否为 `aegis_demo_agent_key` |
| History 返回空 | 确认 `user_id=usr_demo`（区分大小写） |
