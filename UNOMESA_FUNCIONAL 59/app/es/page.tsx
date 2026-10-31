import Home from "@/components/home-entry";
import { publicMetadata } from "@/lib/public-seo";
import { entryFromQuery, type PageQuery } from "@/lib/public-page";
type Props = {searchParams:Promise<PageQuery>};
export async function generateMetadata({searchParams}:Props) {
  return publicMetadata("es",entryFromQuery(await searchParams)!==null);
}
export default async function PublicPage({searchParams}:Props) {
  return <Home initialEntry={entryFromQuery(await searchParams)} publicLanguage="es"/>;
}
