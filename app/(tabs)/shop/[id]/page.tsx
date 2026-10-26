import { Suspense } from "react";
import { Page, PageHeader, Skeleton } from "@/components/ui";
import ScanView from "./ScanView";

// The id comes from the URL at runtime, so the view streams in behind a boundary
// while the static shell (header + skeleton) prerenders.
export default function ScanViewPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Verdict" back="/shop" />
          <Page>
            <Skeleton className="aspect-square w-full" />
          </Page>
        </>
      }
    >
      <ScanView />
    </Suspense>
  );
}
