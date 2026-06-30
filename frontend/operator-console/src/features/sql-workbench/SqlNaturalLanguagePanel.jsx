import { Sparkles } from "lucide-react";

import { NaturalLanguageDialog } from "../../components/conversation/NaturalLanguageDialog.jsx";
import styles from "./SqlWorkbenchPage.module.css";

/**
 * @typedef {import("./sql-workbench-utils.js").SqlNaturalLanguageState} SqlNaturalLanguageState
 */

/**
 * @param {{
 *   activeSchema: string,
 *   isPending: boolean,
 *   onChange: (patch: Partial<SqlNaturalLanguageState>) => void,
 *   onGenerate: () => void,
 *   state: SqlNaturalLanguageState,
 * }} props
 */
export function SqlNaturalLanguagePanel({
  activeSchema,
  isPending,
  onChange,
  onGenerate,
  state,
}) {
  const canGenerate = state.prompt.trim().length > 0;
  const includeCurrentSql = state.includeCurrentSql || hasCurrentSqlDirective(state.prompt);

  /**
   * @param {string} token
   */
  function appendShortcut(token) {
    const prefix = state.prompt.trimEnd();
    onChange({ prompt: `${prefix}${prefix ? " " : ""}${token}` });
  }

  return (
    <section className={styles.modePanel}>
      <NaturalLanguageDialog
        ariaLabel="自然语言生成 SQL"
        className={styles.naturalComposer}
        disabled={isPending}
        inputClassName={styles.naturalComposerInput}
        inputLabel="自然语言需求"
        onChange={(value) => onChange({ prompt: value })}
        onSubmit={onGenerate}
        placeholder={`输入查询需求，可直接写 @${activeSchema} #表名 $字段1,字段2`}
        submitAriaLabel="生成 SELECT"
        submitDisabled={!canGenerate}
        submitIcon={<Sparkles aria-hidden="true" size={18} />}
        value={state.prompt}
        variant="agent-composer"
      />

      <div aria-label="自然语言快捷录入" className={styles.naturalShortcutBar}>
        <span>快捷录入</span>
        <button onClick={() => appendShortcut(`@${activeSchema}`)} type="button">
          @{activeSchema}
        </button>
        <button onClick={() => appendShortcut("#表名")} type="button">
          #表名
        </button>
        <button onClick={() => appendShortcut("$字段1,字段2")} type="button">
          $字段
        </button>
        <button
          aria-pressed={includeCurrentSql}
          className={includeCurrentSql ? styles.activeShortcut : ""}
          onClick={() => onChange({ includeCurrentSql: !state.includeCurrentSql })}
          type="button"
        >
          /sql 引用当前 SQL
        </button>
      </div>
    </section>
  );
}

/**
 * @param {string} prompt
 */
function hasCurrentSqlDirective(prompt) {
  return /(?:^|\s)\/sql(?:\s|$)/u.test(prompt);
}
