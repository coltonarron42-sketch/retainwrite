import { signOutAction } from "@/app/auth/actions";

/** Server-side sign out: clears the auth cookies, then goes to the home page. */
export function LogOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className}>
        Log out
      </button>
    </form>
  );
}
