import Editor from "@monaco-editor/react";

/**
 * @typedef {object} SqlEditorProps
 * @property {string} value
 * @property {(value: string) => void} onChange
 */

/**
 * @param {SqlEditorProps} props
 */
export function SqlEditor({ value, onChange }) {
  return (
    <Editor
      height="280px"
      language="sql"
      onChange={(nextValue) => onChange(nextValue ?? "")}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        renderLineHighlight: "line",
        scrollBeyondLastLine: false,
        wordWrap: "on",
      }}
      theme="vs"
      value={value}
    />
  );
}

