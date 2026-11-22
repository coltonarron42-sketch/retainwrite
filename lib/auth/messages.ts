/** Map Supabase Auth errors into short, user-facing copy. */
export function formatAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("email not confirmed") ||
    lower.includes("confirm your email") ||
    lower.includes("email_not_confirmed")
  ) {
    return "Confirm your email before signing in. Check your inbox for the verification link.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password. Use Forgot password to set a new one.";
  }

  if (lower.includes("user already registered")) {
    return "An account with that email already exists. Try logging in.";
  }

  const wait = lower.match(/after (\d+) seconds?/);
  if (lower.includes("security purposes") && wait) {
    return `For security, wait ${wait[1]} seconds before requesting another link.`;
  }
  if (lower.includes("security purposes")) {
    return "Please wait a minute before requesting another link.";
  }
  if (lower.includes("email rate limit") || lower.includes("over_email_send_rate_limit")) {
    return "We've sent too many emails in the last hour. Try again in a little while.";
  }
  if (lower.includes("rate limit")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (lower.includes("error sending") && lower.includes("email")) {
    return "We couldn't send the email just now. Try again in a minute.";
  }

  if (lower.includes("should be different from the old password")) {
    return "Pick a password different from your old one.";
  }

  if (lower.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }

  if (lower.includes("signup is disabled")) {
    return "New signups are disabled for this project. Continue in demo mode instead.";
  }

  return message || "Something went wrong. Try again or continue in demo mode.";
}
