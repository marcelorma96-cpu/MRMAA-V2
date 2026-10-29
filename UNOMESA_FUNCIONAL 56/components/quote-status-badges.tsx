import {quoteDisplayStatus, type QuoteSummary} from '@/lib/quote-data';

/** One presentation for list cards, desktop rows and quote details. */
export function QuoteStatusBadges({quote,today,en=false}:{quote:QuoteSummary;today:string;en?:boolean}) {
  const display=quoteDisplayStatus(quote,today);
  const badge=(state:string,es:string,english:string)=><span className={`quoteState quoteState-${state}`}>{en?english:es}</span>;
  return <span className="quoteStateBadges" translate="no">
    {quote.status==='convertida'?<>{badge('converted','Convertida','Converted')}{badge('confirmed','Confirmada','Confirmed')}</>
      :quote.status==='confirmada'?badge('confirmed','Confirmada','Confirmed')
      :display==='Contactar'?badge('contact','Contactar','Follow up')
      :display==='No realizada'?badge('notHeld','No realizada','Not held')
      :quote.status==='pendiente'?badge('pending','Pendiente','Pending')
      :<span className="quoteState">{display}</span>}
  </span>;
}
