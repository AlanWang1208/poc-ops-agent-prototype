import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  ExternalLink,
  FileSearch,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";

import { ApiError } from "../../api/client.js";
import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import {
  useConfirmSplunkQuickLinkLaunch,
  useLaunchSplunkQuickLink,
  useSplunkQuickLinkCatalog,
} from "./use-quick-links.js";
import styles from "./QuickLinksPage.module.css";

/** @typedef {import("../../schemas/quick-link-schemas.js").ClaimSearchParameters} ClaimSearchParameters */
/** @typedef {import("../../schemas/quick-link-schemas.js").QuickLinkTemplate} QuickLinkTemplate */
/** @typedef {import("../../schemas/quick-link-schemas.js").QuickLinkConfirmResponse} QuickLinkConfirmResponse */
/** @typedef {import("../../schemas/quick-link-schemas.js").QuickLinkLaunchResponse} QuickLinkLaunchResponse */
/** @typedef {"claimNo" | "policyNo" | "customerId" | "requestId" | "traceId" | "serviceName" | "keyword"} SearchTextField */
/** @typedef {"test" | "production"} ClaimEnvironment */
/** @typedef {"last_15_minutes" | "last_30_minutes" | "last_2_hours" | "last_24_hours"} TimeRange */
/** @typedef {"DEBUG" | "INFO" | "WARN" | "ERROR"} LogLevel */
/** @typedef {SearchTextField | "claimEnvironment" | "timeRange" | "logLevel"} SearchDraftField */
/**
 * @typedef {{
 *   claimNo: string,
 *   policyNo: string,
 *   customerId: string,
 *   requestId: string,
 *   traceId: string,
 *   serviceName: string,
 *   claimEnvironment: ClaimEnvironment,
 *   timeRange: TimeRange,
 *   logLevel: LogLevel,
 *   keyword: string,
 * }} SearchDraft
 */
/**
 * @typedef {{
 *   presetId: string,
 *   templateId: string,
 *   displayName: string,
 *   claimEnvironment: ClaimEnvironment,
 *   claimNo?: string,
 *   policyNo?: string,
 *   customerId?: string,
 *   requestId?: string,
 *   traceId?: string,
 *   serviceName?: string,
 *   timeRange?: TimeRange,
 *   logLevel?: LogLevel,
 *   keyword?: string,
 * }} PersonalPreset
 */
/**
 * @typedef {{
 *   launchId: string,
 *   templateId: string,
 *   templateName: string,
 *   claimEnvironment: ClaimEnvironment,
 *   parameterSummary: string,
 *   launchedAt: string,
 *   auditEventId: string,
 * }} RecentLaunch
 */

/** @type {SearchTextField[]} */
const searchableTextFields = [
  "claimNo",
  "policyNo",
  "customerId",
  "requestId",
  "traceId",
  "serviceName",
  "keyword",
];

/** @type {Record<SearchTextField, string>} */
const fieldLabels = {
  claimNo: "Claim 号",
  policyNo: "保单号",
  customerId: "客户 ID",
  requestId: "requestId",
  traceId: "traceId",
  serviceName: "服务名",
  keyword: "关键字",
};

const timeRangeOptions = [
  { label: "最近 15 分钟", value: "last_15_minutes" },
  { label: "最近 30 分钟", value: "last_30_minutes" },
  { label: "最近 2 小时", value: "last_2_hours" },
  { label: "最近 24 小时", value: "last_24_hours" },
];

/** @type {LogLevel[]} */
const logLevelOptions = ["DEBUG", "INFO", "WARN", "ERROR"];

