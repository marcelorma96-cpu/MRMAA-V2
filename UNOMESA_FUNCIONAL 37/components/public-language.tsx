"use client";
import {createElement,type ReactNode} from 'react';
import {AppPreferencesContext,useAppPreferences,formatAppMoney} from './app-preferences';
import {translate,type AppLanguage} from '@/lib/translations';

/** Public URLs have a stable, server-rendered language; account preferences stay intact. */
export function PublicLanguage({language,children}:{language:AppLanguage;children:ReactNode}) {
 const current=useAppPreferences();
 return createElement(AppPreferencesContext.Provider,{value:{...current,language,t:value=>translate(value,language),money:value=>formatAppMoney(value,current.currency,language)}},children);
}
