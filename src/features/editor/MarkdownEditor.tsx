type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function MarkdownEditor({ value, onChange, disabled = false }: Props) {
  return (
    <label>
      Markdown
      <textarea
        aria-label="Markdown"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
