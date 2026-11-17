import { EventManagementPage } from "@/components/event-management-page";
import { eventPageMetadata } from "@/lib/event-page-seo";
export const metadata = eventPageMetadata("en");
export default function Page() { return <EventManagementPage language="en" />; }
