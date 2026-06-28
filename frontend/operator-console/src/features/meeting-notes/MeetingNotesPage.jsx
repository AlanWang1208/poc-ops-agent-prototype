import {
  AudioLines,
  BookOpenCheck,
  CalendarRange,
  ClipboardList,
  FilePenLine,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { Badge } from "../../components/primitives/Badge.jsx";
import { Button } from "../../components/primitives/Button.jsx";
import {
  filterMeetingNotes,
  meetingNotes,
  recordingProgramSettings,
} from "./meeting-notes-data.js";
import { MeetingIonField, MeetingPanelIcon } from "./MeetingVisualChrome.jsx";
import styles from "./MeetingNotesPage.module.css";

const initialFilters = {
  keyword: "",
  participant: "",
  startDate: "",
  endDate: "",
  project: "",
  tag: "",
};

const globalRagCitations = meetingNotes.flatMap((note) => note.citations).slice(0, 3);

export function MeetingNotesPage() {
  const [filters, setFilters] = useState(initialFilters);
  const filteredNotes = useMemo(() => filterMeetingNotes(filters), [filters]);
  const projectOptions = useMemo(
    () => Array.from(new Set(meetingNotes.map((note) => note.project))),
    [],
  );
  const tagOptions = useMemo(
    () => Array.from(new Set(meetingNotes.flatMap((note) => note.tags))),
    [],
  );

  /**
   * @param {keyof typeof initialFilters} key
   * @param {string} value
   */
  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <WorkspacePageFrame className={styles.meetingCanvas}>
      <MeetingIonField />
      <WorkspaceStatusBar title="会议录制纪要" />

      <div className={styles.pageLayout}>
        <main className={styles.libraryColumn}>
          <section className={styles.heroBand} aria-label="会议纪要库概览">
            <div>
              <span className={styles.kicker}>会议知识资产</span>
              <h2>会议纪要库</h2>
              <p>
                维护录制后的总结、全文转写、行动项和版本。当前是前端原型，只使用本地模拟数据。
              </p>
            </div>
            <div className={styles.heroActions}>
              <Link className={styles.primaryLink} to="/meeting-notes/record/new">
                <AudioLines aria-hidden="true" size={18} />
                开始录制
              </Link>
              <Link className={styles.secondaryLink} to="/meeting-notes/recording-settings">
                <Settings aria-hidden="true" size={17} />
                配置本机录制程序
              </Link>
            </div>
          </section>

          <MeetingFilters
            filters={filters}
            onClear={() => setFilters(initialFilters)}
            onUpdate={updateFilter}
            projectOptions={projectOptions}
            tagOptions={tagOptions}
          />

          <section aria-label="会议纪要库" className={styles.noteLibrary}>
            <div className={styles.sectionHead}>
              <div>
                <h3>会议纪要库</h3>
                <span>{filteredNotes.length} 条纪要</span>
              </div>
              <Badge tone={filteredNotes.length > 0 ? "success" : "warning"}>
                {filteredNotes.length > 0 ? "本地模拟数据" : "无匹配结果"}
              </Badge>
            </div>

            {filteredNotes.length > 0 ? (
              <div className={styles.noteList}>
                {filteredNotes.map((note) => (
                  <MeetingNoteCard key={note.id} note={note} />
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Search aria-hidden="true" size={22} />
                <strong>没有匹配的会议纪要</strong>
                <span>清除筛选条件后可以回到完整纪要库。</span>
                <Button onClick={() => setFilters(initialFilters)} variant="secondary">
                  清除筛选
                </Button>
              </div>
            )}
          </section>
        </main>

        <aside aria-label="会议纪要辅助区" className={styles.sideColumn}>
          <RecordingSettingsPanel />
          <GlobalMeetingRagPanel />
          <PendingReviewPanel />
        </aside>
      </div>
    </WorkspacePageFrame>
  );
}

/**
 * @param {{
 *   filters: typeof initialFilters,
 *   onClear: () => void,
 *   onUpdate: (key: keyof typeof initialFilters, value: string) => void,
 *   projectOptions: string[],
 *   tagOptions: string[],
 * }} props
 */
function MeetingFilters({ filters, onClear, onUpdate, projectOptions, tagOptions }) {
  return (
    <form
      aria-label="会议纪要筛选"
      className={styles.filterBar}
      onSubmit={(event) => event.preventDefault()}
      role="search"
    >
      <label>
        <span>关键词</span>
        <input
          aria-label="关键词"
          onChange={(event) => onUpdate("keyword", event.target.value)}
          placeholder="标题、摘要、转写内容"
          type="text"
          value={filters.keyword}
        />
      </label>
      <label>
        <span>参会人</span>
        <input
          aria-label="参会人"
          onChange={(event) => onUpdate("participant", event.target.value)}
          placeholder="例如：李雷"
          type="text"
          value={filters.participant}
        />
      </label>
      <label>
        <span>开始日期</span>
        <input
          aria-label="开始日期"
          onChange={(event) => onUpdate("startDate", event.target.value)}
          type="date"
          value={filters.startDate}
        />
      </label>
      <label>
        <span>结束日期</span>
        <input
          aria-label="结束日期"
          onChange={(event) => onUpdate("endDate", event.target.value)}
          type="date"
          value={filters.endDate}
        />
      </label>
      <label>
        <span>项目</span>
        <select
          aria-label="项目"
          onChange={(event) => onUpdate("project", event.target.value)}
          value={filters.project}
        >
          <option value="">全部项目</option>
          {projectOptions.map((project) => (
            <option key={project} value={project}>
              {project}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>标签</span>
        <select
          aria-label="标签"
          onChange={(event) => onUpdate("tag", event.target.value)}
          value={filters.tag}
        >
          <option value="">全部标签</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </label>
      <Button className={styles.clearButton} onClick={onClear} variant="secondary">
        清除
      </Button>
    </form>
  );
}

/**
 * @param {{ note: import("./meeting-notes-data.js").MeetingNote }} props
 */
function MeetingNoteCard({ note }) {
  return (
    <article className={styles.noteCard}>
      <div className={styles.noteCardHead}>
        <div>
          <Link className={styles.noteTitle} to={`/meeting-notes/${note.id}`}>
            {note.title}
          </Link>
          <span className={styles.noteMeta}>
            <CalendarRange aria-hidden="true" size={14} />
            {note.date} · {note.timeRange}
          </span>
        </div>
        <Badge tone={note.status === "已发布" ? "success" : "warning"}>{note.status}</Badge>
      </div>
      <p>{note.summary}</p>
      <div className={styles.noteTags}>
        <span>{note.project}</span>
        {note.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className={styles.noteFooter}>
        <span>{note.participants.join("、")}</span>
        <strong>{note.actionItems.length} 个行动项</strong>
      </div>
    </article>
  );
}

function RecordingSettingsPanel() {
  return (
    <section className={styles.sidePanel}>
      <h3>
        <MeetingPanelIcon tone="skill">
          <Settings size={15} strokeWidth={2.6} />
        </MeetingPanelIcon>
        本机录制程序
      </h3>
      <div className={styles.settingState}>
        <strong>当前操作员 PC 独立配置</strong>
        <span>{recordingProgramSettings.operator}</span>
        <span>{recordingProgramSettings.status}</span>
      </div>
      <Link className={styles.sideLink} to="/meeting-notes/recording-settings">
        查看本机配置
      </Link>
    </section>
  );
}

function GlobalMeetingRagPanel() {
  return (
    <section className={styles.sidePanel}>
      <h3>
        <MeetingPanelIcon tone="session">
          <Sparkles size={15} strokeWidth={2.6} />
        </MeetingPanelIcon>
        全局会议问答
      </h3>
      <div className={styles.ragQuestion}>
        <MeetingPanelIcon tone="skill">
          <BookOpenCheck size={15} strokeWidth={2.6} />
        </MeetingPanelIcon>
        <span>问：支付问题和发布检查之间有什么关联？</span>
      </div>
      <p className={styles.ragAnswer}>
        当前模拟回答只引用已有纪要片段，不生成无来源结论。
      </p>
      <div className={styles.citationList}>
        {globalRagCitations.map((citation) => (
          <a href={`/meeting-notes/${citation.noteId}#${citation.segmentId}`} key={citation.id}>
            <strong>{citation.noteTitle}</strong>
            <span>{citation.snippet}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function PendingReviewPanel() {
  const pendingNotes = meetingNotes.filter((note) => note.status !== "已发布");

  return (
    <section className={styles.sidePanel}>
      <h3>
        <MeetingPanelIcon tone="task">
          <ClipboardList size={15} strokeWidth={2.6} />
        </MeetingPanelIcon>
        待维护纪要
      </h3>
      <div className={styles.pendingList}>
        {pendingNotes.map((note) => (
          <Link key={note.id} to={`/meeting-notes/${note.id}`}>
            <FilePenLine aria-hidden="true" size={15} />
            <span>{note.title}</span>
            <strong>{note.status}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}
