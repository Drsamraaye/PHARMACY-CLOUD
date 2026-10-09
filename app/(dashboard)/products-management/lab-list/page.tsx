import ProductManagementWorkspace from "@/components/products/ProductManagementWorkspace";

/** Laboratory catalog filtered to LAB products, with the same catalog maintenance actions. */
export default function LaboratoryProductsPage() {
  return <ProductManagementWorkspace view="laboratory" addNewHref="/products-management/add-new" />;
}
