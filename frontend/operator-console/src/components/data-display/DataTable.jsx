import { FeedbackState } from "../feedback/FeedbackState.jsx";
import styles from "./DataTable.module.css";

/**
 * @typedef {object} Column
 * @property {string} key
 * @property {string} header
 * @property {(row: unknown) => import("react").ReactNode} render
 * @property {"left" | "center" | "right"} [align]
 * @property {string} [className]
 * @property {string} [width]
 */

/**
 * @typedef {object} DataTablePagination
 * @property {number} page
 * @property {number} pageSize
 * @property {(page: number) => void} onPageChange
 * @property {number} [total]
 * @property {"client" | "server"} [mode]
 */

/**
 * @typedef {object} DataTableProps
 * @property {string} ariaLabel
 * @property {Column[]} columns
 * @property {string} [className]
 * @property {string} [emptyMessage]
 * @property {string} [emptyTitle]
 * @property {Error | null} [error]
 * @property {(row: unknown, rowIndex: number) => string} [getRowKey]
 * @property {boolean} [isLoading]
 * @property {string} [loadingTitle]
 * @property {string} [minWidth]
 * @property {(row: unknown) => void} [onRowClick]
 * @property {DataTablePagination} [pagination]
 * @property {unknown[]} rows
 */

/**
 * @param {DataTableProps} props
 */
export function DataTable({
  ariaLabel,
  className = "",
  columns,
  emptyMessage = "没有符合条件的数据。",
  emptyTitle = "没有数据",
  error = null,
  getRowKey,
  isLoading = false,
  loadingTitle = "正在加载",
  minWidth = "760px",
  onRowClick,
  pagination,
  rows,
}) {
  if (isLoading) {
    return (
      <div className={`${styles.wrapper} ${className}`.trim()}>
        <FeedbackState state="loading" title={loadingTitle} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.wrapper} ${className}`.trim()}>
        <FeedbackState
          message={error.message}
          state="error"
          title="数据加载失败"
        />
      </div>
    );
  }

  const totalRows = pagination?.total ?? rows.length;
  const pageSize = pagination?.pageSize ?? rows.length;
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;
  const currentPage = pagination
    ? Math.min(Math.max(1, pagination.page), pageCount)
    : 1;
  const displayRows = pagination && pagination.mode !== "server"
    ? rows.slice((currentPage - 1) * pagination.pageSize, currentPage * pagination.pageSize)
    : rows;
  const hasRows = displayRows.length > 0;

  if (!hasRows) {
    return (
      <div className={`${styles.wrapper} ${className}`.trim()}>
        <FeedbackState
          message={emptyMessage}
          state="empty"
          title={emptyTitle}
        />
      </div>
    );
  }

  return (
    <div className={`${styles.wrapper} ${className}`.trim()}>
      <table
        aria-label={ariaLabel}
        className={styles.table}
        style={{ minWidth }}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                className={column.className}
                data-align={column.align ?? "left"}
                key={column.key}
                scope="col"
                style={{ width: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, rowIndex) => {
            const absoluteIndex =
              pagination && pagination.mode !== "server"
                ? (currentPage - 1) * pagination.pageSize + rowIndex
                : rowIndex;
            const interactive = Boolean(onRowClick);
            return (
              <tr
                data-interactive={interactive ? "true" : "false"}
                key={getRowKey ? getRowKey(row, absoluteIndex) : absoluteIndex}
                onClick={interactive ? () => onRowClick?.(row) : undefined}
                onKeyDown={
                  interactive
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick?.(row);
                        }
                      }
                    : undefined
                }
                tabIndex={interactive ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td
                    className={column.className}
                    data-align={column.align ?? "left"}
                    key={column.key}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {pagination ? (
        <footer className={styles.pagination} aria-label={`${ariaLabel} 分页`}>
          <span>
            第 {currentPage} / {pageCount} 页，共 {totalRows} 条
          </span>
          <div className={styles.paginationActions}>
            <button
              disabled={currentPage <= 1}
              onClick={() => pagination.onPageChange(currentPage - 1)}
              type="button"
            >
              上一页
            </button>
            <button
              disabled={currentPage >= pageCount}
              onClick={() => pagination.onPageChange(currentPage + 1)}
              type="button"
            >
              下一页
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
