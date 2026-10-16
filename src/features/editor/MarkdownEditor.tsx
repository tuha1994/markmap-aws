type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function MarkdownEditor({ value, onChange, disabled = false }: Props) {
  return (
    <label className="markdown-editor-field">
      <span className="markdown-editor-label">Markdown</span>
      <textarea
        aria-label="Markdown"
        value={value}
        disabled={disabled}
        spellCheck="false"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
