import { signOutAction } from "@/app/auth/actions";

/**
 * Server-side sign out: clears the auth cookies and the demo-session cookie,
 * then goes to the home page. Demo sessions show it as "Exit demo".
 */
export function LogOutButton({
  className,
  label = "Log out",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
