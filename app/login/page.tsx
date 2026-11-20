import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-rw-paper">
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 pb-20 pt-28">
        <h1 className="font-display text-4xl text-rw-ink">Log in</h1>
        <p className="mt-2 text-sm text-rw-ink/60">
          Magic link and password auth arrive when Supabase is connected. For
          now, continue in demo mode.
        </p>
        <form className="mt-8 space-y-4" action="/app">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" variant="secondary">
            Continue to demo app
          </Button>
        </form>
        <p className="mt-6 text-sm text-rw-ink/60">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-rw-teal">
            Start free
          </Link>
        </p>
      </div>
    </main>
  );
}
