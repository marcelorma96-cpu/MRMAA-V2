import type { PublicCard } from './restaurant-public';

export type CatalogItem = { id: string; name: string; description?: string; price?: number | string | null };
export function addPublicCatalogCards(current: PublicCard[], sources: CatalogItem[], kind: 'menus' | 'areas', category: string): PublicCard[] {
  const next = [...current], existing = new Set(current.map(card => card.source_id));
  for (const source of sources) {
    if (next.length >= 60) break;
    if (!source.id || !source.name || existing.has(source.id)) continue;
    next.push({ id: crypto.randomUUID(), source_id: source.id, name: source.name, description: source.description || '', price: source.price != null ? String(source.price) : '', category: kind === 'menus' ? category : '', image: '', capacity: '' });
    existing.add(source.id);
  }
  return next;
}
