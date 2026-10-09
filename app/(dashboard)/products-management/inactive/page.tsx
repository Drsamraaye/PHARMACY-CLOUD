import ProductManagementWorkspace from "@/components/products/ProductManagementWorkspace";

/** Archived product list with product editing and a tenant-scoped reactivate action. */
export default function InactiveProductsPage() {
  return <ProductManagementWorkspace view="inactive" />;
}
