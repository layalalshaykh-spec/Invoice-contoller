import { seedData } from "@/lib/data/seed";
import { CommandCenter } from "@/components/command-center";

export const metadata = {
  title: "Nexa AP | Accounts Payable Command Center",
  description: "AI-assisted invoice control, matching and exception management.",
};

export default function Home() {
  return <CommandCenter initialData={seedData} />;
}
