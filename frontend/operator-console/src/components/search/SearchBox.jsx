import { Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { NaturalLanguageDialog } from "../conversation/NaturalLanguageDialog.jsx";
import styles from "./SearchBox.module.css";

/**
 * @typedef {"conditions" | "natural"} SearchMode
 */

/**
 * @typedef {object} SearchModeOption
 * @property {string} label
 * @property {SearchMode} value
 */

/**
 * @typedef {object} SearchRequest
 * @property {SearchMode} mode
 * @property {string} query
 */

/**
 * @typedef {object} SearchConditionOption
 * @property {string} label
 * @property {string} value
 */

/**
 * @typedef {object} SearchBoxProps
 * @property {string} ariaLabel
 * @property {string} [className]
 * @property {string} [clearLabel]
 * @property {string} [conditionLabel]
 * @property {SearchConditionOption[]} [conditionOptions]
 * @property {SearchMode} [initialMode]
 * @property {string} [initialValue]
 * @property {string} [inputLabel]
 * @property {SearchModeOption[]} [modes]
 * @property {string} [naturalPlaceholder]
 * @property {(value: string) => void} [onConditionChange]
 * @property {(request: SearchRequest) => void} onSearch
 * @property {string} [placeholder]
 * @property {string} [selectedCondition]
 * @property {string} [submitLabel]
 */

/** @type {SearchModeOption[]} */
const DEFAULT_MODES = [
  { label: "条件", value: "conditions" },
  { label: "自然语言", value: "natural" },
];

/**
 * @param {SearchBoxProps} props
 */
export function SearchBox({
  ariaLabel,
  className = "",
  clearLabel = "清空搜索",
  conditionLabel = "条件过滤",
  conditionOptions = [],
  initialMode = "conditions",
  initialValue = "",
  inputLabel = "搜索关键字",
  modes = DEFAULT_MODES,
  naturalPlaceholder = "用自然语言描述要查找的内容",
  onConditionChange,
  onSearch,
  placeholder = "输入搜索条件",
  selectedCondition = "",
  submitLabel = "搜索",
}) {
  const idPrefix = useId();
  const normalizedModes = useMemo(
    () => (modes.length > 0 ? modes : DEFAULT_MODES),
    [modes],
  );
  const initialModeExists = normalizedModes.some((option) => option.value === initialMode);
  const [mode, setMode] = useState(
    /** @type {SearchMode} */ (initialModeExists ? initialMode : normalizedModes[0].value),
  );
  const [conditionQuery, setConditionQuery] = useState(initialValue);
  const [naturalQuery, setNaturalQuery] = useState("");

  /**
   * @param {SearchMode} searchMode
   * @param {string} query
   */
  function submitSearch(searchMode, query) {
    onSearch({ mode: searchMode, query: query.trim() });
  }

  function clearSearch() {
    setConditionQuery("");
    onSearch({ mode: "conditions", query: "" });
  }

  return (
    <div
      aria-label={ariaLabel}
      className={`${styles.searchBox} ${className}`.trim()}
      role="search"
    >
      <div className={styles.tabList} aria-label="搜索模式" role="tablist">
        {normalizedModes.map((option) => (
          <button
            aria-controls={`${idPrefix}-${option.value}-panel`}
            aria-selected={mode === option.value}
            className={mode === option.value ? styles.activeTab : ""}
            id={`${idPrefix}-${option.value}-tab`}
            key={option.value}
            onClick={() => setMode(option.value)}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === "conditions" ? (
        <form
          aria-labelledby={`${idPrefix}-conditions-tab`}
          className={styles.conditionPanel}
          id={`${idPrefix}-conditions-panel`}
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch("conditions", conditionQuery);
          }}
          role="tabpanel"
        >
          <div className={styles.conditionControls}>
            <label className={styles.inputShell}>
              <Search aria-hidden="true" size={16} strokeWidth={2.35} />
              <span>{inputLabel}</span>
              <input
                aria-label={inputLabel}
                onChange={(event) => setConditionQuery(event.target.value)}
                placeholder={placeholder}
                type="search"
                value={conditionQuery}
              />
            </label>

            {conditionQuery.length > 0 ? (
              <button
                aria-label={clearLabel}
                className={styles.clearButton}
                onClick={clearSearch}
                type="button"
              >
                <X aria-hidden="true" size={15} strokeWidth={2.4} />
              </button>
            ) : null}

            <button className={styles.submitButton} type="submit">
              <Search aria-hidden="true" size={15} strokeWidth={2.35} />
              {submitLabel}
            </button>
          </div>

          {conditionOptions.length > 0 ? (
            <div
              aria-label={conditionLabel}
              className={styles.conditionFilters}
              role="group"
            >
              {conditionOptions.map((option) => (
                <button
                  aria-pressed={selectedCondition === option.value}
                  className={selectedCondition === option.value ? styles.activeCondition : ""}
                  key={option.value}
                  onClick={() => onConditionChange?.(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </form>
      ) : null}

      {mode === "natural" ? (
        <div
          aria-labelledby={`${idPrefix}-natural-tab`}
          className={styles.naturalPanel}
          id={`${idPrefix}-natural-panel`}
          role="tabpanel"
        >
          <NaturalLanguageDialog
            ariaLabel={`${ariaLabel}自然语言`}
            className={styles.naturalDialog}
            inputClassName={styles.naturalInput}
            inputLabel="自然语言搜索"
            onChange={setNaturalQuery}
            onSubmit={() => submitSearch("natural", naturalQuery)}
            placeholder={naturalPlaceholder}
            submitAriaLabel="搜索自然语言"
            submitClassName={styles.naturalSubmit}
            submitDisabled={naturalQuery.trim().length === 0}
            submitIcon={<Search aria-hidden="true" size={15} strokeWidth={2.35} />}
            submitLabel="搜索自然语言"
            value={naturalQuery}
          />
        </div>
      ) : null}
    </div>
  );
}
