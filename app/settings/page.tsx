import { Divider } from "@/components/Divider";
import { Screen } from "@/components/Screen";

const rows = [0, 1, 2];

export default function SettingsPage() {
  return (
    <Screen>
      <h1 className="text-title">Settings</h1>
      <Divider weight="heavy" />
      <div className="border-t-hairline border-ink">
        {rows.map((row) => (
          <div key={row} className="h-16 border-b-hairline border-ink" />
        ))}
      </div>
    </Screen>
  );
}
