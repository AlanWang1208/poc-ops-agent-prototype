import styles from "./DataTable.module.css";

/**
 * @typedef {object} Column
 * @property {string} key
 * @property {string} header
 * @property {(row: unknown) => import("react").ReactNode} render
 */

/**
 * @typedef {object} DataTableProps
 * @property {string} ariaLabel
 * @property {Column[]} columns
 * @property {unknown[]} rows
 */

/**
 * @param {DataTableProps} props
 */
export function DataTable({ ariaLabel, columns, rows }) {
  return (
    <div className={styles.wrapper}>
      <table aria-label={ariaLabel} className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

