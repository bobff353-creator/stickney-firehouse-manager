import type { Metadata } from "next";
import DraftAdvisor from "./DraftAdvisor";

export const metadata: Metadata = {
  title: "Goodfellas Draft Advisor",
  description:
    "Fantasy football draft advisor weighted to the Goodfellas league scoring — value over replacement, positional drop-off, and live best-pick recommendations.",
};

export default function DraftPage() {
  return <DraftAdvisor />;
}
