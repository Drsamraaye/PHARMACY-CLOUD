import GenericListPage from "@/components/shared/GenericListPage";

/** Loads and displays requests from reception from the application API. */
export default function Page() { return <GenericListPage title="Requests from reception" apiEndpoint="/api/laboratory/requests-from-reception" />; }

