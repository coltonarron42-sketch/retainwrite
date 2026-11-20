import { notFound } from "next/navigation";
import { StageShell } from "@/components/stages/stage-shell";

type Props = {
  params: Promise<{ paperId: string; n: string }>;
};

export default async function StagePage({ params }: Props) {
  const { paperId, n } = await params;
  const stage = Number(n);
  if (!Number.isInteger(stage) || stage < 1 || stage > 6) notFound();

  return <StageShell paperId={paperId} stage={stage} />;
}
