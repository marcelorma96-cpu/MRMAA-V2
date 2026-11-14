"use client";
import {useEffect,useState} from 'react';

/** Device preference only: never stores event data or an unfinished selection. */
export function useRememberedView<T extends string>(key:string,choices:readonly T[],fallback:T,enabled=true){
 const options=JSON.stringify(choices);
 const [state,setState]=useState<{key:string;value:T}>({key,value:fallback});
 useEffect(()=>{let value=fallback;try{const saved=enabled?localStorage.getItem(key):null;if(saved&&JSON.parse(options).includes(saved))value=saved as T;}catch{/* Storage may be unavailable in private browsing. */}setState({key,value});},[key,options,fallback,enabled]);
 function select(value:T){if(!choices.includes(value))return;setState({key,value});if(enabled)try{localStorage.setItem(key,value);}catch{/* The current view still works without storage. */}}
 return [state.key===key?state.value:fallback,select] as const;
}
