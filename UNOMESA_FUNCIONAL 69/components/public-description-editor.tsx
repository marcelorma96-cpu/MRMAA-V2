'use client';
import s from './restaurant-public.module.css';

export function PublicDescriptionEditor({original,value,maxLength,en,working,onChange,onGenerate}:{
  original:string;value:string;maxLength:number;en:boolean;working:boolean;
  onChange:(value:string)=>void;onGenerate:()=>void;
}){
  const t=(es:string,english:string)=>en?english:es;
  return <details className={s.translationEditor}>
    <summary>{t('Descripción en inglés','English description')} · {value.trim()?t('Agregada','Added'):t('Pendiente','Not added')}</summary>
    <div className={s.translationFields}>
      <label>{t('Versión en inglés','English version')}
        <textarea lang="en" value={value} maxLength={maxLength} rows={4}
          placeholder={t('Escriba la traducción o use Generar traducción.','Write the translation or use Generate translation.')}
          onChange={e=>onChange(e.target.value)}/>
      </label>
      <button type="button" disabled={working||!original.trim()||!!value.trim()} onClick={onGenerate}>
        {working?t('Traduciendo…','Translating…'):t('Generar traducción','Generate translation')}
      </button>
      <small className={s.muted}>{t('English mostrará esta versión después de guardar. Si está vacía, se verá el texto original. Revísela si cambia la descripción original.','English will show this version after saving. If blank, the original text is shown. Review it whenever you change the original description.')}</small>
      <small className={s.muted}>{t('Generar envía solo esta descripción a OpenAI y utiliza 1 de las 50 consultas mensuales compartidas con el asistente. Revise la traducción antes de guardar. Para generar otra, vacíe primero el campo en inglés.','Generate sends only this description to OpenAI and uses 1 of the 50 monthly requests shared with the assistant. Review the translation before saving. To generate another, first clear the English field.')}</small>
    </div>
  </details>;
}
