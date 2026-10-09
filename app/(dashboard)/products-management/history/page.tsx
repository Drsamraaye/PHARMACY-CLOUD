import ProductManagementWorkspace from "@/components/products/ProductManagementWorkspace";

/** Audit view of tenant product creation, edits, archive, and merge events. */
export default function ProductHistoryPage() {
  return <ProductManagementWorkspace view="history" />;
}
