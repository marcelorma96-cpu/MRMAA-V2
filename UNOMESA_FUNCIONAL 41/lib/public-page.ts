import { requestedAccountEntry } from "./public-entry";
export type PageQuery = Record<string,string|string[]|undefined>;
export function entryFromQuery(query: PageQuery) {
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(query)) if(value!==undefined) params.set(key,Array.isArray(value)?value[0]:value);
  return requestedAccountEntry(params.toString());
}
