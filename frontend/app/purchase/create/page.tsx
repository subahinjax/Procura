import { Suspense } from "react";
import CreatePOClient from "./CreatePOClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-gray-600">Loading…</div>}>
      <CreatePOClient />
    </Suspense>
  );
}
