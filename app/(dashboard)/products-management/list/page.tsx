import ProductManagementWorkspace from "@/components/products/ProductManagementWorkspace";

/** Active pharmacy catalog with search, category filtering, editing, and archive actions. */
export default function ProductListPage() {
  return <ProductManagementWorkspace view="catalog" addNewHref="/products-management/add-new" />;
}
