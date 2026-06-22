# M09 RAG Question Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/rag` 从占位入口转换为符合原型的 P1 只读 RAG 问答页面。

**Architecture:** 新增独立 `RagQuestionPage` feature，复用现有 `AppShell`、`WorkspacePageFrame` 和 `WorkspaceStatusBar`。页面仅展示静态只读问答、引用证据、知识源和检索参数，不提交真实 RAG 请求，不伪装后端成功。

**Tech Stack:** React 19、JavaScript/JSX、JSDoc、CSS Modules、Vitest、React Testing Library。

---

### Task 1: 路由测试先行

**Files:**
- Modify: `frontend/operator-console/src/app/router.test.jsx`

- [x] **Step 1: Write the failing test**

在 `/rag` 路由断言中加入 RAG 页面结构、引用证据、知识源和禁止越界能力的断言。

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/router.test.jsx --runInBand`
Expected: FAIL，因为 `/rag` 仍是 `ProtectedPlaceholder`。

### Task 2: RAG 页面实现

**Files:**
- Create: `frontend/operator-console/src/features/rag-question/RagQuestionPage.jsx`
- Create: `frontend/operator-console/src/features/rag-question/RagQuestionPage.module.css`
- Modify: `frontend/operator-console/src/app/router.jsx`

- [x] **Step 1: Implement the minimal page**

页面包含标题状态栏、问答窗口、引用证据、知识源、引用可信度、检索参数，以及禁用的提交按钮。

- [x] **Step 2: Wire route**

将 `/rag` 的占位组件替换为 `RagQuestionPage`。

- [x] **Step 3: Run focused tests**

Run: `npm test -- src/app/router.test.jsx`
Expected: PASS。

### Task 3: Verification

**Files:**
- Verify only.

- [x] **Step 1: Run frontend quality gates**

Run from `frontend/operator-console`:
- `npm run check`
- `npm run lint`
- `npm test -- src/app/router.test.jsx`

Expected: all PASS。
