/**
 * @typedef {object} StatusPillProps
 * @property {string} children
 * @property {"info" | "success" | "warning" | "danger"} [tone]
 */

/**
 * @param {StatusPillProps} props
 */
export function StatusPill({ children, tone = "info" }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

