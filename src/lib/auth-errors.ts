import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

type AuthContext = "sign-in" | "sign-up" | "verify" | "oauth" | "profile";

const GENERIC = "Something went wrong. Please try again.";

/**
 * Maps a Clerk error to a user-facing message keyed on its stable error `code`.
 *
 * The guiding rule is to avoid account enumeration: on sign-in we never reveal
 * whether it was the email or the password that was wrong, nor whether the
 * account exists at all - every credential failure returns one neutral message.
 */
export function getAuthErrorMessage(err: unknown, context: AuthContext): string {
  if (!isClerkAPIResponseError(err)) return GENERIC;

  const first = err.errors[0];
  const code = first?.code ?? "";

  // Rate limiting applies to every flow.
  if (code === "too_many_requests" || err.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  switch (context) {
    case "sign-in": {
      switch (code) {
        // Collapse every credential failure into one message so the response
        // is identical whether or not the email is registered.
        case "form_identifier_not_found":
        case "form_password_incorrect":
        case "form_param_format_invalid":
        case "form_param_nil":
        case "strategy_for_user_invalid":
          return "Invalid email or password.";
        case "session_exists":
          return "You're already signed in.";
        default:
          return "Invalid email or password.";
      }
    }

    case "sign-up": {
      switch (code) {
        // Email already in use. This is inherently observable on sign-up (you
        // can't create a duplicate), so we keep it actionable but nudge to login.
        case "form_identifier_exists":
          return "An account with this email already exists. Try signing in instead.";
        case "form_param_format_invalid":
          return "Please enter a valid email address.";
        case "form_password_pwned":
          return "This password has appeared in a data breach. Please choose a different one.";
        case "form_password_length_too_short":
        case "form_password_size_in_bytes_exceeded":
        case "form_password_validation_failed":
          return "Password must be at least 8 characters.";
        case "captcha_invalid":
        case "captcha_failed":
          return "Couldn't verify you're human. Please try again.";
        default:
          return "Couldn't create your account. Please check your details and try again.";
      }
    }

    case "verify": {
      switch (code) {
        case "form_code_incorrect":
        case "verification_failed":
          return "That code is incorrect. Please check and try again.";
        case "verification_expired":
          return "That code has expired. Request a new one.";
        case "verification_already_verified":
          return "This email is already verified. Try signing in.";
        default:
          return "Couldn't verify that code. Please try again.";
      }
    }

    case "oauth": {
      switch (code) {
        case "session_exists":
          return "You're already signed in.";
        default:
          return "Couldn't continue with that provider. Please try again.";
      }
    }

    case "profile": {
      switch (code) {
        case "form_param_format_invalid":
        case "image_type_not_allowed":
          return "That file type isn't supported. Try a PNG or JPG.";
        case "request_body_too_large":
          return "That image is too large. Please choose a smaller file.";
        default:
          return "Couldn't update your profile. Please try again.";
      }
    }
  }
}
