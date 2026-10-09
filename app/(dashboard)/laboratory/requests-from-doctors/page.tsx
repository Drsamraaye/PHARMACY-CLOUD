import GenericListPage from "@/components/shared/GenericListPage";

/** Loads and displays requests from doctors from the application API. */
export default function Page() { return <GenericListPage title="Requests from doctors" apiEndpoint="/api/laboratory/requests-from-doctors" />; }

