const manuscripts = { src: "/images/apostolos/manuscrits.png", alt: "Manuscrit enluminé et instruments de lecture dans un scriptorium" };
const tradition = { src: "/images/apostolos/tradition.png", alt: "Vitraux, sculpture et architecture d’une église romane" };
const reason = { src: "/images/apostolos/raison.png", alt: "Globe céleste, sphère armillaire et livre ouverts sur une table d’étude" };
export function courseArtwork(slug: string) {
  if (/histoire|protestantisme|dialogue/.test(slug)) return tradition;
  if (/science|philosophie|objections|morale/.test(slug)) return reason;
  return manuscripts;
}