export function QuickLinksPage() {
  const catalogQuery = useSplunkQuickLinkCatalog();
  const confirmMutation = useConfirmSplunkQuickLinkLaunch();
  const launchMutation = useLaunchSplunkQuickLink();
  const templates = useMemo(
    () => catalogQuery.data?.templates ?? [],
    [catalogQuery.data?.templates],
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [formTemplateId, setFormTemplateId] = useState("");
  const [searchDraft, setSearchDraft] = useState(createEmptyDraft());
  const [confirmation, setConfirmation] = useState(
    /** @type {QuickLinkConfirmResponse | null} */ (null),
  );
  const [launchResult, setLaunchResult] = useState(
    /** @type {QuickLinkLaunchResponse | null} */ (null),
  );

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.templateId === selectedTemplateId) ??
      templates.find((template) => template.favorite) ??
      templates[0] ??
      null,
    [selectedTemplateId, templates],
  );
  const activeSearchDraft = selectedTemplate
    ? getActiveDraft(selectedTemplate, formTemplateId, searchDraft)
    : searchDraft;

  /**
   * @param {QuickLinkTemplate} template
   */
  function selectTemplate(template) {
    setSelectedTemplateId(template.templateId);
    setFormTemplateId(template.templateId);
    setSearchDraft(createTemplateDraft(template));
    setConfirmation(null);
    setLaunchResult(null);
    confirmMutation.reset();
    launchMutation.reset();
  }

  /**
   * @param {PersonalPreset} preset
   */
  function applyPreset(preset) {
    const presetTemplate =
      templates.find((template) => template.templateId === preset.templateId) ??
      selectedTemplate;
    if (!presetTemplate) {
      return;
    }

    setSelectedTemplateId(presetTemplate.templateId);
    setFormTemplateId(presetTemplate.templateId);
    setSearchDraft({
      ...createTemplateDraft(presetTemplate),
      ...pickDraftValues(preset),
      claimEnvironment: presetTemplate.claimEnvironment,
    });
    setConfirmation(null);
    setLaunchResult(null);
    confirmMutation.reset();
    launchMutation.reset();
  }

  /**
   * @param {SearchDraftField} field
   * @param {string} value
   */
  function updateField(field, value) {
    setSearchDraft((current) => ({
      ...(selectedTemplate && formTemplateId !== selectedTemplate.templateId
        ? createTemplateDraft(selectedTemplate)
        : current),
      [field]: value,
    }));
    if (selectedTemplate) {
      setFormTemplateId(selectedTemplate.templateId);
    }
    setConfirmation(null);
    setLaunchResult(null);
    confirmMutation.reset();
    launchMutation.reset();
  }

  /**
   * @param {import("react").FormEvent<HTMLFormElement>} event
   */
  async function submitConfirmation(event) {
    event.preventDefault();
    if (!selectedTemplate) {
      return;
    }

    setConfirmation(null);
    setLaunchResult(null);
    launchMutation.reset();

    try {
      const response = await confirmMutation.mutateAsync({
        contractVersion: "1.0",
        templateId: selectedTemplate.templateId,
        search: buildClaimSearch(selectedTemplate, activeSearchDraft),
      });
      setConfirmation(response);
    } catch {
      setConfirmation(null);
    }
  }

  async function openSplunk() {
    if (!confirmation) {
      return;
    }

    try {
      const response = await launchMutation.mutateAsync({
        contractVersion: "1.0",
        launchRequestId: confirmation.launchRequestId,
        resolvedParameters: confirmation.resolvedParameters,
      });
      setLaunchResult(response);
      window.open(response.targetUrl, "_blank", "noopener,noreferrer");
    } catch {
      setLaunchResult(null);
    }
  }

  return (
    <WorkspacePageFrame className={styles.quickLinksCanvas}>
      <WorkspaceStatusBar title="快捷连接" />

      <main className={styles.workspaceBody}>
        <header className={styles.title}>
          <p className={styles.workspaceTitle}>快捷连接</p>
          <p>Claim 系统 Splunk 日志检索</p>
        </header>

        {catalogQuery.isPending ? (
          <FeedbackState
            message="正在读取控制面返回的 Splunk 快捷模板。"
            state="loading"
            title="快捷模板读取中"
          />
        ) : catalogQuery.isError ? (
          <FeedbackState
            message={formatCatalogError(catalogQuery.error)}
            state="error"
            title="快捷模板读取失败"
          />
        ) : (
          <section className={styles.quickLinkGrid}>
            <section aria-label="Claim 日志模板" className={styles.templatePanel}>
              <PanelHeading detail="服务端维护模板和授权边界" icon={FileSearch} title="Claim 日志模板" />
              <div className={styles.templateList}>
                {templates.map((template) => (
                  <button
                    aria-pressed={selectedTemplate?.templateId === template.templateId}
                    className={`${styles.templateButton} ${
                      selectedTemplate?.templateId === template.templateId ? styles.activeTemplate : ""
                    }`}
                    key={template.templateId}
                    onClick={() => selectTemplate(template)}
                    type="button"
                  >
                    <span>
                      {template.favorite ? <Star aria-hidden="true" size={15} /> : null}
                      <strong>{template.displayName}</strong>
                    </span>
                    <small>{template.description}</small>
                    <em>{formatEnvironment(template.claimEnvironment)}</em>
                  </button>
                ))}
              </div>
            </section>

            <section aria-label="个人常用预设" className={styles.presetPanel}>
              <PanelHeading detail="仅填充页面参数，不读取浏览器密码" icon={Star} title="个人常用预设" />
              <PresetList
                onSelect={applyPreset}
                presets={catalogQuery.data?.personalPresets ?? []}
              />
            </section>

            <section aria-label="最近启动记录" className={styles.recentPanel}>
              <PanelHeading detail="打开动作由控制面记录审计编号" icon={Clock3} title="最近启动记录" />
              <RecentLaunches launches={catalogQuery.data?.recentLaunches ?? []} />
            </section>

            <section className={styles.formPanel}>
              <PanelHeading
                detail={selectedTemplate ? selectedTemplate.description : "选择模板后填写参数"}
                icon={Search}
                title="检索条件"
              />
              {selectedTemplate ? (
                <form className={styles.searchForm} onSubmit={submitConfirmation}>
                  <div className={styles.environmentStrip}>
                    <span>{formatEnvironment(selectedTemplate.claimEnvironment)}</span>
                    <span>{formatTimeRange(activeSearchDraft.timeRange)}</span>
                    <span>{selectedTemplate.defaultIndex}</span>
                  </div>
                  <TemplateFields
                    onChange={updateField}
                    searchDraft={activeSearchDraft}
                    template={selectedTemplate}
                  />
                  <button
                    className={styles.primaryAction}
                    disabled={confirmMutation.isPending}
                    type="submit"
                  >
                    <Search aria-hidden="true" size={16} />
                    生成启动确认
                  </button>
                </form>
              ) : (
                <p className={styles.muted}>控制面没有返回可用模板。</p>
              )}
            </section>

            <ConfirmationPanel
              confirmation={confirmation}
              confirmError={confirmMutation.error}
              isLaunching={launchMutation.isPending}
              launchError={launchMutation.error}
              launchResult={launchResult}
              onOpen={openSplunk}
            />
          </section>
        )}
      </main>
    </WorkspacePageFrame>
  );
}

