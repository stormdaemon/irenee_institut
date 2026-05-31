const privateAppPrefixes = [
  "/admin",
  "/cours",
  "/devoirs",
  "/espace-etudiant",
  "/parametres"
];

export function isPrivateAppPath(pathname: string) {
  return privateAppPrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
