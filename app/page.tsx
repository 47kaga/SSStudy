import { Divider } from "@/components/Divider";
import { Screen } from "@/components/Screen";

export default function StudyPage() {
  return (
    <Screen>
      <h1 className="text-title">Study</h1>
      <Divider weight="heavy" />
      <div className="grid grid-cols-1 border-l-hairline border-t-hairline border-ink md:grid-cols-2">
        <div className="aspect-video border-b-hairline border-r-hairline border-ink" />
        <div className="aspect-video border-b-hairline border-r-hairline border-ink" />
      </div>
    </Screen>
  );
}
