import { ArrowLeft, FilePenLine, MessageSquareText } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { Badge } from "../../components/primitives/Badge.jsx";
import { findMeetingNoteById } from "./meeting-notes-data.js";
import { MeetingIonField, MeetingPanelIcon } from "./MeetingVisualChrome.jsx";
import styles from "./MeetingNotesPage.module.css";

export function MeetingNoteDetailPage() {
  const { noteId } = useParams();
  const note = findMeetingNoteById(noteId);

  if (!note) {
    return (
      <WorkspacePageFrame className={styles.meetingCanvas}>
        <MeetingIonField />
        <WorkspaceStatusBar title="会议录制纪要" />
        <section className={styles.notFoundPanel}>
          <h2>未找到会议纪要</h2>
          <p>当前链接没有对应的本地模拟纪要。</p>
          <Link className={styles.secondaryLink} to="/meeting-notes">
            <ArrowLeft aria-hidden="true" size={17} />
            返回纪要库
          </Link>
        </section>
      </WorkspacePageFrame>
    );
  }

  return (
    <WorkspacePageFrame className={styles.meetingCanvas}>
      <MeetingIonField />
      <WorkspaceStatusBar title="会议录制纪要" />

      <div className={styles.detailLayout}>
        <main className={styles.detailMain}>
          <section className={styles.heroBand} aria-label="会议详情概览">
            <div>
              <Link className={styles.backLink} to="/meeting-notes">
                <ArrowLeft aria-hidden="true" size={16} />
                返回纪要库
              </Link>
              <h2>{note.title}</h2>
              <p>
                {note.date} · {note.timeRange} · {note.project} · {note.participants.join("、")}
              </p>
            </div>
            <div className={styles.heroActions}>
              <Badge tone={note.status === "已发布" ? "success" : "warning"}>{note.status}</Badge>
              <Link className={styles.primaryLink} to={`/meeting-notes/${note.id}/edit`}>
                <FilePenLine aria-hidden="true" size={17} />
                编辑草稿
              </Link>
            </div>
          </section>

          <section aria-label="会议摘要与行动项" className={styles.detailPanel}>
            <div className={styles.sectionHead}>
              <div>
                <h3>会议摘要与行动项</h3>
                <span>{note.version} · {note.source}</span>
              </div>
            </div>
            <p className={styles.summaryText}>{note.summary}</p>
            <div className={styles.detailGrid}>
              <section>
                <h4>关键决策</h4>
                <ul className={styles.compactList}>
                  {note.decisions.map((decision) => (
                    <li key={decision.id}>{decision.text}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4>行动项</h4>
                <div className={styles.actionList}>
                  {note.actionItems.map((item) => (
                    <article key={item.id}>
                      <strong>{item.title}</strong>
                      <span>
                        {item.owner} · {item.dueDate} · {item.status}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>

          <section aria-label="全文转写时间线" className={styles.detailPanel}>
            <div className={styles.sectionHead}>
              <div>
                <h3>全文转写时间线</h3>
                <span>按发言人和时间定位引用片段</span>
              </div>
            </div>
            <div className={styles.transcriptList}>
              {note.transcript.map((segment) => (
                <article id={segment.id} key={segment.id}>
                  <time>{segment.time}</time>
                  <strong>{segment.speaker}</strong>
                  <p>{segment.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-label="版本记录" className={styles.detailPanel}>
            <div className={styles.sectionHead}>
              <div>
                <h3>版本记录</h3>
                <span>原型展示发布人、发布时间和变更摘要</span>
              </div>
            </div>
            <div className={styles.versionList}>
              {note.versions.map((version) => (
                <article key={`${note.id}-${version.version}`}>
                  <strong>{version.version}</strong>
                  <span>
                    {version.publishedBy} · {version.publishedAt}
                  </span>
                  <p>{version.summary}</p>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className={styles.sideColumn}>
          <section aria-label="当前会议问答" className={styles.sidePanel}>
            <h3>
              <MeetingPanelIcon tone="session">
                <MessageSquareText size={15} strokeWidth={2.6} />
              </MeetingPanelIcon>
              当前会议问答
            </h3>
            <p className={styles.ragAnswer}>问：这场会议确认了哪些后续动作？</p>
            <div className={styles.citationList}>
              {note.citations.map((citation) => (
                <a href={`#${citation.segmentId}`} key={citation.id}>
                  <strong>{citation.noteTitle}</strong>
                  <span>{citation.snippet}</span>
                </a>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </WorkspacePageFrame>
  );
}
