'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="center"><h1>UnoMesa</h1><p>No pudimos cargar esta página. / We could not load this page.</p><button onClick={reset}>Reintentar / Retry</button></main>}
