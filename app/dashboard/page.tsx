import { OracleDashboard } from "@/components/dashboard/oracle-dashboard";

export const metadata = {
  title: "ChainLex.ai - LexOracle Compliance Monitor",
  description: "Real-time oracle monitoring: CRE workflow pipeline, risk assessments, and compliance enforcement.",
};

export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-3xl font-semibold">LexOracle Compliance Monitor</h2>
        <p className="text-muted-foreground">
          Track CRE workflow executions, on-chain risk assessments, and compliance enforcement in real time.
        </p>
      </header>
      <OracleDashboard />
    </section>
  );
}
