'use client';
import {createContext,useContext,type ReactNode} from 'react';
import type {CountryCode} from 'libphonenumber-js/min';
import {customerWhatsAppCountry,customerWhatsAppNumber} from '@/lib/customer-whatsapp';
import {useAppPreferences} from './app-preferences';

const CustomerContactCountry=createContext<CountryCode|undefined>(undefined);
const CustomerContactSetup=createContext<{configured:boolean;number?:string;onConfigure?:()=>void}>({configured:false});
export function CustomerContactCountryProvider({country,businessWhatsApp,onConfigure,children}:{country?:string|null;businessWhatsApp?:string|null;onConfigure?:()=>void;children:ReactNode}){
 const {country:detectedCountry}=useAppPreferences();
 const resolved=customerWhatsAppCountry(country,detectedCountry);
 const number=customerWhatsAppNumber(businessWhatsApp,resolved);
 return <CustomerContactCountry.Provider value={resolved}><CustomerContactSetup.Provider value={{configured:!!number,number,onConfigure}}>{children}</CustomerContactSetup.Provider></CustomerContactCountry.Provider>;
}
export function useCustomerContactCountry(){return useContext(CustomerContactCountry)}
export function useCustomerContactSetup(){return useContext(CustomerContactSetup)}
