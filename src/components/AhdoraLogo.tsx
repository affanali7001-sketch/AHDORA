import logoUrl from '../assets/ahdora-logo.svg';

/**
 * The AHDORA mark: mehrab arch (Namaz), peach crescent (Islam / Ramzan)
 * and an open book (Quran + Padhai) on a teal-gradient tile, with a gold
 * underline. Rendered as an <img> so the SVG's own gradients stay
 * isolated per instance. Sizes from the design tokens: hero 168,
 * header 40, final CTA 68.
 */
export default function AhdoraLogo({
  size = 40,
  alt = 'AHDORA logo',
  className,
}: {
  size?: number;
  alt?: string;
  className?: string;
}) {
  return <img src={logoUrl} alt={alt} width={size} height={size} className={className} />;
}
