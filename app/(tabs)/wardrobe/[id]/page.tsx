import { Suspense } from "react";
import { Page, PageHeader, Skeleton } from "@/components/ui";
import ItemView from "./ItemView";

// The id comes from the URL at runtime, so the view streams in behind a boundary
// while the static shell (header + skeleton) prerenders.
export default function ItemViewPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Item" back="/wardrobe" />
          <Page>
            <Skeleton className="aspect-square w-full" />
          </Page>
        </>
      }
    >
      <ItemView />
    </Suspense>
  );
}
