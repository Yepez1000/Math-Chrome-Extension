import { SetupWizard } from "@/components/setup-wizard/setup-wizard";

function App(): React.JSX.Element {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SetupWizard />
    </div>
  );
}

export default App