/**
 * @param {{
 *   detail: string,
 *   icon: import("lucide-react").LucideIcon,
 *   title: string,
 * }} props
 */
function PanelHeading({ detail, icon: Icon, title }) {
  return (
    <header className={styles.panelHeading}>
      <span aria-hidden="true">
        <Icon size={16} strokeWidth={2.4} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </header>
  );
}

/**
 * @param {{
 *   onChange: (field: SearchDraftField, value: string) => void,
 *   searchDraft: SearchDraft,
 *   template: QuickLinkTemplate,
 * }} props
 */
function TemplateFields({ onChange, searchDraft, template }) {
  const textFields = searchableTextFields.filter((field) => templateUsesField(template, field));

  return (
    <div className={styles.fieldGrid}>
      {textFields.map((field) => (
        <label className={styles.field} key={field}>
          <span>{fieldLabels[field]}</span>
          <input
            onChange={(event) => onChange(field, event.target.value)}
            value={searchDraft[field]}
          />
        </label>
      ))}
      {templateUsesField(template, "timeRange") ? (
        <label className={styles.field}>
          <span>时间范围</span>
          <select
            onChange={(event) => onChange("timeRange", event.target.value)}
            value={searchDraft.timeRange}
          >
            {timeRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {templateUsesField(template, "logLevel") ? (
        <label className={styles.field}>
          <span>日志级别</span>
          <select
            onChange={(event) => onChange("logLevel", event.target.value)}
            value={searchDraft.logLevel}
          >
            {logLevelOptions.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

/**
 * @param {{onSelect: (preset: PersonalPreset) => void, presets: PersonalPreset[]}} props
 */
function PresetList({ onSelect, presets }) {
  if (presets.length === 0) {
    return <p className={styles.muted}>暂无个人预设。</p>;
  }

  return (
    <div className={styles.compactList}>
      {presets.map((preset) => (
        <button
          className={styles.compactButton}
          key={preset.presetId}
          onClick={() => onSelect(preset)}
          type="button"
        >
          <strong>{preset.displayName}</strong>
          <span>
            {formatEnvironment(preset.claimEnvironment)} · {preset.serviceName || preset.keyword || "Claim 日志"}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * @param {{launches: RecentLaunch[]}} props
 */
function RecentLaunches({ launches }) {
  if (launches.length === 0) {
    return <p className={styles.muted}>暂无启动记录。</p>;
  }

  return (
    <div className={styles.recentList}>
      {launches.map((launch) => (
        <article className={styles.recentItem} key={launch.launchId}>
          <strong>{launch.templateName}</strong>
          <span>{launch.parameterSummary}</span>
          <small>
            {formatEnvironment(launch.claimEnvironment)} · {launch.auditEventId}
          </small>
        </article>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   confirmation: QuickLinkConfirmResponse | null,
 *   confirmError: Error | null,
 *   isLaunching: boolean,
 *   launchError: Error | null,
 *   launchResult: QuickLinkLaunchResponse | null,
 *   onOpen: () => void,
 * }} props
 */
function ConfirmationPanel({
  confirmation,
  confirmError,
  isLaunching,
  launchError,
  launchResult,
  onOpen,
}) {
  const error = confirmError ?? launchError;
  const isForbidden = error instanceof ApiError && error.kind === "forbidden";

  return (
    <section aria-label="启动确认" className={styles.confirmPanel}>
      <PanelHeading detail="打开前由服务端确认参数、策略和审计摘要" icon={ShieldCheck} title="启动确认" />
      {error ? (
        <FeedbackState
          message={error.message}
          state="error"
          title={isForbidden ? "Splunk 启动被拒绝" : "Splunk 启动失败"}
        />
      ) : null}
      {confirmation ? (
        <div className={styles.confirmContent}>
          <div className={styles.confirmTitle}>
            <strong>{confirmation.claimSearchSummary.title}</strong>
            <span>{confirmation.adapterSummary.displayName}</span>
          </div>
          <p>系统将打开 Splunk 页面；如果 Splunk 未登录，需要在 Splunk 页面完成登录。</p>
          <dl className={styles.confirmMeta}>
            <div>
              <dt>认证方式</dt>
              <dd>{formatAuthMode(confirmation.adapterSummary.authMode)}</dd>
            </div>
            <div>
              <dt>策略结果</dt>
              <dd>{confirmation.auditSummary.policyDecision}</dd>
            </div>
            <div>
              <dt>环境</dt>
              <dd>{formatEnvironment(confirmation.templateSummary.claimEnvironment)}</dd>
            </div>
          </dl>
          <ul className={styles.queryLines}>
            {confirmation.claimSearchSummary.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {confirmation.warnings.length > 0 ? (
            <div className={styles.warningList}>
              <AlertTriangle aria-hidden="true" size={16} />
              <span>{confirmation.warnings.join(" / ")}</span>
            </div>
          ) : null}
          <button
            className={styles.primaryAction}
            disabled={isLaunching || confirmation.missingFields.length > 0}
            onClick={onOpen}
            type="button"
          >
            <ExternalLink aria-hidden="true" size={16} />
            打开 Splunk
          </button>
        </div>
      ) : (
        <p className={styles.muted}>填写检索条件并生成确认后展示服务端返回的启动摘要。</p>
      )}
      {launchResult ? (
        <p className={styles.auditResult}>审计编号 {launchResult.auditEventId}</p>
      ) : null}
    </section>
  );
}

/**
 * @returns {SearchDraft}
 */
function createEmptyDraft() {
  return {
    claimNo: "",
    policyNo: "",
    customerId: "",
    requestId: "",
    traceId: "",
    serviceName: "",
    claimEnvironment: "test",
    timeRange: "last_30_minutes",
    logLevel: "ERROR",
    keyword: "",
  };
}

/**
 * @param {QuickLinkTemplate} template
 * @returns {SearchDraft}
 */
function createTemplateDraft(template) {
  return {
    ...createEmptyDraft(),
    claimEnvironment: template.claimEnvironment,
    timeRange: template.defaultTimeRange,
  };
}

/**
 * @param {QuickLinkTemplate} template
 * @param {string} formTemplateId
 * @param {SearchDraft} draft
 * @returns {SearchDraft}
 */
function getActiveDraft(template, formTemplateId, draft) {
  return formTemplateId === template.templateId ? draft : createTemplateDraft(template);
}

/**
 * @param {PersonalPreset} source
 * @returns {Partial<SearchDraft>}
 */
function pickDraftValues(source) {
  /** @type {Partial<SearchDraft>} */
  const values = {};
  if (source.claimNo) {
    values.claimNo = source.claimNo;
  }
  if (source.policyNo) {
    values.policyNo = source.policyNo;
  }
  if (source.customerId) {
    values.customerId = source.customerId;
  }
  if (source.requestId) {
    values.requestId = source.requestId;
  }
  if (source.traceId) {
    values.traceId = source.traceId;
  }
  if (source.serviceName) {
    values.serviceName = source.serviceName;
  }
  if (source.keyword) {
    values.keyword = source.keyword;
  }
  if (source.timeRange) {
    values.timeRange = source.timeRange;
  }
  if (source.logLevel) {
    values.logLevel = source.logLevel;
  }
  return values;
}

/**
 * @param {QuickLinkTemplate} template
 * @param {SearchDraft} draft
 * @returns {ClaimSearchParameters}
 */
function buildClaimSearch(template, draft) {
  /** @type {ClaimSearchParameters} */
  const search = {
    claimEnvironment: template.claimEnvironment,
  };

  for (const field of searchableTextFields) {
    const value = draft[field].trim();
    if (value) {
      assignSearchTextField(search, field, value);
    }
  }

  if (templateUsesField(template, "timeRange")) {
    search.timeRange = draft.timeRange;
  }

  if (templateUsesField(template, "logLevel")) {
    search.logLevel = draft.logLevel;
  }

  return search;
}

/**
 * @param {QuickLinkTemplate} template
 * @param {SearchDraftField} field
 */
function templateUsesField(template, field) {
  return (
    template.requiredFields.includes(field) ||
    template.optionalFields.includes(field) ||
    template.userEditableFields.includes(field)
  );
}

/**
 * @param {ClaimSearchParameters} search
 * @param {SearchTextField} field
 * @param {string} value
 */
function assignSearchTextField(search, field, value) {
  if (field === "claimNo") {
    search.claimNo = value;
  } else if (field === "policyNo") {
    search.policyNo = value;
  } else if (field === "customerId") {
    search.customerId = value;
  } else if (field === "requestId") {
    search.requestId = value;
  } else if (field === "traceId") {
    search.traceId = value;
  } else if (field === "serviceName") {
    search.serviceName = value;
  } else {
    search.keyword = value;
  }
}

/**
 * @param {string} value
 */
function formatEnvironment(value) {
  return value === "production" ? "生产环境" : "测试环境";
}

/**
 * @param {string} value
 */
function formatTimeRange(value) {
  return timeRangeOptions.find((option) => option.value === value)?.label ?? value;
}

/**
 * @param {string} value
 */
function formatAuthMode(value) {
  if (value === "SSO") {
    return "SSO";
  }
  if (value === "USERNAME_PASSWORD") {
    return "用户名密码";
  }
  return "浏览器会话";
}

/**
 * @param {Error | null} error
 */
function formatCatalogError(error) {
  if (error instanceof ApiError && error.kind === "contract") {
    return "控制面返回的快捷模板不符合前端契约，页面已阻止渲染。";
  }
  if (error instanceof ApiError && error.kind === "forbidden") {
    return "服务端策略拒绝读取快捷模板。";
  }
  return "快捷模板接口暂时不可用。";
}
