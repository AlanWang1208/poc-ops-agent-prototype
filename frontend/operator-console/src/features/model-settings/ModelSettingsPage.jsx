import { useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Plus,
  RadioTower,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import { ApiError } from "../../api/client.js";
import { StatusPill } from "../../components/data-display/StatusPill.jsx";
import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import { Button } from "../../components/primitives/Button.jsx";
import {
  useCreateModelProvider,
  useDisableModelProvider,
  useModelProviders,
  useRotateModelProviderApiKey,
  useSetDefaultModelProvider,
  useTestModelProvider,
  useUpdateModelProvider,
} from "./use-model-providers.js";
import styles from "./ModelSettingsPage.module.css";

/** @typedef {import("../../schemas/model-provider-schemas.js").ModelProviderSummary} ModelProviderSummary */

const DEFAULT_FORM = {
  displayName: "",
  baseUrl: "https://api.openai.com/v1",
  modelName: "",
  apiKey: "",
  enabled: true,
  timeoutSeconds: "30",
  maxIterations: "5",
  maxToolCalls: "5",
  maxToolCallDurationSeconds: "30",
};

export function ModelSettingsPage() {
  const providersQuery = useModelProviders();
  const createMutation = useCreateModelProvider();
  const updateMutation = useUpdateModelProvider();
  const rotateApiKeyMutation = useRotateModelProviderApiKey();
  const testMutation = useTestModelProvider();
  const setDefaultMutation = useSetDefaultModelProvider();
  const disableMutation = useDisableModelProvider();
  const providers = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);
  const [selectedProviderId, setSelectedProviderId] = useState(
    /** @type {string | null} */ (null),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formKey, setFormKey] = useState("create");
  const [notice, setNotice] = useState(/** @type {string | null} */ (null));
  const [errorMessage, setErrorMessage] = useState(/** @type {string | null} */ (null));
  const [probeResult, setProbeResult] = useState(
    /** @type {import("../../schemas/model-provider-schemas.js").ModelProviderProbeResult | null} */ (null),
  );

  const defaultProvider = providers.find((provider) => provider.defaultProvider) ?? null;
  const createMode = isCreating || providers.length === 0;
  const selectedProvider = useMemo(() => {
    if (createMode) {
      return null;
    }
    return (
      providers.find((provider) => provider.providerId === selectedProviderId) ??
      defaultProvider ??
      providers[0] ??
      null
    );
  }, [createMode, defaultProvider, providers, selectedProviderId]);
  const activeFormKey = createMode || !selectedProvider ? "create" : selectedProvider.providerId;
  const activeForm =
    formKey === activeFormKey ? form : formFromProvider(selectedProvider, createMode);
  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    rotateApiKeyMutation.isPending ||
    setDefaultMutation.isPending ||
    disableMutation.isPending;

  /**
   * @param {keyof typeof DEFAULT_FORM} field
   * @param {string | boolean} value
   */
  function updateForm(field, value) {
    setFormKey(activeFormKey);
    setForm((current) => ({
      ...(formKey === activeFormKey ? current : activeForm),
      [field]: value,
    }));
    setNotice(null);
    setErrorMessage(null);
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedProviderId(null);
    setFormKey("create");
    setForm(DEFAULT_FORM);
    setNotice(null);
    setErrorMessage(null);
    setProbeResult(null);
  }

  /**
   * @param {ModelProviderSummary} provider
   */
  function selectProvider(provider) {
    setIsCreating(false);
    setSelectedProviderId(provider.providerId);
    setFormKey(provider.providerId);
    setForm(formFromProvider(provider, false));
    setNotice(null);
    setErrorMessage(null);
    setProbeResult(null);
  }

  /**
   * @param {import("react").FormEvent<HTMLFormElement>} event
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);
    setErrorMessage(null);
    setProbeResult(null);

    try {
      if (createMode) {
        const created = await createMutation.mutateAsync({
          ...metadataPayload(activeForm),
          apiKey: activeForm.apiKey,
        });
        setIsCreating(false);
        setSelectedProviderId(created.providerId);
        setNotice("模型供应方已新增");
        setFormKey(created.providerId);
        setForm(formFromProvider(created, false));
        return;
      }

      if (!selectedProvider) {
        throw new Error("未选择模型供应方");
      }

      const updated = await updateMutation.mutateAsync({
        providerId: selectedProvider.providerId,
        input: {
          ...metadataPayload(activeForm),
          enabled: activeForm.enabled,
        },
      });
      if (activeForm.apiKey.trim()) {
        await rotateApiKeyMutation.mutateAsync({
          providerId: selectedProvider.providerId,
          input: { apiKey: activeForm.apiKey },
        });
      }
      setSelectedProviderId(updated.providerId);
      setNotice(activeForm.apiKey.trim() ? "配置和 API Key 已保存" : "模型配置已保存");
      setFormKey(updated.providerId);
      setForm(formFromProvider(updated, false));
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  async function handleSetDefault() {
    if (!selectedProvider) {
      return;
    }
    try {
      const updated = await setDefaultMutation.mutateAsync(selectedProvider.providerId);
      setSelectedProviderId(updated.providerId);
      setNotice("默认模型已切换");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  async function handleDisable() {
    if (!selectedProvider) {
      return;
    }
    try {
      const updated = await disableMutation.mutateAsync(selectedProvider.providerId);
      setSelectedProviderId(updated.providerId);
      setNotice("模型供应方已禁用");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  async function handleTest() {
    if (!selectedProvider) {
      return;
    }
    try {
      const result = await testMutation.mutateAsync(selectedProvider.providerId);
      setProbeResult(result);
      setNotice(null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(readErrorMessage(error));
    }
  }

  return (
    <WorkspacePageFrame className={styles.settingsCanvas}>
      <WorkspaceStatusBar title="模型设置" />

      <main className={styles.workspaceBody}>
        <section className={styles.providerRail} aria-label="模型供应方列表">
          <div className={styles.railHeader}>
            <div>
              <span className={styles.kicker}>M04 Agent Runtime</span>
              <h2>模型供应方</h2>
            </div>
            <Button
              aria-label="新增模型供应方"
              className={styles.iconButton}
              onClick={startCreate}
              variant="secondary"
            >
              <Plus aria-hidden="true" size={17} />
            </Button>
          </div>

          <ProviderList
            isCreating={createMode}
            onSelect={selectProvider}
            providers={providers}
            query={providersQuery}
            selectedProviderId={selectedProviderId}
          />
        </section>

        <section className={styles.editorPanel} aria-label="模型供应方配置">
          <div className={styles.editorHeader}>
            <div>
              <span className={styles.kicker}>{createMode ? "新增" : "编辑"}</span>
              <h2>供应方详情</h2>
            </div>
            <div className={styles.currentDefault} aria-label="当前默认模型">
              <RadioTower aria-hidden="true" size={17} />
              <span>{defaultProvider?.displayName ?? "未设置默认模型"}</span>
            </div>
          </div>

          <form className={styles.formGrid} onSubmit={(event) => void handleSubmit(event)}>
            <label className={styles.field}>
              <span>显示名称</span>
              <input
                autoComplete="off"
                onChange={(event) => updateForm("displayName", event.target.value)}
                placeholder="OpenAI"
                required
                value={activeForm.displayName}
              />
            </label>
            <label className={styles.field}>
              <span>Base URL</span>
              <input
                autoComplete="off"
                onChange={(event) => updateForm("baseUrl", event.target.value)}
                placeholder="https://api.openai.com/v1"
                required
                value={activeForm.baseUrl}
              />
            </label>
            <label className={styles.field}>
              <span>模型名称</span>
              <input
                autoComplete="off"
                onChange={(event) => updateForm("modelName", event.target.value)}
                placeholder="gpt-4.1-mini"
                required
                value={activeForm.modelName}
              />
            </label>
            <label className={styles.field}>
              <span>{createMode ? "API Key" : "新 API Key"}</span>
              <input
                autoComplete="new-password"
                onChange={(event) => updateForm("apiKey", event.target.value)}
                placeholder={createMode ? "输入 API Key" : "留空则不轮换"}
                required={createMode}
                type="password"
                value={activeForm.apiKey}
              />
            </label>

            <fieldset className={styles.runtimeFieldset}>
              <legend>运行限制</legend>
              <label>
                <span>超时秒数</span>
                <input
                  min="1"
                  onChange={(event) => updateForm("timeoutSeconds", event.target.value)}
                  required
                  type="number"
                  value={activeForm.timeoutSeconds}
                />
              </label>
              <label>
                <span>最大轮次</span>
                <input
                  min="1"
                  onChange={(event) => updateForm("maxIterations", event.target.value)}
                  required
                  type="number"
                  value={activeForm.maxIterations}
                />
              </label>
              <label>
                <span>最大工具调用</span>
                <input
                  min="1"
                  onChange={(event) => updateForm("maxToolCalls", event.target.value)}
                  required
                  type="number"
                  value={activeForm.maxToolCalls}
                />
              </label>
              <label>
                <span>工具超时秒数</span>
                <input
                  min="1"
                  onChange={(event) => updateForm("maxToolCallDurationSeconds", event.target.value)}
                  required
                  type="number"
                  value={activeForm.maxToolCallDurationSeconds}
                />
              </label>
            </fieldset>

            <label className={styles.toggleField}>
              <input
                checked={activeForm.enabled}
                disabled={createMode}
                onChange={(event) => updateForm("enabled", event.target.checked)}
                type="checkbox"
              />
              <span>启用该供应方</span>
            </label>

            <div className={styles.actionRow}>
              <Button disabled={isBusy} type="submit">
                <Save aria-hidden="true" size={17} />
                保存
              </Button>
              <Button
                disabled={createMode || !selectedProvider || isBusy}
                onClick={() => void handleSetDefault()}
                type="button"
                variant="secondary"
              >
                <CheckCircle2 aria-hidden="true" size={17} />
                设为默认
              </Button>
              <Button
                disabled={createMode || !selectedProvider || testMutation.isPending}
                onClick={() => void handleTest()}
                type="button"
                variant="secondary"
              >
                <RadioTower aria-hidden="true" size={17} />
                测试配置
              </Button>
              <Button
                disabled={createMode || !selectedProvider || isBusy}
                onClick={() => void handleDisable()}
                type="button"
                variant="danger"
              >
                <Ban aria-hidden="true" size={17} />
                禁用
              </Button>
            </div>
          </form>

          <ModelProviderMessage
            errorMessage={errorMessage}
            notice={notice}
            probeResult={probeResult}
            selectedProvider={selectedProvider}
          />
        </section>
      </main>
    </WorkspacePageFrame>
  );
}

/**
 * @param {{
 *   isCreating: boolean,
 *   onSelect: (provider: ModelProviderSummary) => void,
 *   providers: ModelProviderSummary[],
 *   query: ReturnType<typeof useModelProviders>,
 *   selectedProviderId: string | null
 * }} props
 */
function ProviderList({ isCreating, onSelect, providers, query, selectedProviderId }) {
  if (query.isLoading) {
    return <FeedbackState message="正在读取模型配置" state="loading" title="加载模型供应方" />;
  }
  if (query.isError) {
    return (
      <FeedbackState
        message={readErrorMessage(query.error)}
        state="error"
        title="模型配置读取失败"
      />
    );
  }
  if (providers.length === 0) {
    return <FeedbackState message="需要先新增一个供应方" state="empty" title="暂无模型供应方" />;
  }

  return (
    <div className={styles.providerList}>
      {providers.map((provider) => (
        <button
          aria-pressed={!isCreating && selectedProviderId === provider.providerId}
          className={`${styles.providerRow} ${
            !isCreating && selectedProviderId === provider.providerId ? styles.providerRowActive : ""
          }`}
          key={provider.providerId}
          onClick={() => onSelect(provider)}
          type="button"
        >
          <span className={styles.providerIcon} aria-hidden="true">
            <SlidersHorizontal size={18} />
          </span>
          <span className={styles.providerMain}>
            <span className={styles.providerTitleLine}>
              <strong>{provider.displayName}</strong>
              <span className={styles.providerBadges}>
                {provider.defaultProvider ? <StatusPill tone="success">默认</StatusPill> : null}
                {!provider.enabled ? <StatusPill tone="danger">禁用</StatusPill> : null}
              </span>
            </span>
            <span className={styles.providerModelName}>{provider.modelName}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   errorMessage: string | null,
 *   notice: string | null,
 *   probeResult: import("../../schemas/model-provider-schemas.js").ModelProviderProbeResult | null,
 *   selectedProvider: ModelProviderSummary | null
 * }} props
 */
function ModelProviderMessage({ errorMessage, notice, probeResult, selectedProvider }) {
  if (errorMessage) {
    return (
      <div className={`${styles.message} ${styles.messageError}`} role="alert">
        <ShieldCheck aria-hidden="true" size={18} />
        <span>{errorMessage}</span>
      </div>
    );
  }
  if (probeResult) {
    const messageTone =
      probeResult.status === "SUCCEEDED" ? styles.messageSuccess : styles.messageError;
    return (
      <div className={`${styles.message} ${messageTone}`} role="status">
        <RadioTower aria-hidden="true" size={18} />
        <span>
          {probeResult.status}: {probeResult.message}
        </span>
      </div>
    );
  }
  if (notice) {
    return (
      <div className={`${styles.message} ${styles.messageSuccess}`} role="status">
        <CheckCircle2 aria-hidden="true" size={18} />
        <span>{notice}</span>
      </div>
    );
  }
  if (!selectedProvider) {
    return null;
  }
  return (
    <dl className={styles.securityFacts} aria-label="密钥状态">
      <div>
        <dt>
          <KeyRound aria-hidden="true" size={16} />
          API Key 指纹
        </dt>
        <dd>{selectedProvider.apiKeyFingerprint}</dd>
      </div>
      <div>
        <dt>配置版本</dt>
        <dd>v{selectedProvider.configVersion}</dd>
      </div>
      <div>
        <dt>更新时间</dt>
        <dd>{formatDateTime(selectedProvider.updatedAt)}</dd>
      </div>
    </dl>
  );
}

/**
 * @param {ModelProviderSummary | null} provider
 * @param {boolean} createMode
 * @returns {typeof DEFAULT_FORM}
 */
function formFromProvider(provider, createMode) {
  if (createMode || !provider) {
    return DEFAULT_FORM;
  }
  return {
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    modelName: provider.modelName,
    apiKey: "",
    enabled: provider.enabled,
    timeoutSeconds: String(durationSeconds(provider.timeout, 30)),
    maxIterations: String(provider.maxIterations),
    maxToolCalls: String(provider.maxToolCalls),
    maxToolCallDurationSeconds: String(durationSeconds(provider.maxToolCallDuration, 30)),
  };
}

/**
 * @param {typeof DEFAULT_FORM} input
 */
function metadataPayload(input) {
  return {
    displayName: input.displayName,
    baseUrl: input.baseUrl,
    modelName: input.modelName,
    timeoutSeconds: Number(input.timeoutSeconds),
    maxIterations: Number(input.maxIterations),
    maxToolCalls: Number(input.maxToolCalls),
    maxToolCallDurationSeconds: Number(input.maxToolCallDurationSeconds),
  };
}

/**
 * @param {string | number} value
 * @param {number} fallback
 */
function durationSeconds(value, fallback) {
  if (typeof value === "number") {
    return value;
  }
  const match = /^PT(\d+)S$/u.exec(value);
  return match ? Number(match[1]) : fallback;
}

/**
 * @param {unknown} error
 */
function readErrorMessage(error) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "请求失败";
}

/**
 * @param {string} value
 */
function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
