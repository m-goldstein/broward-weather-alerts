import { useLanguage } from '../LanguageContext';
export default function CoastalArt() {
  const { t } = useLanguage();
  return <div className="coastal-art broadwalk-art"><img src="/brand/broadwalk-wave.webp" alt={t("Brand illustration of a giant blue wave washing over the paved Hollywood Beach Broadwalk, beside palms and coastal buildings.")} width="1200" height="800" fetchPriority="high"/><span className="brand-art-caption">HOLLYWOOD BEACH BROADWALK</span></div>;
}
