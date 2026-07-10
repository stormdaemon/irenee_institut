const annualPassCheckoutHref = "/formations?checkout=annual-pass";

export function courseCatalogAccess(slug: string, isStaff: boolean) {
  if (isStaff) {
    return {
      href: `/cours/${encodeURIComponent(slug)}`,
      label: "Lire le cours",
    };
  }

  return {
    href: annualPassCheckoutHref,
    label: "Accéder avec le pass annuel",
  };
}
