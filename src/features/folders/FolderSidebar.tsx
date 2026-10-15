type Props = {
  mapCount: number;
};

export function FolderSidebar({ mapCount }: Props) {
  return (
    <section aria-label="Folders">
      <h2>Folders</h2>
      <p>All maps ({mapCount})</p>
      <p>Uncategorized maps are shown in the active map list.</p>
    </section>
  );
}
