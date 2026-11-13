"use client";

import { Component, createRef, type ReactNode } from "react";

type Props = { queryKey: string; rows: readonly { id: string }[]; labels: Readonly<Record<string,string>>; noticeState: string; children: ReactNode };
type Anchor = { scroller: Element; card: Element; top: number };

// Capture just before React applies a new page of data, never at the start of a
// request: the user can keep scrolling while a slow refresh is in flight.
export class StableReservationCards extends Component<Props, {}, Anchor | null> {
  private list = createRef<HTMLDivElement>();

  getSnapshotBeforeUpdate(prev: Props): Anchor | null {
    const list = this.list.current;
    if (!list || prev.queryKey !== this.props.queryKey || (prev.rows === this.props.rows && prev.labels === this.props.labels && prev.noticeState === this.props.noticeState)) return null;
    let scroller = list.parentElement;
    while (scroller && scroller !== document.scrollingElement &&
      !(/^(auto|scroll|overlay)$/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) {
      scroller = scroller.parentElement;
    }
    scroller ??= document.scrollingElement as HTMLElement | null;
    if (!scroller || scroller.scrollTop <= 0) return null;
    const root = scroller === document.scrollingElement;
    const top = root ? 0 : scroller.getBoundingClientRect().top + scroller.clientTop;
    if (list.getBoundingClientRect().top >= top) return null;
    const bottom = Math.min(window.innerHeight, root ? window.innerHeight : top + scroller.clientHeight);
    const remaining = new Set(this.props.rows.map(r => r.id));
    for (let i = 0; i < list.children.length; i++) {
      const card = list.children[i], rect = card.getBoundingClientRect();
      if (rect.top >= bottom) break;
      if (rect.bottom > top && remaining.has(prev.rows[i]?.id)) return { scroller, card, top: rect.top };
    }
    return null;
  }

  componentDidUpdate(_prev: Props, _state: {}, anchor: Anchor | null) {
    if (!anchor || !anchor.card.isConnected) return;
    // Browsers with native scroll anchoring may already have compensated.
    const delta = anchor.card.getBoundingClientRect().top - anchor.top;
    if (Math.abs(delta) > 1) anchor.scroller.scrollBy({ top: delta, behavior: "instant" });
  }

  render() { return <div ref={this.list} className="reservationCards">{this.props.children}</div>; }
}
