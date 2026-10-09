import ProductManagementWorkspace from "@/components/products/ProductManagementWorkspace";

/** Finds same-name/barcode matches and merges duplicate stock into the retained catalog item. */
export default function DuplicateProductsPage() {
  return <ProductManagementWorkspace view="duplicates" />;
}
