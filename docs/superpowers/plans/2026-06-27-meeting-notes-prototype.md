# 会议录制纪要前端原型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/meeting-notes` 从占位页升级为会议纪要库前端原型，并补齐详情页、客户端录制程序配置、录制向导和草稿校订页面。

**Architecture:** 仅修改 `frontend/operator-console` 的 React 原型层，使用本地模拟数据和组件状态，不新增后端 API。路由继续由 `ProtectedRoute` 包裹，页面使用现有 `WorkspacePageFrame`、`WorkspaceStatusBar`、`Button`、`Badge` 和 CSS Module 风格。

**Tech Stack:** JavaScript/JSX、React、React Router、JSDoc、CSS Modules、Vitest、Testing Library。

---

## File Structure

- Create: `frontend/operator-console/src/features/meeting-notes/meeting-notes-data.js`
  - 负责本地模拟会议纪要数据、搜索筛选和按 ID 查询。
- Create: `frontend/operator-console/src/features/meeting-notes/MeetingNotesPage.jsx`
  - 负责纪要库首页、筛选表单、纪要列表、全局会议问答和录制配置状态入口。
- Create: `frontend/operator-console/src/features/meeting-notes/MeetingNoteDetailPage.jsx`
  - 负责纪要详情页、摘要、决策、行动项、全文转写、单场会议问答和版本记录。
- Create: `frontend/operator-console/src/features/meeting-notes/RecordingSettingsPage.jsx`
  - 负责当前操作员和当前客户端 PC 的 Python 录制程序配置原型。
- Create: `frontend/operator-console/src/features/meeting-notes/RecordingWizardPage.jsx`
  - 负责包含配置检查、音频来源、会议元信息和总结模板选择的四步录制向导原型。
- Create: `frontend/operator-console/src/features/meeting-notes/MeetingDraftEditorPage.jsx`
  - 负责草稿校订、保存草稿和模拟发布新版本。
- Create: `frontend/operator-console/src/features/meeting-notes/MeetingNotesPage.module.css`
  - 负责会议纪要相关页面的共享布局和组件样式。
- Create: `frontend/operator-console/src/features/meeting-notes/MeetingNotesPage.test.jsx`
  - 覆盖筛选、首页、详情、配置、向导、草稿发布状态。
- Modify: `frontend/operator-console/src/app/router.jsx`
  - 将 `/meeting-notes` 占位页替换为真实原型页面，并新增详情、配置、录制向导和校订路由。
- Modify: `frontend/operator-console/src/app/router.test.jsx`
  - 更新会议录制纪要路由断言，确认页面不再展示占位文案。

## Task 1: Meeting Data And Filtering

**Files:**
- Create: `frontend/operator-console/src/features/meeting-notes/meeting-notes-data.js`
- Create: `frontend/operator-console/src/features/meeting-notes/MeetingNotesPage.test.jsx`

- [x] **Step 1: Write the failing data tests**

Add tests that import `meetingNotes`, `filterMeetingNotes`, and `findMeetingNoteById`:

