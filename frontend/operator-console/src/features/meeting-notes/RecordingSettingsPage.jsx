import { ArrowLeft, HardDrive, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { Button } from "../../components/primitives/Button.jsx";
import { recordingProgramSettings } from "./meeting-notes-data.js";
import { MeetingIonField } from "./MeetingVisualChrome.jsx";
import styles from "./MeetingNotesPage.module.css";

export function RecordingSettingsPage() {
  const [settings, setSettings] = useState(recordingProgramSettings);
  const [savedMessage, setSavedMessage] = useState("");

  /**
   * @param {keyof typeof recordingProgramSettings} key
   * @param {string} value
   */
  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSavedMessage("");
  };

  return (
    <WorkspacePageFrame className={styles.meetingCanvas}>
      <MeetingIonField />
      <WorkspaceStatusBar title="会议录制纪要" />

      <main className={styles.singleColumnLayout}>
        <section className={styles.heroBand} aria-label="本机录制程序配置概览">
          <div>
            <Link className={styles.backLink} to="/meeting-notes">
              <ArrowLeft aria-hidden="true" size={16} />
              返回纪要库
            </Link>
            <span className={styles.kicker}>客户端录制配置</span>
            <h2>本机录制程序配置</h2>
            <p>
              每位操作员在自己的客户端 PC 上维护 Python 解释器、录制脚本和输出目录。当前页面只保存前端原型状态。
            </p>
          </div>
          <div className={styles.heroActions}>
            <span className={styles.statePill}>
              <HardDrive aria-hidden="true" size={16} />
              当前操作员 PC 独立配置
            </span>
          </div>
        </section>

        <section className={styles.detailPanel} aria-label="录制程序路径">
          <div className={styles.sectionHead}>
            <div>
              <h3>录制程序路径</h3>
              <span>真实接入时需要由本机受控桥接程序校验路径、签名和权限。</span>
            </div>
          </div>

          <form
            className={styles.settingsForm}
            onSubmit={(event) => {
              event.preventDefault();
              setSavedMessage("配置已保存到当前浏览器原型状态");
            }}
          >
            <label>
              <span>当前操作员</span>
              <input
                onChange={(event) => updateSetting("operator", event.target.value)}
                value={settings.operator}
              />
            </label>
            <label>
              <span>当前客户端 PC</span>
              <input
                onChange={(event) => updateSetting("clientDevice", event.target.value)}
                value={settings.clientDevice}
              />
            </label>
            <label>
              <span>Python 解释器路径</span>
              <input
                onChange={(event) => updateSetting("pythonPath", event.target.value)}
                value={settings.pythonPath}
              />
            </label>
            <label>
              <span>会议录制脚本路径</span>
              <input
                onChange={(event) => updateSetting("scriptPath", event.target.value)}
                value={settings.scriptPath}
              />
            </label>
            <label>
              <span>工作目录</span>
              <input
                onChange={(event) => updateSetting("workingDirectory", event.target.value)}
                value={settings.workingDirectory}
              />
            </label>
            <label>
              <span>默认输出目录</span>
              <input
                onChange={(event) => updateSetting("outputDirectory", event.target.value)}
                value={settings.outputDirectory}
              />
            </label>

            <div className={styles.formActions}>
              <Button type="submit">
                <Save aria-hidden="true" size={16} />
                保存配置
              </Button>
              {savedMessage ? (
                <span className={styles.inlineSuccess}>
                  <ShieldCheck aria-hidden="true" size={16} />
                  {savedMessage}
                </span>
              ) : null}
            </div>
          </form>
        </section>

        <section className={styles.detailPanel} aria-label="安全边界说明">
          <div className={styles.explainGrid}>
            <article>
              <strong>客户端执行</strong>
              <span>真实录制由操作员所在 PC 的受控桥接程序启动，不由浏览器直接执行 Python。</span>
            </article>
            <article>
              <strong>路径 allowlist</strong>
              <span>生产接入时需要限制解释器和脚本目录，避免任意脚本执行。</span>
            </article>
            <article>
              <strong>审计事件</strong>
              <span>启动、停止、导入和发布纪要都应记录操作者、配置版本和输出文件摘要。</span>
            </article>
          </div>
        </section>
      </main>
    </WorkspacePageFrame>
  );
}
