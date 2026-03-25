import ManageProjectsClient from './ManageProjectsClient';

export default function ManageProjectsPage() {
  // Avoid fetching projects on the server (SSR) because server-side fetch
  // can't use the user's browser credentials and may return 401. Let the
  // client component fetch when ready.
  return <ManageProjectsClient initialProjects={[]} />;
}
