import { Divider } from "@/components/Divider";
import { Screen } from "@/components/Screen";

const cells = Array.from({ length: 12 }, (_, i) => i);

export default function CollectionPage() {
  return (
    <Screen>
      <h1 className="text-title">Collection</h1>
      <Divider weight="heavy" />
      <div className="grid grid-cols-3 border-l-hairline border-t-hairline border-ink md:grid-cols-6">
        {cells.map((cell) => (
          <div key={cell} className="aspect-square border-b-hairline border-r-hairline border-ink" />
        ))}
      </div>
    </Screen>
  );
}
