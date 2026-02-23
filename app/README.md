# Aegis Mobile (Expo)

移动端审批 App：通过 Deep Link 打开审批详情，支持 Face ID/Touch ID 后批准/拒绝。

## 技术栈

- **Expo** (SDK 52) + **Expo Router**（文件路由）
- **expo-local-authentication**：生物识别
- **expo-linking**：Deep Link 解析（由 Router 处理）

## Deep Link

- **Scheme:** `aegis`
- **审批页:** `aegis://approve?token=<magic_link_token>`
- 邮件中的审批链接形如 `https://host/approve/TOKEN`；若在设备上配置「在 Aegis 中打开」，可改为使用 `aegis://approve?token=TOKEN`（需后端或前端在推送/邮件中提供该链接）。

## 后端对接

- **GET /api/app/approval?token=xxx** — 拉取审批详情
- **POST /api/app/approval/decision** — 提交批准/拒绝（body: `token`, `decision`, `decision_source: app_biometric`）

详见仓库根目录 [Aegis-API-Spec.md](../Aegis-API-Spec.md) §9。

## 本地运行

1. 安装依赖：`cd app && npm install`
2. 启动后端：在仓库根目录 `npm run dev`（默认 http://localhost:3000）
3. 启动 App：`npm start`，按提示用 iOS 模拟器或 Android 模拟器打开；真机需与电脑同网并设置 `EXPO_PUBLIC_API_URL=http://你的电脑IP:3000`
4. 测试审批：用 curl 创建请求后，从 `/dev/emails` 获取审批链接，将 URL 中的 token 拼成 `aegis://approve?token=TOKEN`，在模拟器中用 Safari 打开该链接即可跳转 App 审批页。

## 资源

- 图标与启动图：在 `assets/` 下放置 `icon.png`、`splash-icon.png`、`adaptive-icon.png`（可选），或修改 `app.json` 去掉对应字段。
