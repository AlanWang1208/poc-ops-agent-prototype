import { ArrowLeft, FilePenLine, Send, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { Button } from "../../components/primitives/Button.jsx";
import { findMeetingNoteById } from "./meeting-notes-data.js";
import { MeetingIonField } from "./MeetingVisualChrome.jsx";
import styles from "./MeetingNotesPage.module.css";

export function MeetingDraftEditorPage() {
  const { noteId } = useParams();
  const note = findMeetingNoteById(noteId);
  const [draftSaved, setDraftSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [changeSummary, setChangeSummary] = useState("补充人工校订说明");
  const [summaryDraft, setSummaryDraft] = useState(note?.summary ?? "");
  const nextVersion = useMemo(() => getNextVersion(note?.version), [note?.version]);

  if (!note) {
    return (
      <WorkspacePageFrame className={styles.meetingCanvas}>
        <MeetingIonField />
        <WorkspaceStatusBar title="会议录制纪要" />
        <section className={styles.notFoundPanel}>
          <h2>未找到会议纪要</h2>
          <p>当前草稿链接没有对应的本地模拟纪要。</p>
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

      <main className={styles.singleColumnLayout}>
        <section className={styles.heroBand} aria-label="纪要草稿编辑概览">
          <div>
            <Link className={styles.backLink} to={`/meeting-notes/${note.id}`}>
              <ArrowLeft aria-hidden="true" size={16} />
              返回会议详情
            </Link>
            <span className={styles.kicker}>{note.title}</span>
            <h2>编辑会议纪要草稿</h2>
            <p>维护 AI 总结草稿、变更摘要和新版本发布记录。当前只模拟保存与发布。</p>
          </div>
          <div className={styles.heroActions}>
            <span className={styles.statePill}>
              <FilePenLine aria-hidden="true" size={16} />
              {note.status}
            </span>
          </div>
        </section>

        <section className={styles.detailPanel} aria-label="草稿编辑区">
          <form className={styles.editorForm} onSubmit={(event) => event.preventDefault()}>
            <label>
              <span>AI 摘要草稿</span>
              <textarea
                onChange={(event) => {
                  setSummaryDraft(event.target.value);
                  setDraftSaved(false);
                  setPublished(false);
                }}
                rows={6}
                value={summaryDraft}
              />
            </label>
            <label>
              <span>变更摘要</span>
              <textarea
                onChange={(event) => {
                  setChangeSummary(event.target.value);
                  setDraftSaved(false);
                  setPublished(false);
                }}
                rows={3}
                value={changeSummary}
              />
            </label>

            <div className={styles.formActions}>
              <Button
                onClick={() => {
                  setDraftSaved(true);
                  setPublished(false);
                }}
              >
                <Save aria-hidden="true" size={16} />
                保存草稿
              </Button>
              <Button
                onClick={() => {
                  setDraftSaved(false);
                  setPublished(true);
                }}
                variant="secondary"
              >
                <Send aria-hidden="true" size={16} />
                发布新版本
              </Button>
            </div>
          </form>

          {draftSaved ? <p className={styles.inlineNotice}>草稿已保存，尚未发布</p> : null}
          {published ? (
            <div aria-label="发布结果" className={styles.publishResult} role="status">
              <strong>已模拟发布 {nextVersion}</strong>
              <p>{changeSummary}</p>
            </div>
          ) : null}
        </section>
      </main>
    </WorkspacePageFrame>
  );
}

/**
 * @param {string | undefined} version
 */
function getNextVersion(version) {
  const currentVersion = Number.parseInt((version ?? "v0").replace("v", ""), 10);
  return `v${Number.isFinite(currentVersion) ? currentVersion + 1 : 1}`;
}
