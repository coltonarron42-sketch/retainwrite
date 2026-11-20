import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl text-rw-ink">Start free</h1>
        <p className="mt-2 text-sm text-rw-ink/60">
          First paper free. No card at signup. Must be 13+. Ages 13–17 need
          guardian confirmation once auth is live.
        </p>
        <form className="mt-8 space-y-4" action="/app">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <label className="flex items-start gap-2 text-sm text-rw-ink/70">
            <input type="checkbox" required className="mt-1" />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <Button type="submit" className="w-full" variant="secondary">
            Create demo account
          </Button>
        </form>
        <p className="mt-6 text-sm text-rw-ink/60">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-rw-teal">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
