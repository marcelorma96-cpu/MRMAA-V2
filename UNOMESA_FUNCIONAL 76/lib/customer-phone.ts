import {whatsappNumber} from './public-contact';
import {getCountries,parsePhoneNumberFromString,type CountryCode} from 'libphonenumber-js/min';
import countriesEs from 'react-phone-number-input/locale/es.json';
import countriesEn from 'react-phone-number-input/locale/en.json';


const countryKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
const countryNames=new Map<string,CountryCode>();
for(const code of getCountries()){
 for(const label of [code,countriesEs[code],countriesEn[code]])countryNames.set(countryKey(label),code);
}
for(const [label,code] of [['USA','US'],['EEUU','US'],['United States of America','US'],['Estados Unidos de América','US'],['UK','GB']] as const)countryNames.set(countryKey(label),code);

/** The restaurant's saved country wins; the already-detected visitor country is a fallback. */
export function customerPhoneCountry(restaurantCountry?:string|null,detectedCountry?:string|null):CountryCode|undefined {
 return countryNames.get(countryKey(restaurantCountry||''))||countryNames.get(countryKey(detectedCountry||''));
}

/** Complete local numbers using the current restaurant country. Explicit international destinations win. */
export function customerPhoneNumber(value?:string|null,defaultCountry?:string|null):string {
 const raw=(value||'').trim();
 if(!raw||raw.length>254)return '';
 const explicit=/^(?:\+|00|(?:https:\/\/)?(?:wa\.me|api\.whatsapp\.com)\/)/i.test(raw);
 const compact=raw.replace(/[\s().\-\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'');
 if(explicit)return whatsappNumber(raw);
 if(!/^\d{7,15}$/.test(compact))return '';
 // A saved international number may omit "+" (for example 12025550123 or
 // 34612345678). Resolve valid full destinations before applying a local country.
 // Short digit-only values remain local/ambiguous; do not guess a foreign code.
 if(/^[1-9]\d{10,14}$/.test(compact)){
  const international=parsePhoneNumberFromString('+'+compact,{extract:false});
  if(international?.isValid()&&!international.ext)return compact;
 }
 const country=customerPhoneCountry(defaultCountry);
 if(country){
  const local=parsePhoneNumberFromString(compact,{defaultCountry:country,extract:false});
  // Possible length alone is insufficient: some countries accept lengths that
  // overlap full foreign numbers. Only complete a valid national destination.
  if(local?.isValid()&&!local.ext)return local.number.slice(1);
 }
 // Keep legacy full international numbers when they cannot be parsed as local.
 // Without a known country, short numbers still require manual clarification.
 return /^[1-9]\d{10,14}$/.test(compact)?whatsappNumber(raw):'';
}
