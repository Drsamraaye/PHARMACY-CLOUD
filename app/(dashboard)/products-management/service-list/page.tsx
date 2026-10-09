import ProductManagementWorkspace from "@/components/products/ProductManagementWorkspace";

/** Service catalog filtered to SERVICE products, with edit and archive actions. */
export default function ServicesPage() {
  return <ProductManagementWorkspace view="services" addNewHref="/products-management/add-new" />;
}
