export type AuthErrorCopy = {
  title: string;
  description: string;
  field?: "email" | "password" | "form";
};

export function translateAuthError(message?: string | null, fallback = "Une erreur est survenue. Réessayez dans quelques instants."): AuthErrorCopy {
  const raw = (message || "").trim();
  const normalized = raw.toLowerCase();

  if (
    normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("user already") ||
    normalized.includes("email address already") ||
    normalized.includes("already exists") ||
    normalized.includes("deja utilise") ||
    normalized.includes("déjà utilis") ||
    normalized.includes("adresse est deja") ||
    normalized.includes("adresse est déjà")
  ) {
    return {
      title: "Adresse email déjà utilisée",
      description: "Un compte existe déjà avec cette adresse. Connectez-vous avec cet email, ou utilisez une autre adresse.",
      field: "email"
    };
  }

  if (normalized.includes("invalid email") || normalized.includes("email format")) {
    return {
      title: "Adresse email invalide",
      description: "Vérifiez l'adresse email saisie, puis réessayez.",
      field: "email"
    };
  }

  if (normalized.includes("missing email") || normalized.includes("email or phone")) {
    return {
      title: "Email manquant",
      description: "Renseignez votre adresse email avant de continuer.",
      field: "email"
    };
  }

  if (normalized.includes("password") && (normalized.includes("weak") || normalized.includes("short") || normalized.includes("6 characters"))) {
    return {
      title: "Mot de passe trop faible",
      description: "Utilisez au moins 8 caractères, avec idéalement une majuscule, une minuscule et un chiffre.",
      field: "password"
    };
  }

  if (normalized.includes("invalid login credentials") || normalized.includes("invalid credentials")) {
    return {
      title: "Connexion impossible",
      description: "L'email ou le mot de passe ne correspond pas. Vérifiez les informations saisies.",
      field: "form"
    };
  }

  if (normalized.includes("email not confirmed")) {
    return {
      title: "Email non confirmé",
      description: "Votre compte existe, mais l'adresse email doit encore être confirmée avant la connexion.",
      field: "form"
    };
  }

  if (normalized.includes("rate limit") || normalized.includes("too many") || normalized.includes("security purposes")) {
    return {
      title: "Trop de tentatives",
      description: "Patientez quelques minutes avant de réessayer. C'est une protection automatique contre les abus.",
      field: "form"
    };
  }

  if (normalized.includes("signup") && normalized.includes("disabled")) {
    return {
      title: "Inscription indisponible",
      description: "Les inscriptions sont temporairement fermées. Contactez l'équipe si le problème persiste.",
      field: "form"
    };
  }

  return {
    title: "Action impossible",
    description: raw || fallback,
    field: "form"
  };
}
