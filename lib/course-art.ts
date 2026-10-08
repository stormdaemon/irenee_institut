const manuscripts = { src: "/images/apostolos/vitrail/ecriture.webp", alt: "Vitrail bleu et or : une colombe au-dessus des Écritures ouvertes" };
const tradition = { src: "/images/apostolos/vitrail/apologetique.webp", alt: "Vitrail bleu et or : un penseur chrétien et une cathédrale" };
const reason = { src: "/images/apostolos/vitrail/philosophie.webp", alt: "Vitrail bleu et or : un philosophe au pied de colonnes antiques" };
export function courseArtwork(slug: string) {
  if (/histoire|protestantisme|dialogue|apologetique/.test(slug)) return tradition;
  if (/science|philosophie|objections|morale/.test(slug)) return reason;
  return manuscripts;
}
