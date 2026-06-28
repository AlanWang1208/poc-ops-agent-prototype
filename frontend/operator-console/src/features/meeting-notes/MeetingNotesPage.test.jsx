import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach } from "vitest";
import { http, HttpResponse } from "msw";

import { MeetingNotesPage } from "./MeetingNotesPage.jsx";
import { MeetingNoteDetailPage } from "./MeetingNoteDetailPage.jsx";
import { MeetingDraftEditorPage } from "./MeetingDraftEditorPage.jsx";
import { RecordingSettingsPage } from "./RecordingSettingsPage.jsx";
import { RecordingWizardPage } from "./RecordingWizardPage.jsx";
import {
  filterMeetingNotes,
  findMeetingNoteById,
  meetingNotes,
} from "./meeting-notes-data.js";
import { server } from "../../test/server.js";

beforeEach(() => {
  server.use(
    http.get("/auth/session", () =>
      HttpResponse.json({
        authenticated: true,
        subject: "operator-1",
        username: "ops.reader",
        roles: ["ROLE_agent-reader"],
        authenticationType: "built-in",
      }),
    ),
    http.post("/logout", () => new HttpResponse(null, { status: 204 })),
  );
});

function renderMeetingNotesPage() {
  return renderWithRouter(<MeetingNotesPage />);
}

/**
 * @param {import("react").ReactNode} children
 * @param {string} [initialPath]
 */
function renderWithRouter(children, initialPath = "/meeting-notes") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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

describe("MeetingNotesPage", () => {
  it("renders the meeting notes library with recording configuration and global RAG entry", () => {
    renderMeetingNotesPage();

    expect(screen.getByRole("heading", { name: "会议录制纪要" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "会议纪要筛选" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "会议纪要库" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "会议纪要辅助区" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "开始录制" })).toHaveAttribute(
      "href",
      "/meeting-notes/record/new",
    );
    expect(screen.getByRole("link", { name: "配置本机录制程序" })).toHaveAttribute(
      "href",
      "/meeting-notes/recording-settings",
    );
    expect(screen.getByText("当前操作员 PC 独立配置")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "关键词" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "参会人" })).toBeInTheDocument();
    expect(screen.getByText("全局会议问答")).toBeInTheDocument();
    const library = screen.getByRole("region", { name: "会议纪要库" });
    expect(within(library).getByText("支付链路故障复盘会")).toBeInTheDocument();
    expect(within(library).getByText("6 月发布评审会")).toBeInTheDocument();
  });

  it("filters meeting notes in the library", async () => {
    const user = userEvent.setup();
    renderMeetingNotesPage();

    await user.type(screen.getByRole("textbox", { name: "关键词" }), "支付");
    await user.type(screen.getByRole("textbox", { name: "参会人" }), "李雷");
    await user.selectOptions(screen.getByLabelText("项目"), "支付平台");
    await user.selectOptions(screen.getByLabelText("标签"), "故障复盘");

    const library = screen.getByRole("region", { name: "会议纪要库" });
    expect(within(library).getByText("支付链路故障复盘会")).toBeInTheDocument();
    expect(within(library).queryByText("6 月发布评审会")).not.toBeInTheDocument();
    expect(within(library).queryByText("运维早会同步")).not.toBeInTheDocument();
  });
});

