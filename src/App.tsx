import { useMemo } from "react";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router";
import { DashboardView } from "./views/DashboardView";
import { InitView } from "./views/InitView";
import { ActionView } from "./views/ActionView";
import { useWorkspaceStatus } from "./hooks/useWorkspaceStatus";

function RootRoute() {
  const navigate = useNavigate();
  const { workspaceState } = useWorkspaceStatus();

  function openAction(label: string) {
    navigate(`/action/${label}`);
  }

  if (!workspaceState.hasWorkspace) {
    return <InitView onOpenAction={openAction} />;
  }

  return <DashboardView onOpenAction={openAction} />;
}

export function App() {
  const router = useMemo(
    () =>
      createMemoryRouter(
        [
          {
            path: "/",
            element: <RootRoute />,
          },
          {
            path: "/action/:action",
            element: <ActionView />,
          },
        ],
        { initialEntries: ["/"] },
      ),
    [],
  );

  return <RouterProvider router={router} />;
}
