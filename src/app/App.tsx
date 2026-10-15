import { useState } from 'react';
import { AccessGate } from '../features/access/AccessGate';
import { AuthGate } from '../features/auth/AuthGate';
import { AuthProvider } from '../features/auth/AuthProvider';
import { MarkdownEditor } from '../features/editor/MarkdownEditor';
import { MarkmapPreview } from '../features/preview/MarkmapPreview';

const demoMarkdown = '# Markmap workspace\n\n## Edit Markdown\n\n- Preview updates safely';

function clearPrivateState() {
  // Workspace state and subscriptions are added in a later task.
}

function PreviewDemo() {
  const [markdown, setMarkdown] = useState(demoMarkdown);
  return (
    <main aria-label="Markmap AWS workspace">
      <MarkdownEditor value={markdown} onChange={setMarkdown} />
      <MarkmapPreview markdown={markdown} />
    </main>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AuthGate onPrivateStateClear={clearPrivateState}>
        <AccessGate onPrivateStateClear={clearPrivateState}>
          <PreviewDemo />
        </AccessGate>
      </AuthGate>
    </AuthProvider>
  );
}