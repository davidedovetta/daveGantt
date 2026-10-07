import { createBrowserRouter } from 'react-router';
import { RequireAuth, RequireGuest } from './features/auth/guards';
import { LoginPage } from './features/auth/LoginPage';
import { ProjectPage } from './features/projects/ProjectPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { AppLayout } from './features/workspaces/AppLayout';
import { WorkspaceIndexRedirect, WorkspacePage } from './features/workspaces/WorkspacePages';

export const router = createBrowserRouter([
  {
    element: <RequireGuest />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <WorkspaceIndexRedirect /> },
          { path: '/w/:workspaceId', element: <WorkspacePage /> },
          { path: '/p/:projectId', element: <ProjectPage /> },
        ],
      },
    ],
  },
]);
