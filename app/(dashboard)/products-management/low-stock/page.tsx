import ProductManagementWorkspace from "@/components/products/ProductManagementWorkspace";

/** Shows tenant-scoped active products whose combined batch stock needs reordering. */
export default function LowStockPage() {
  return <ProductManagementWorkspace view="low-stock" />;
}
