import { ArrowLeft, AudioLines, CheckCircle2, FileAudio, Play } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { Button } from "../../components/primitives/Button.jsx";
import { recordingProgramSettings } from "./meeting-notes-data.js";
import { MeetingIonField, MeetingPanelIcon } from "./MeetingVisualChrome.jsx";
import styles from "./MeetingNotesPage.module.css";

const wizardSteps = ["配置检查", "音频来源", "会议信息", "总结模板"];

export function RecordingWizardPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [recordingState, setRecordingState] = useState("idle");

  const currentStepTitle = getStepTitle(stepIndex);

  return (
    <WorkspacePageFrame className={styles.meetingCanvas}>
      <MeetingIonField />
      <WorkspaceStatusBar title="会议录制纪要" />

      <main className={styles.singleColumnLayout}>
        <section className={styles.heroBand} aria-label="会议录制向导概览">
          <div>
            <Link className={styles.backLink} to="/meeting-notes">
              <ArrowLeft aria-hidden="true" size={16} />
              返回纪要库
            </Link>
            <span className={styles.kicker}>录制向导</span>
            <h2>开始录制会议</h2>
            <p>
              先确认本机录制程序配置，再选择音频来源、填写会议信息和总结模板。当前原型不会请求麦克风权限。
            </p>
          </div>
          <div className={styles.heroActions}>
            <span className={styles.statePill}>
              <AudioLines aria-hidden="true" size={16} />
              模拟录制流程
            </span>
          </div>
        </section>

        <section className={styles.wizardShell} aria-label="录制步骤">
          <ol className={styles.stepper}>
            {wizardSteps.map((step, index) => (
              <li
                className={index === stepIndex ? styles.activeStep : ""}
                key={step}
              >
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          <div className={styles.wizardPanel}>
            <h3>{currentStepTitle}</h3>
            {stepIndex === 0 ? <ConfigurationStep /> : null}
            {stepIndex === 1 ? <AudioSourceStep /> : null}
            {stepIndex === 2 ? <MeetingInfoStep /> : null}
            {stepIndex === 3 ? <TemplateStep /> : null}

            {recordingState === "recording" ? (
              <div className={styles.recordingState}>
                <strong>模拟录制中</strong>
                <span>不会启动本机 Python，也不会请求麦克风权限。</span>
              </div>
            ) : null}

            <div className={styles.formActions}>
              {stepIndex < wizardSteps.length - 1 ? (
                <Button onClick={() => setStepIndex((current) => current + 1)}>
                  下一步
                </Button>
              ) : (
                <Button onClick={() => setRecordingState("recording")}>
                  <Play aria-hidden="true" size={16} />
                  开始模拟录制
                </Button>
              )}
              {stepIndex > 0 ? (
                <Button onClick={() => setStepIndex((current) => current - 1)} variant="secondary">
                  上一步
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </WorkspacePageFrame>
  );
}

/**
 * @param {number} stepIndex
 */
function getStepTitle(stepIndex) {
  if (stepIndex === 1) {
    return "选择音频来源";
  }
  if (stepIndex === 2) {
    return "填写会议信息";
  }
  if (stepIndex === 3) {
    return "选择总结模板";
  }
  return "确认录制配置";
}

function ConfigurationStep() {
  return (
    <div className={styles.explainGrid}>
      <article>
        <MeetingPanelIcon tone="session">
          <CheckCircle2 size={15} strokeWidth={2.6} />
        </MeetingPanelIcon>
        <strong>{recordingProgramSettings.status}</strong>
        <span>{recordingProgramSettings.pythonPath}</span>
      </article>
      <article>
        <MeetingPanelIcon tone="skill">
          <FileAudio size={15} strokeWidth={2.6} />
        </MeetingPanelIcon>
        <strong>输出目录</strong>
        <span>{recordingProgramSettings.outputDirectory}</span>
      </article>
    </div>
  );
}

function AudioSourceStep() {
  return (
    <div className={styles.choiceGrid}>
      <label>
        <input defaultChecked name="audioSource" type="radio" />
        <span>
          <strong>系统音频</strong>
          <small>由本机桥接程序读取会议声音。</small>
        </span>
      </label>
      <label>
        <input name="audioSource" type="radio" />
        <span>
          <strong>导入录音文件</strong>
          <small>从本机输出目录导入已有录音。</small>
        </span>
      </label>
    </div>
  );
}

function MeetingInfoStep() {
  return (
    <div className={styles.settingsForm}>
      <label>
        <span>会议标题</span>
        <input defaultValue="新会议纪要" />
      </label>
      <label>
        <span>关联项目</span>
        <input defaultValue="平台运维" />
      </label>
      <label>
        <span>参会人</span>
        <input defaultValue="ops.reader" />
      </label>
      <label>
        <span>标签</span>
        <input defaultValue="待校订" />
      </label>
    </div>
  );
}

function TemplateStep() {
  return (
    <div className={styles.choiceGrid}>
      <label>
        <input defaultChecked name="summaryTemplate" type="radio" />
        <span>
          <strong>运维复盘模板</strong>
          <small>摘要、时间线、根因、行动项和引用片段。</small>
        </span>
      </label>
      <label>
        <input name="summaryTemplate" type="radio" />
        <span>
          <strong>需求评审模板</strong>
          <small>结论、风险、负责人和下一步。</small>
        </span>
      </label>
    </div>
  );
}
