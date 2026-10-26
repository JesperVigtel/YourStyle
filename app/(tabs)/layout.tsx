import { Suspense } from "react";
import { TabBar } from "@/components/TabBar";
import { QueueSync } from "@/components/QueueSync";

export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      {/* The active tab depends on the URL, so the bar renders without a highlight in the static shell. */}
      <Suspense fallback={<TabBar static />}>
        <TabBar />
      </Suspense>
      <QueueSync />
    </>
  );
}
