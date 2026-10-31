import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardAnalytics() {
  return (
    <DashboardShell active="Analytics">
      <div className="space-y-6">
        <header>
          <p className="label-caps text-muted-foreground">Insights</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Analytics</h1>
        </header>
        <Card className="border bg-card">
          <CardContent className="p-6">
            <p className="text-lg font-medium">Performance metrics and engagement trends will show up here.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Monitor profile views, link clicks, and impressions as your audience grows.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
