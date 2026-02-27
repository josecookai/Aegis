# GitHub Automation Playbook

Last updated: 2026-02-27

## 覆盖流程

1. Issue dispatch 自动化
2. 自动创建/更新 Pull Request
3. PR 自动合并

对应 workflow：

- `.github/workflows/issue-dispatch.yml`
- `.github/workflows/auto-pr.yml`
- `.github/workflows/auto-merge.yml`

## 1) Issue Dispatch

触发方式（三选一）：

- 新建 issue（自动触发）
- 给 issue 加标签 `dispatch`
- 在 issue 评论里输入 `/dispatch`

效果：

- 自动创建分支：`codex/issue-<number>-<slug>`
- 自动给 issue 添加 `dispatched` 标签
- 自动评论告知分支名和下一步动作

## 2) Auto PR

触发方式：

- 给 issue 添加标签 `auto-pr`
- 或手动运行 workflow `Auto PR From Issue`（输入 issue_number）

效果：

- 在 dispatch 分支写入 `.github/issue-dispatch/issue-<n>.md`
- 自动创建或更新 Draft PR（base=default branch）
- PR 标题：`feat(issue #<n>): <issue title>`

## 3) Auto Merge

触发条件：

- PR 非 Draft
- PR 有标签 `automerge`

效果：

- 自动执行 `gh pr merge --auto --squash --delete-branch`
- 必需检查通过后自动合并
- 合并后删除分支

## 4) 需要的仓库设置

### 4.1 Actions 权限

在 repo settings 中确认：

- `GITHUB_TOKEN` 允许 `Read and write permissions`
- 允许 workflows 创建/更新 PR

### 4.2 Branch protection（建议）

- 对默认分支启用 required checks（至少 CI）
- 启用 “Allow auto-merge”
- 限制直接 push 到主分支

### 4.3 标签约定

- `dispatch`：issue 派发
- `auto-pr`：触发自动 PR
- `automerge`：允许自动合并

## 5) 推荐日常用法

1. 创建 issue
2. 评论 `/dispatch`（可选，确保有分支）
3. 给 issue 加 `auto-pr`
4. 在生成的 PR 分支上推送实现
5. PR 准备好后移除 Draft，并加 `automerge`

## 6) 常见问题

- PR 没生成：确认 issue 已 dispatch 且分支存在
- auto-merge 不执行：确认 PR 不是 Draft，且有 `automerge` 标签
- 无法自动合并：确认仓库启用了 “Allow auto-merge” 且 required checks 已通过
