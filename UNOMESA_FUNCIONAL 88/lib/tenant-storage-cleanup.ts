import type { SupabaseClient } from '@supabase/supabase-js';

// Called only after an authorized database cleanup job has deleted its tenant.
// A failed/partial pass is retryable; it must never complete the cleanup job.
export async function removeTenantFiles(admin: SupabaseClient, restaurantId: string, deadline: number) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId))
    throw new Error('CLEANUP_PAYLOAD');
  let operations = 0;
  for (const bucket of ['mrmaa-branding', 'unomesa-public']) {
    const prefixes = [restaurantId];
    while (prefixes.length) {
      if (Date.now() >= deadline || ++operations > 50) throw new Error('CLEANUP_RETRY');
      const prefix = prefixes[prefixes.length - 1];
      const listed = await admin.storage.from(bucket).list(prefix, { limit: 100 });
      if (listed.error) throw new Error('STORAGE_LIST_FAILED');
      if (!listed.data?.length) { prefixes.pop(); continue; }
      for (const item of listed.data) {
        if (!item.name || /[/\\]/.test(item.name) || ['.', '..'].includes(item.name))
          throw new Error('STORAGE_PATH_INVALID');
      }
      const files = listed.data.filter(item => item.id).map(item => `${prefix}/${item.name}`);
      if (files.length) {
        const removed = await admin.storage.from(bucket).remove(files);
        if (removed.error) throw new Error('STORAGE_DELETE_FAILED');
      } else {
        if (prefixes.length > 20) throw new Error('STORAGE_PATH_INVALID');
        prefixes.push(`${prefix}/${listed.data[0].name}`);
      }
    }
  }
}
