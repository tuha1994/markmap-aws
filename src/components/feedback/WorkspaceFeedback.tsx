type Props = {
  kind: 'loading' | 'error';
};

export function WorkspaceFeedback({ kind }: Props) {
  if (kind === 'loading') {
    return <p role="status">Loading maps…</p>;
  }

  return <p role="alert">Maps could not be loaded.</p>;
}
