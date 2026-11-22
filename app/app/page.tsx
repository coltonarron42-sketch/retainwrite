import { redirect } from "next/navigation";
import { Dashboard } from "@/components/app/dashboard";
import { requireUser } from "@/lib/auth/require-user";
import { listAccountPapers } from "@/lib/papers/load";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function AppHomePage() {
  const access = await requireUser("/app");
  if (access.kind !== "user") {
    return <Dashboard mode="demo" />;
  }

  const papers = await listAccountPapers(access.session.id);
  // Nothing to list yet: go straight to starting the first paper.
  if (papers.length === 0) redirect("/app/papers/new");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("paper_credits, free_paper_used")
    .eq("user_id", access.session.id)
    .maybeSingle();

  return (
    <Dashboard
      mode="live"
      papers={papers}
      credits={profile?.paper_credits ?? 0}
      freePaperAvailable={!profile?.free_paper_used}
    />
  );
}
