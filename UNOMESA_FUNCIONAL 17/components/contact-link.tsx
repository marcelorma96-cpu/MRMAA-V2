'use client';
import {useEffect, useState, type ReactNode, type MouseEventHandler} from 'react';
import {nativeContactTarget} from '@/lib/public-contact';

/** Ordinary links retain the browser's user gesture and native universal-link handling. */
export function ContactLink({href, children, className, onClick}: {href: string; children: ReactNode; className?: string; onClick?: MouseEventHandler<HTMLAnchorElement>}) {
  const [native, setNative] = useState(false);
  useEffect(() => { setNative(/UnoMesa-(iOS|Android)\//.test(navigator.userAgent)); }, []);
  if (!href) return <span className={className} aria-disabled="true">{children}</span>;
  return <a href={href} className={className} target={nativeContactTarget(native, href)} rel="noopener noreferrer" onClick={onClick}>{children}</a>;
}
