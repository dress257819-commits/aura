import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ArrowUpRight, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiPost, ApiError } from "@/lib/api";
import { authenticateLocalUser, createLocalUser, persistLocalSession } from "@/lib/auth";
import { beginSession } from "@/lib/session";
import type { MeProfile } from "@/lib/types";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ProfileAvatar } from "@/components/shared/ProfileAvatar";
import { DEMO_PROFILE_BUNDLE } from "@/lib/demo";
import { useMe } from "@/lib/hooks";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me, isLoading: isMeLoading } = useMe();
  const { profile, links } = DEMO_PROFILE_BUNDLE;
  const [activeTab, setActiveTab] = useState("signin");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");

  useEffect(() => {
    if (!isMeLoading && me) navigate("/dashboard", { replace: true });
  }, [isMeLoading, me, navigate]);

  useEffect(() => {
    const googleStatus = new URLSearchParams(location.search).get("google");
    if (!googleStatus) return;

    if (googleStatus === "success") {
      beginSession();
      toast.success("Signed in with Google");
      navigate("/dashboard", { replace: true });
      return;
    }

    const messages: Record<string, string> = {
      not_configured: "Google sign-in isn’t configured yet",
      cancelled: "Google sign-in was cancelled",
      invalid_state: "Google sign-in expired. Please try again",
      unverified_email: "Google couldn’t verify your email address",
      account_conflict: "This account is linked to a different Google account",
      failed: "Google sign-in failed. Please try again",
    };
    toast.error(messages[googleStatus] ?? "Google sign-in failed. Please try again");
    navigate("/auth", { replace: true });
  }, [location.search, navigate]);

  const login = useMutation({
    mutationFn: async () => {
      try {
        return await apiPost<MeProfile>("/auth/login", { email: loginEmail, password: loginPassword });
      } catch (err) {
        const localUser = authenticateLocalUser(loginEmail, loginPassword);
        if (localUser) {
          persistLocalSession(localUser);
          return localUser;
        }
        throw err;
      }
    },
    onSuccess: () => {
      beginSession();
      navigate("/dashboard");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.detail : "Sign in failed"),
  });

  const signup = useMutation({
    mutationFn: async () => {
      try {
        return await apiPost<MeProfile>("/auth/signup", {
          email: signupEmail,
          password: signupPassword,
          name: signupName,
          username: signupUsername,
        });
      } catch (err) {
        const localUser = createLocalUser({
          email: signupEmail,
          password: signupPassword,
          name: signupName,
          username: signupUsername,
        });
        if (localUser) {
          toast.success("Welcome to AURA — your profile is live");
          return localUser;
        }
        throw err;
      }
    },
    onSuccess: () => {
      beginSession();
      toast.success("Welcome to AURA — your profile is live");
      navigate("/dashboard");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.detail : "Signup failed"),
  });

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      {/* brand panel */}
      <div
        className="relative hidden min-h-svh flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14"
        style={{
          background:
            "radial-gradient(ellipse 75% 55% at 82% 8%, rgba(211, 187, 130, 0.12), transparent 70%), radial-gradient(ellipse 65% 55% at 12% 94%, rgba(123, 99, 53, 0.18), transparent 70%), #11141b",
        }}
      >
        <Link to="/" className="relative flex items-center gap-2" data-testid="auth-logo-link">
          <span className="grid size-8 place-items-center rounded-full bg-[#d3bb82] text-sm font-bold text-[#211b10]">
            A
          </span>
          <span className="font-heading text-xl font-bold tracking-tight">AURA</span>
        </Link>
        <div className="relative mx-auto w-full max-w-md">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d3bb82]">Your creator home</p>
          <h2 className="max-w-sm font-heading text-4xl font-bold leading-[1.08] tracking-tight xl:text-[3.25rem]">
            Your links.<br />One <span className="text-[#d3bb82]">profile.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
            Add your social links and work to one page. Share one link to your profile.
          </p>
          <article className="mt-8 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#191e28]/95 shadow-2xl shadow-black/30">
            <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-4 py-3">
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-2 rounded-full bg-rose-400/80" />
                <span className="size-2 rounded-full bg-amber-400/80" />
                <span className="size-2 rounded-full bg-emerald-400/80" />
              </span>
              <span className="min-w-0 flex-1 truncate rounded-md bg-black/15 px-3 py-1.5 text-center font-mono text-[10px] text-white/55">
                aura.page/{profile.username}
              </span>
              <span className="font-mono text-[9px] tracking-[0.16em] text-white/40">AURA / PROFILE</span>
            </div>
            <div className="premium-profile-cover relative h-28 overflow-hidden">
              <div className="premium-profile-cover-wash absolute inset-0" aria-hidden />
              <div className="absolute -right-8 -top-16 size-44 rounded-full border border-white/10" aria-hidden />
              <div className="absolute -right-1 top-2 size-28 rounded-full border border-white/10" aria-hidden />
              <div className="absolute bottom-3 left-5 flex items-end gap-3">
                <ProfileAvatar
                  src={profile.avatar_url}
                  name={profile.name}
                  className={`size-14 rounded-xl border-[3px] border-[#191e28] shadow-lg ${profile.avatar_url ? "object-cover" : "object-contain"}`}
                />
                <div className="pb-1">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/65">AURA creator</p>
                  <p className="mt-0.5 text-[11px] font-medium text-white">@{profile.username}</p>
                </div>
              </div>
            </div>
            <div className="px-5 pb-4 pt-3.5">
              <p className="font-heading text-base font-bold tracking-tight">{profile.name}</p>
              <p className="mt-1 line-clamp-1 text-[11px] text-white/55">{profile.bio}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.interests.slice(0, 3).map((interest) => (
                  <span key={interest} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[9px] capitalize text-white/60">
                    {interest}
                  </span>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {links.slice(0, 2).map((link) => (
                  <div key={link.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/[0.07] bg-black/10 px-2.5 py-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#d3bb82]/10 text-[#d3bb82]">
                      <Link2 className="size-3" />
                    </span>
                    <span className="truncate text-[10px] font-medium text-white/75">{link.title}</span>
                    <ArrowUpRight className="ml-auto size-3 shrink-0 text-white/35" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-2.5">
              <span className="font-mono text-[8px] tracking-[0.2em] text-white/35">A LITTLE MORE YOU, EVERYWHERE</span>
              <span className="flex items-center gap-1 text-[9px] font-semibold text-[#d3bb82]">
                Explore profile <ArrowRight className="size-3" />
              </span>
            </div>
          </article>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} AURA</p>
      </div>

      {/* form panel */}
      <div className="relative flex min-h-svh flex-col">
        <div className="flex items-center justify-between p-4 sm:px-7 sm:py-5">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            data-testid="auth-back-link"
          >
            <ArrowLeft className="size-4" />
            <span>Back home</span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12 sm:px-8">
          <div className="mb-7">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">AURA STUDIO</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl" data-testid="auth-heading">
              {activeTab === "signup" ? "Create your space" : "Welcome back"}
              <span className="text-primary">.</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {activeTab === "signup"
                ? "Create your page and claim a username in 30 seconds."
                : "Sign in to your studio and pick up where you left off."}
            </p>
          </div>

          <div className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-[0_24px_70px_-38px_rgba(27,25,38,0.28)] backdrop-blur-xl sm:p-7">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full cursor-pointer rounded-xl bg-background/70 font-medium"
              onClick={() => window.location.assign("/api/auth/google/start")}
              data-testid="google-auth-button"
            >
              <img src="/google-g.svg" alt="" className="size-5" aria-hidden="true" />
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">or with email</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(String(value))}>
              <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/80 p-1" data-testid="auth-tabs">
                <TabsTrigger value="signin" className="rounded-lg text-sm data-[active]:bg-background data-[active]:shadow-sm" data-testid="auth-tab-signin">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg text-sm data-[active]:bg-background data-[active]:shadow-sm" data-testid="auth-tab-signup">
                  Create account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6 space-y-5">
                <div className="space-y-2.5">
                  <Label htmlFor="login-email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-11 rounded-xl border-border/80 bg-background/70 px-3.5"
                    data-testid="login-email-input"
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 rounded-xl border-border/80 bg-background/70 px-3.5"
                    data-testid="login-password-input"
                  />
                </div>
                <Button
                  className="h-12 w-full rounded-lg bg-[#d3bb82] text-sm font-bold text-[#211b10] shadow-none transition-colors hover:bg-[#dfca98] disabled:bg-[#aa9668] disabled:text-[#211b10] disabled:opacity-100"
                  disabled={!loginEmail.trim() || !loginPassword || login.isPending}
                  onClick={() => login.mutate()}
                  data-testid="login-submit-button"
                >
                  {login.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-sm font-medium">Display name</Label>
                <Input
                  id="signup-name"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Your name"
                  className="h-11 rounded-xl border-border/80 bg-background/70 px-3.5"
                  data-testid="signup-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-username" className="text-sm font-medium">Username</Label>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-xl border border-border/70 bg-muted/60 px-3 py-3 font-mono text-xs text-muted-foreground">aura.app/u/</span>
                  <Input
                    id="signup-username"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value.toLowerCase())}
                    placeholder="yourname"
                    className="h-11 flex-1 rounded-xl border-border/80 bg-background/70 px-3.5"
                    data-testid="signup-username-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-sm font-medium">Email address</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-xl border-border/80 bg-background/70 px-3.5"
                  data-testid="signup-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="h-11 rounded-xl border-border/80 bg-background/70 px-3.5"
                  data-testid="signup-password-input"
                />
              </div>
                <Button
                  className="h-12 w-full rounded-lg bg-[#d3bb82] text-sm font-bold text-[#211b10] shadow-none transition-colors hover:bg-[#dfca98] disabled:bg-[#aa9668] disabled:text-[#211b10] disabled:opacity-100"
                  disabled={
                    !signupEmail.trim() || signupPassword.length < 8 || !signupUsername.trim() || signup.isPending
                  }
                  onClick={() => signup.mutate()}
                  data-testid="signup-submit-button"
                >
                  {signup.isPending ? "Creating…" : "Create my AURA page"}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            By continuing, you agree to keep your little corner of the internet kind.
          </p>
        </div>
      </div>
    </div>
  );
}
