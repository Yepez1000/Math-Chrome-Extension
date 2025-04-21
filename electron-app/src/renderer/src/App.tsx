import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SetupWizard } from "@/components/setup-wizard/setup-wizard";
import DashboardPage from "@/app/dashboard/page";
import ServerStartupPage from "@/app/server-startup/page";

function App(): React.JSX.Element {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<SetupWizard />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/server-startup" element={<ServerStartupPage />} />
      </Routes>
    </MemoryRouter>
  );
}

export default App
