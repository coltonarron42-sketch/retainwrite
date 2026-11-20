import { redirect } from "next/navigation";

type Props = { params: Promise<{ paperId: string }> };

export default async function PaperIndexPage({ params }: Props) {
  const { paperId } = await params;
  redirect(`/app/papers/${paperId}/stage/1`);
}
