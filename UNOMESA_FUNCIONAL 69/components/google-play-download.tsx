import styles from './google-play-download.module.css';

// Public store listing for the same package used by Google Play billing.
export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.unomesa.android';

export function GooglePlayDownload({language, compact=false}:{language:'es'|'en';compact?:boolean}) {
 const en=language==='en';
 return <div className={compact?styles.compact:styles.banner} aria-label={en?'Download UnoMesa':'Descargar UnoMesa'}>
  <div className={styles.copy}>
   <strong>{en?'UnoMesa is now on Android':'UnoMesa ya está en Android'}</strong>
   {!compact&&<span>{en?'Your restaurant, on your phone or tablet.':'Su restaurante, también desde el teléfono o la tablet.'}</span>}
  </div>
  <a className={styles.badge} href={GOOGLE_PLAY_URL} aria-label={en?'Download UnoMesa on Google Play':'Descargar UnoMesa en Google Play'}>
   <img src={`/stores/google-play-${language}.png`} width={646} height={250} alt={en?'Get it on Google Play':'Disponible en Google Play'}/>
  </a>
 </div>;
}
