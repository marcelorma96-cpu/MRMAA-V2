"use client";
import { useEffect, useRef, type FocusEvent } from "react";

/** A touch inside a picker may blur its input with relatedTarget=null on iOS.
 * Keep options mounted until click; scrolling never chooses an option. */
export function usePickerDismiss(close: () => void) {
  const root = useRef<HTMLDivElement>(null);
  const insidePointer = useRef(false);
  const callback = useRef(close); callback.current = close;
  useEffect(() => {
    const pointer = (event: PointerEvent) => {
      insidePointer.current = !!root.current?.contains(event.target as Node);
      if (!insidePointer.current) callback.current();
    };
    const keyboard = () => { insidePointer.current = false; };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, []);
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (!event.relatedTarget && insidePointer.current) return;
    callback.current();
  };
  return { ref: root, onBlur };
}

/** Keep keyboard navigation inside the suggestions, without scrolling the form or page. */
export function revealPickerOption(listId:string, index:number) {
  const list=document.getElementById(listId), row=document.getElementById(listId+'-'+index);
  if(!list || !row || !list.contains(row))return;
  const top=list.getBoundingClientRect().top+list.clientTop, bottom=top+list.clientHeight;
  const rect=row.getBoundingClientRect();
  if(rect.top<top)list.scrollTop+=rect.top-top;
  else if(rect.bottom>bottom)list.scrollTop+=rect.bottom-bottom;
}