describe("meeting notes detail and workflow pages", () => {
  it("renders meeting note detail with summary, current meeting RAG, transcript, and edit entry", () => {
    renderWithRouter(
      <Routes>
        <Route element={<MeetingNoteDetailPage />} path="/meeting-notes/:noteId" />
      </Routes>,
      "/meeting-notes/meeting-payment-review",
    );

    expect(screen.getByRole("heading", { name: "支付链路故障复盘会" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "会议摘要与行动项" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前会议问答" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "全文转写时间线" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "版本记录" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "编辑草稿" })).toHaveAttribute(
      "href",
      "/meeting-notes/meeting-payment-review/edit",
    );
    expect(screen.getByText("补充支付回调队列积压告警")).toBeInTheDocument();
    expect(screen.getByText("队列积压从 14:12 开始持续上升。")).toBeInTheDocument();
  });

  it("renders a safe not-found state for an unknown meeting note", () => {
    renderWithRouter(
      <Routes>
        <Route element={<MeetingNoteDetailPage />} path="/meeting-notes/:noteId" />
      </Routes>,
      "/meeting-notes/missing",
    );

    expect(screen.getByRole("heading", { name: "未找到会议纪要" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回纪要库" })).toHaveAttribute("href", "/meeting-notes");
  });

  it("renders client-local Python recording settings and saves simulated settings", async () => {
    const user = userEvent.setup();
    renderWithRouter(<RecordingSettingsPage />, "/meeting-notes/recording-settings");

    expect(screen.getByRole("heading", { name: "本机录制程序配置" })).toBeInTheDocument();
    expect(screen.getByText("当前操作员 PC 独立配置")).toBeInTheDocument();
    expect(screen.getByLabelText("当前操作员")).toHaveValue("ops.reader");
    expect(screen.getByLabelText("当前客户端 PC")).toHaveValue("当前操作员 PC");
    expect(screen.getByLabelText("Python 解释器路径")).toHaveValue("C:\\Python311\\python.exe");
    expect(screen.getByLabelText("会议录制脚本路径")).toHaveValue("D:\\meeting-recorder\\record.py");
    expect(screen.getByLabelText("工作目录")).toHaveValue("D:\\meeting-recorder");
    expect(screen.getByLabelText("默认输出目录")).toHaveValue("D:\\meeting-recorder\\output");

    await user.clear(screen.getByLabelText("默认输出目录"));
    await user.type(screen.getByLabelText("默认输出目录"), "E:\\meeting-output");
    await user.click(screen.getByRole("button", { name: "保存配置" }));

    expect(screen.getByText("配置已保存到当前浏览器原型状态")).toBeInTheDocument();
    expect(screen.getByLabelText("默认输出目录")).toHaveValue("E:\\meeting-output");
  });

  it("renders the four-step recording wizard and advances to simulated recording", async () => {
    const user = userEvent.setup();
    renderWithRouter(<RecordingWizardPage />, "/meeting-notes/record/new");

    expect(screen.getByRole("heading", { name: "开始录制会议" })).toBeInTheDocument();
    expect(screen.getByText("配置检查")).toBeInTheDocument();
    expect(screen.getByText("音频来源")).toBeInTheDocument();
    expect(screen.getByText("会议信息")).toBeInTheDocument();
    expect(screen.getByText("总结模板")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByRole("heading", { name: "选择音频来源" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByRole("heading", { name: "填写会议信息" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByRole("heading", { name: "选择总结模板" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "开始模拟录制" }));

    expect(screen.getByText("模拟录制中")).toBeInTheDocument();
    expect(screen.getByText("不会启动本机 Python，也不会请求麦克风权限。")).toBeInTheDocument();
  });

  it("saves a draft and publishes a simulated new version", async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <Routes>
        <Route element={<MeetingDraftEditorPage />} path="/meeting-notes/:noteId/edit" />
      </Routes>,
      "/meeting-notes/meeting-payment-review/edit",
    );

    expect(screen.getByRole("heading", { name: "编辑会议纪要草稿" })).toBeInTheDocument();
    expect(screen.getByLabelText("AI 摘要草稿")).toHaveDisplayValue(/支付回调延迟/u);

    await user.clear(screen.getByLabelText("变更摘要"));
    await user.type(screen.getByLabelText("变更摘要"), "补充发布检查结论");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));
    expect(screen.getByText("草稿已保存，尚未发布")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "发布新版本" }));
    expect(screen.getByText("已模拟发布 v4")).toBeInTheDocument();
    expect(
      within(screen.getByRole("status", { name: "发布结果" })).getByText("补充发布检查结论"),
    ).toBeInTheDocument();
  });
});
