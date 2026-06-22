import styles from "./WorkspacePageFrame.module.css";

/**
 * @typedef {object} WorkspacePageFrameProps
 * @property {import("react").ReactNode} children
 * @property {string} [className]
 */

/**
 * @param {WorkspacePageFrameProps} props
 */
export function WorkspacePageFrame({ children, className = "" }) {
  return (
    <div className={`${styles.workspaceFrame} ${className}`.trim()}>
      {children}
    </div>
  );
}
