import ProductManagementWorkspace from "@/components/products/ProductManagementWorkspace";

/** Lists expiring positive-quantity batches and lets the user choose a 30/60/90 day window. */
export default function ExpiryPage() {
  return <ProductManagementWorkspace view="expiry" />;
}
