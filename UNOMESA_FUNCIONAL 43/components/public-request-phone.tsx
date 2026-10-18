'use client';
import {useEffect,useRef,useState} from 'react';
import PhoneInput,{getCountries,type Country} from 'react-phone-number-input';
import es from 'react-phone-number-input/locale/es.json';
import enLabels from 'react-phone-number-input/locale/en.json';
import {useAppPreferences} from './app-preferences';
import 'react-phone-number-input/style.css';
export function PublicRequestPhone({en}:{en:boolean}) {
 const {country}=useAppPreferences();
 const [selected,setSelected]=useState<Country|undefined>(),[phone,setPhone]=useState<string>();
 const edited=useRef(false);
 useEffect(()=>{if(!edited.current&&country&&getCountries().includes(country as Country))setSelected(country as Country)},[country]);
 return <div onPointerDown={()=>{edited.current=true}} onKeyDown={()=>{edited.current=true}}>
   <PhoneInput name="phone" required international autoComplete="tel" defaultCountry={selected}
     labels={en?enLabels:es} countryCallingCodeEditable={false} value={phone}
     onChange={value=>setPhone(value)}
     flagComponent={({country})=><span aria-hidden="true">{country.toUpperCase().replace(/./g,c=>String.fromCodePoint(127397+c.charCodeAt(0)))}</span>}/>
 </div>;
}
