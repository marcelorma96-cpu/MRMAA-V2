'use client';
import {createContext,useContext,type ReactNode} from 'react';
import type {CountryCode} from 'libphonenumber-js/min';
import {customerPhoneCountry} from '@/lib/customer-phone';
import {useAppPreferences} from './app-preferences';

const CustomerContactCountry=createContext<CountryCode|undefined>(undefined);
export function CustomerContactCountryProvider({country,children}:{country?:string|null;children:ReactNode}){
 const {country:detectedCountry}=useAppPreferences();
 return <CustomerContactCountry.Provider value={customerPhoneCountry(country,detectedCountry)}>{children}</CustomerContactCountry.Provider>;
}
export function useCustomerContactCountry(){return useContext(CustomerContactCountry)}
