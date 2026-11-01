// Read-only PostgREST load probe for an isolated staging project.
// No payments, account creation, updates, deletes, or production provisioning.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const buckets = [50,100,200,300,500,750,1000,1500,2000,3000,5000,10000,Infinity];
const tables = ['v2_reservations','v2_clients','v2_quotes'];
const jwtRole = token => {try {return JSON.parse(Buffer.from(token.split('.')[1],'base64url')).role;} catch {return null;}};
export function validate(config) {
  const url = new URL(config.supabase_url);
  if (config.confirmation !== 'STAGING_ONLY' || url.protocol !== 'https:' || url.hostname !== config.allowed_host ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('STAGING_CONFIGURATION_REQUIRED');
  if (!config.anon_key || !Array.isArray(config.fixtures) || config.fixtures.length < 2) throw Error('TWO_ISOLATED_FIXTURES_REQUIRED');
  if (config.anon_key.startsWith('sb_secret_') || jwtRole(config.anon_key) === 'service_role') throw Error('PRIVILEGED_KEY_FORBIDDEN');
  const ids = new Set();
  for (const f of config.fixtures) {
    if (![f.restaurant_id,f.company_root_id,f.probe_reservation_id].every(v => uuid.test(v || '')) || jwtRole(f.access_token) !== 'authenticated' || ids.has(f.restaurant_id)) throw Error('INVALID_FIXTURE');
    ids.add(f.restaurant_id);
  }
  if (new Set(config.fixtures.map(f => f.company_root_id)).size < 2) throw Error('TWO_COMPANIES_REQUIRED');
  for (const [key,min,max] of [['concurrency',1,1000],['duration_seconds',1,1800],['think_ms',100,60000]]) {
    if (!Number.isInteger(config[key]) || config[key] < min || config[key] > max) throw Error('INVALID_LOAD_BOUNDS');
  }
  return config;
}

export async function runProbe(input, fetcher = fetch) {
  const c = validate(input), started = performance.now();
  let requests = 0, failures = 0, unauthorized = 0, leaks = 0;
  const histogram = buckets.map(() => 0);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function read(f, table, restaurant, probe) {
    const url = new URL('/rest/v1/' + table, c.supabase_url);
    url.search = new URLSearchParams({select:'id,restaurant_id',restaurant_id:'eq.' + restaurant,limit:'25',...(probe ? {id:'eq.' + probe} : {})}).toString();
    const t = performance.now(); let response; requests++;
    try {
      response = await fetcher(url, {headers:{apikey:c.anon_key,Authorization:'Bearer ' + f.access_token}, signal:AbortSignal.timeout(10000), redirect:'error'});
      if (response.status === 401) {unauthorized++; throw Error('EXPIRED_OR_INVALID_TEST_SESSION');}
      if (response.status === 403 && restaurant !== f.restaurant_id) return [];
      if (!response.ok) throw Error('READ_FAILED');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw Error('INVALID_RESPONSE');
      if (rows.some(row => row.restaurant_id !== f.restaurant_id)) {leaks++; throw Error('TENANT_ISOLATION_FAILED');}
      return rows;
    } catch (error) {failures++; throw error;}
    finally {histogram[buckets.findIndex(bound => performance.now() - t <= bound)]++;}
  }
  // Probe known rows: empty datasets cannot falsely pass the isolation check.
  let next = 0;
  await Promise.all(Array.from({length:Math.min(4,c.fixtures.length)}, async () => {
    while (next < c.fixtures.length) {
      const f = c.fixtures[next++], foreign = c.fixtures.find(x => x.company_root_id !== f.company_root_id);
      const own = await read(f,'v2_reservations',f.restaurant_id,f.probe_reservation_id);
      if (!own.some(row => row.id === f.probe_reservation_id)) throw Error('OWN_FIXTURE_NOT_VISIBLE');
      const forbidden = await read(f,'v2_reservations',foreign.restaurant_id,foreign.probe_reservation_id);
      if (forbidden.length) throw Error('TENANT_ISOLATION_FAILED');
    }
  }));
  const until = performance.now() + c.duration_seconds * 1000;
  next = 0;
  await Promise.all(Array.from({length:c.concurrency}, async () => {
    while (performance.now() < until && !leaks && !unauthorized) {
      const index = next++, f = c.fixtures[index % c.fixtures.length];
      try {await read(f,tables[index % tables.length],f.restaurant_id);} catch {}
      await sleep(c.think_ms);
    }
  }));
  let cumulative = 0, p95 = Infinity;
  for (let i=0;i<buckets.length;i++) {cumulative += histogram[i]; if (cumulative >= requests * .95) {p95=buckets[i];break;}}
  return {scope:'staging-read-only; excludes writes, payments, Realtime and UI',
    restaurants:c.fixtures.length,companies:new Set(c.fixtures.map(f=>f.company_root_id)).size,concurrency:c.concurrency,
    elapsed_seconds:Math.round((performance.now()-started)/1000),requests,failures,unauthorized,tenant_leaks:leaks,
    p95_upper_bound_ms:Number.isFinite(p95)?p95:'over 10000',pass:failures===0 && leaks===0};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw Error('Provide a private staging fixture JSON path');
    const result = await runProbe(JSON.parse(await readFile(process.argv[2],'utf8')));
    console.log(JSON.stringify(result,null,2)); if (!result.pass) process.exitCode=1;
  } catch (error) {console.error(error.message);process.exitCode=1;}
}
