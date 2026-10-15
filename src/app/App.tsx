import { AccessGate } from '../features/access/AccessGate';
import { AuthGate } from '../features/auth/AuthGate';
import { AuthProvider } from '../features/auth/AuthProvider';

function clearPrivateState() {
  // Workspace state and subscriptions are added in a later task.
}

export function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <AccessGate onPrivateStateClear={clearPrivateState}>
          <main aria-label="Markmap AWS workspace" />
        </AccessGate>
      </AuthGate>
    </AuthProvider>
  );
}
