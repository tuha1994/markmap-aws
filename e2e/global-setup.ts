import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

type AuthUser = { localId: string };

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required E2E environment variable: ${name}`);
  return value;
}

async function responseJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`E2E emulator setup failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function createAuthUser(email: string, password: string): Promise<AuthUser> {
  const host = requiredEnvironment('FIREBASE_AUTH_EMULATOR_HOST');
  const response = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=e2e-api-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  return responseJson(response) as Promise<AuthUser>;
}

export default async function globalSetup() {
  const emailPassword = requiredEnvironment('VITE_E2E_AUTH_PASSWORD');
  const [approved, unapproved] = await Promise.all([
    createAuthUser(requiredEnvironment('VITE_E2E_APPROVED_EMAIL'), emailPassword),
    createAuthUser(requiredEnvironment('VITE_E2E_DENIED_EMAIL'), emailPassword)
  ]);
  const now = new Date();
  const [host, portText] = requiredEnvironment('FIRESTORE_EMULATOR_HOST').split(':');
  const testEnvironment = await initializeTestEnvironment({
    projectId: requiredEnvironment('VITE_FIREBASE_PROJECT_ID'),
    firestore: { host, port: Number(portText) }
  });
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, 'authorizedUsers', approved.localId), {
      enabled: true,
      grantedAt: now,
      grantedBy: 'e2e-local-emulator'
    });
    await setDoc(doc(database, 'mindMaps', 'e2e-workspace-map'), {
      ownerUid: approved.localId,
      folderId: null,
      title: 'E2E workspace map',
      titleLower: 'e2e workspace map',
      markdown: '# E2E workspace map',
      contentSearchText: '# e2e workspace map',
      contentVersion: 1,
      currentRevisionId: null,
      currentRevisionAt: null,
      revisionPrunePending: false,
      deletedAt: null,
      deletedByUid: null,
      createdAt: now,
      updatedAt: now
    });
    await Promise.all([
      ['e2e-autosave-map', 'E2E autosave map'],
      ['e2e-navigation-source', 'E2E navigation source'],
      ['e2e-navigation-target', 'E2E navigation target'],
      ['e2e-offline-source', 'E2E offline source'],
      ['e2e-offline-target', 'E2E offline target'],
      ['e2e-recovery-map', 'E2E recovery map'],
      ['e2e-multi-tab-map', 'E2E multi-tab map']
    ].map(async ([id, title], index) => {
      const timestamp = new Date(now.getTime() - (index + 1) * 1000);
      await setDoc(doc(database, 'mindMaps', id), {
        ownerUid: approved.localId,
        folderId: null,
        title,
        titleLower: title.toLocaleLowerCase(),
        markdown: `# ${title}`,
        contentSearchText: `# ${title.toLocaleLowerCase()}`,
        contentVersion: 1,
        currentRevisionId: null,
        currentRevisionAt: null,
        revisionPrunePending: false,
        deletedAt: null,
        deletedByUid: null,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }));
  });
  await testEnvironment.cleanup();
  if (!unapproved.localId) throw new Error('The unapproved Auth Emulator user was not created.');
}
