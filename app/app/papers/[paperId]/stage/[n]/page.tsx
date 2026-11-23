import { notFound, redirect } from "next/navigation";
import { stageRedirect } from "@/lib/stages/gate-guard";
import { StageShell } from "@/components/stages/stage-shell";
import { requireUser } from "@/lib/auth/require-user";
import { loadAccountPaper } from "@/lib/papers/load";

type Props = {
  params: Promise<{ paperId: string; n: string }>;
};

export default async function StagePage({ params }: Props) {
  const { paperId, n } = await params;
  const stage = Number(n);
  if (!Number.isInteger(stage) || stage < 1 || stage > 6) notFound();

  const access = await requireUser(`/app/papers/${paperId}/stage/${stage}`);
  if (access.kind === "user") {
    const loaded = await loadAccountPaper(access.session.id, paperId);
    if (!loaded) notFound();
    // Preserved gates: a URL past the paper's stage never opens (or moves) it.
    const back = stageRedirect(stage, loaded.paper.current_stage);
    if (back !== null) redirect(`/app/papers/${paperId}/stage/${back}`);
    return (
      <StageShell
        paperId={paperId}
        stage={stage}
        demoMode={false}
        initialPaper={loaded.paper}
        initialRequirements={loaded.requirements}
        initialRawText={loaded.rawText}
        storyAnswer={loaded.storyAnswer}
      />
    );
  }

  return <StageShell paperId={paperId} stage={stage} demoMode />;
}
