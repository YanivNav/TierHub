type AuthContext = "sign-in" | "sign-up" | "verify" | "oauth" | "profile";

const GENERIC = "Something went wrong. Please try again.";

function errorParts(err: unknown): { code: string; status?: number } {
  if (err && typeof err === "object") {
    const e = err as { code?: string; status?: number };
    return { code: (e.code ?? "").toUpperCase(), status: e.status };
  }
  return { code: "" };
}

/**
 * Maps a Better Auth error to a user-facing message keyed on its `code`.
 *
 * The guiding rule is to avoid account enumeration: on sign-in we never reveal
 * whether it was the email or the password that was wrong, nor whether the
 * account exists at all — every credential failure returns one neutral message.
 */
export function getAuthErrorMessage(err: unknown, context: AuthContext): string {
  const { code, status } = errorParts(err);

  if (status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  switch (context) {
    case "sign-in":
      switch (code) {
        case "EMAIL_NOT_VERIFIED":
          return "Please verify your email first — check your inbox for the link.";
        // Collapse every credential failure into one neutral message.
        default:
          return "Invalid email or password.";
      }

    case "sign-up":
      switch (code) {
        case "USER_ALREADY_EXISTS":
        case "USER_EMAIL_ALREADY_EXISTS":
          return "An account with this email already exists. Try signing in instead.";
        case "PASSWORD_TOO_SHORT":
          return "Password must be at least 8 characters.";
        case "PASSWORD_TOO_LONG":
          return "That password is too long. Please choose a shorter one.";
        default:
          return "Couldn't create your account. Please check your details and try again.";
      }

    case "verify":
      return "Couldn't verify that — the link may have expired. Request a new one.";

    case "oauth":
      return "Couldn't continue with that provider. Please try again.";

    case "profile":
      return "Couldn't update your profile. Please try again.";

    default:
      return GENERIC;
  }
}
