import styles from "./NaturalLanguageDialog.module.css";

/**
 * @typedef {object} NaturalLanguageDialogProps
 * @property {string} ariaLabel
 * @property {string} inputLabel
 * @property {(value: string) => void} onChange
 * @property {() => void} onSubmit
 * @property {string} placeholder
 * @property {string} submitAriaLabel
 * @property {string} value
 * @property {string} [className]
 * @property {boolean} [disabled]
 * @property {string} [inputClassName]
 * @property {boolean} [submitDisabled]
 * @property {import("react").ReactNode} [submitIcon]
 * @property {string} [submitLabel]
 * @property {string} [submitClassName]
 * @property {"plain" | "agent-composer"} [variant]
 */

/**
 * @param {NaturalLanguageDialogProps} props
 */
export function NaturalLanguageDialog({
  ariaLabel,
  className = "",
  disabled = false,
  inputClassName = "",
  inputLabel,
  onChange,
  onSubmit,
  placeholder,
  submitAriaLabel,
  submitClassName = "",
  submitDisabled = false,
  submitIcon = null,
  submitLabel = "",
  variant = "plain",
  value,
}) {
  const isSubmitDisabled = disabled || submitDisabled;
  const variantClasses = variant === "agent-composer"
    ? {
        form: styles.agentComposer,
        input: styles.agentComposerInput,
        submit: styles.agentComposerSubmit,
      }
    : { form: "", input: "", submit: "" };
  const formClassName = [variantClasses.form, className].filter(Boolean).join(" ");
  const textareaClassName = [variantClasses.input, inputClassName].filter(Boolean).join(" ");
  const buttonClassName = [variantClasses.submit, submitClassName].filter(Boolean).join(" ");

  function submit() {
    if (isSubmitDisabled) {
      return;
    }
    onSubmit();
  }

  return (
    <form
      aria-label={ariaLabel}
      className={formClassName}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      role="search"
    >
      <textarea
        aria-label={inputLabel}
        className={textareaClassName}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key !== "Enter" ||
            event.shiftKey ||
            event.nativeEvent.isComposing
          ) {
            return;
          }
          event.preventDefault();
          submit();
        }}
        placeholder={placeholder}
        value={value}
      />
      <button
        aria-label={submitAriaLabel}
        className={buttonClassName}
        disabled={isSubmitDisabled}
        type="submit"
      >
        {submitIcon}
        {submitLabel ? <span>{submitLabel}</span> : null}
      </button>
    </form>
  );
}