```jsx
import { describe, expect, it } from "vitest";

import {
  filterMeetingNotes,
  findMeetingNoteById,
  meetingNotes,
} from "./meeting-notes-data.js";

describe("meeting notes local data", () => {
  it("filters meeting notes by keyword, participant, date range, project, and tag", () => {
    const results = filterMeetingNotes({
      keyword: "支付",
      participant: "李雷",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      project: "支付平台",
      tag: "故障复盘",
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("meeting-payment-review");
  });

  it("returns no notes when filters do not match", () => {
    expect(filterMeetingNotes({ keyword: "不存在的纪要" })).toEqual([]);
  });

  it("finds a meeting note by id", () => {
    expect(findMeetingNoteById("meeting-release-review")?.title).toBe("6 月发布评审会");
    expect(findMeetingNoteById("missing")).toBeNull();
    expect(meetingNotes.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [x] **Step 2: Run the data tests to verify they fail**

Run:

```bash
cd frontend/operator-console
npx vitest run src/features/meeting-notes/MeetingNotesPage.test.jsx
```

Expected: FAIL because `meeting-notes-data.js` does not exist.

- [x] **Step 3: Implement local data and filtering**

Create `meeting-notes-data.js` with exported sample notes, a date-safe filter, and lookup by ID. Include at least `meeting-payment-review`, `meeting-release-review`, and one non-matching note.

- [x] **Step 4: Run the data tests to verify they pass**

Run:

```bash
cd frontend/operator-console
npx vitest run src/features/meeting-notes/MeetingNotesPage.test.jsx
```

Expected: PASS for the three data tests.

## Task 2: Meeting Notes Home Page

**Files:**
- Modify: `frontend/operator-console/src/features/meeting-notes/MeetingNotesPage.test.jsx`
- Create: `frontend/operator-console/src/features/meeting-notes/MeetingNotesPage.jsx`
- Create: `frontend/operator-console/src/features/meeting-notes/MeetingNotesPage.module.css`
- Modify: `frontend/operator-console/src/app/router.jsx`
- Modify: `frontend/operator-console/src/app/router.test.jsx`

- [x] **Step 1: Write the failing homepage tests**

Add component tests that render `<MeetingNotesPage />` inside `MemoryRouter` and verify:

```jsx
expect(screen.getByRole("heading", { name: "会议录制纪要" })).toBeInTheDocument();
expect(screen.getByRole("search", { name: "会议纪要筛选" })).toBeInTheDocument();
expect(screen.getByRole("region", { name: "会议纪要库" })).toBeInTheDocument();
expect(screen.getByRole("complementary", { name: "会议纪要辅助区" })).toBeInTheDocument();
expect(screen.getByRole("link", { name: "开始录制" })).toHaveAttribute("href", "/meeting-notes/record/new");
expect(screen.getByRole("link", { name: "配置本机录制程序" })).toHaveAttribute("href", "/meeting-notes/recording-settings");
expect(screen.getByText("当前操作员 PC 独立配置")).toBeInTheDocument();
expect(screen.getByRole("textbox", { name: "关键词" })).toBeInTheDocument();
```

Add an interaction test that types filters and verifies the payment review remains while unrelated notes disappear.

- [x] **Step 2: Run the homepage tests to verify they fail**

Run:

```bash
cd frontend/operator-console
npx vitest run src/features/meeting-notes/MeetingNotesPage.test.jsx
```

Expected: FAIL because `MeetingNotesPage.jsx` does not exist or does not render the expected UI.

- [x] **Step 3: Implement the homepage**

Create `MeetingNotesPage.jsx` with controlled filter state, list rendering, empty state, global RAG prototype, recording settings status panel, and links to detail/config/recording routes.

- [x] **Step 4: Wire the homepage route**

Modify `router.jsx` to import `MeetingNotesPage` and replace the `/meeting-notes` `ProtectedPlaceholder` with `<MeetingNotesPage />`.

- [x] **Step 5: Update route tests**

In `router.test.jsx`, keep `/meeting-notes` in the shared page list and add assertions that the page no longer contains the placeholder copy and does contain `会议纪要库`.

- [x] **Step 6: Run homepage tests**

Run:

```bash
cd frontend/operator-console
npx vitest run src/features/meeting-notes/MeetingNotesPage.test.jsx src/app/router.test.jsx
```

Expected: PASS for meeting-notes homepage and updated router assertions.

## Task 3: Detail, RAG, Recording Settings, Wizard, And Draft Pages

**Files:**
- Modify: `frontend/operator-console/src/features/meeting-notes/MeetingNotesPage.test.jsx`
- Create: `frontend/operator-console/src/features/meeting-notes/MeetingNoteDetailPage.jsx`
- Create: `frontend/operator-console/src/features/meeting-notes/RecordingSettingsPage.jsx`
- Create: `frontend/operator-console/src/features/meeting-notes/RecordingWizardPage.jsx`
- Create: `frontend/operator-console/src/features/meeting-notes/MeetingDraftEditorPage.jsx`
- Modify: `frontend/operator-console/src/app/router.jsx`

- [x] **Step 1: Write failing page tests**

Add tests for:

```jsx
expect(screen.getByRole("heading", { name: "支付链路故障复盘会" })).toBeInTheDocument();
expect(screen.getByRole("region", { name: "会议摘要与行动项" })).toBeInTheDocument();
expect(screen.getByRole("region", { name: "当前会议问答" })).toBeInTheDocument();
expect(screen.getByRole("region", { name: "全文转写时间线" })).toBeInTheDocument();
expect(screen.getByRole("link", { name: "编辑草稿" })).toHaveAttribute("href", "/meeting-notes/meeting-payment-review/edit");
```

Add tests that `RecordingSettingsPage` renders current operator, current PC, Python path, script path, working directory, output directory, and lets the user save local simulated settings.

Add tests that `RecordingWizardPage` renders four steps: 配置检查、音频来源、会议信息、总结模板.

Add tests that `MeetingDraftEditorPage` lets the user save a draft and publish a new simulated version.

- [x] **Step 2: Run the page tests to verify they fail**

Run:

```bash
cd frontend/operator-console
npx vitest run src/features/meeting-notes/MeetingNotesPage.test.jsx
```

Expected: FAIL because the new pages do not exist.

- [x] **Step 3: Implement detail and workflow pages**

Implement each page with local state only. Unknown note IDs should render a safe not-found message and a link back to `/meeting-notes`.

- [x] **Step 4: Wire detail and workflow routes**

Add protected routes:

```jsx
<Route path="/meeting-notes/:noteId" ... />
<Route path="/meeting-notes/:noteId/edit" ... />
<Route path="/meeting-notes/record/new" ... />
<Route path="/meeting-notes/recording-settings" ... />
```

Specific static routes must appear before `:noteId` routes.

- [x] **Step 5: Run page tests**

Run:

```bash
cd frontend/operator-console
npx vitest run src/features/meeting-notes/MeetingNotesPage.test.jsx src/app/router.test.jsx
```

Expected: PASS.

## Task 4: Verification And Browser Check

**Files:**
- Verify only unless a test exposes an issue.

- [x] **Step 1: Run focused tests**

Run:

```bash
cd frontend/operator-console
npx vitest run src/features/meeting-notes/MeetingNotesPage.test.jsx src/app/router.test.jsx
```

Expected: PASS.

- [x] **Step 2: Run static checks for touched frontend code**

Run:

```bash
cd frontend/operator-console
npm run check
npm run lint
```

Expected: PASS.

- [x] **Step 3: Inspect the live page in the browser**

Open or reload `http://127.0.0.1:5173/meeting-notes`. Confirm the page shows 纪要库, filters, global RAG, recording settings status, and recording entry without placeholder text.

- [x] **Step 4: Check git scope**

Run:

```bash
git status --short
```

Expected: meeting-notes files and route files changed, with pre-existing SQL worktree changes left untouched.
