import { Link } from "react-router-dom";
import {
  ArrowRight, Inbox, Link2, MessageCircle, MessagesSquare, Palette, UserRound, Wand2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { DEMO_PROFILE_BUNDLE } from "@/lib/demo";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: UserRound,
    title: "A profile that feels like you",
    body: "Introduce yourself with a photo, short bio, and the details you want people to know.",
    testid: "feature-profile",
  },
  {
    icon: Link2,
    title: "Links and work",
    body: "Show your social accounts, portfolio, and important links on one profile.",
    testid: "feature-links",
  },
  {
    icon: Inbox,
    title: "Messages and questions",
    body: "Receive anonymous notes in your inbox, then decide how and whether to respond.",
    testid: "feature-messages",
  },
  {
    icon: MessagesSquare,
    title: "A public Q&A wall",
    body: "Answer selected questions on your profile while keeping the sender anonymous.",
    testid: "feature-qa",
  },
  {
    icon: Wand2,
    title: "Share messages as stories",
    body: "Turn a message into a story-sized image you can save and share on social media.",
    testid: "feature-story",
  },
  {
    icon: Palette,
    title: "Make it your own",
    body: "Choose your page’s colors and fonts, and preview the design as you edit.",
    testid: "feature-customize",
  },
  {
    icon: MessageCircle,
    title: "Polls and daily questions",
    body: "Ask a question or run a poll to start conversations with visitors.",
    testid: "feature-polls",
  },
];

const THEME_SWATCHES = [
  { name: "Midnight Aurora", css: "linear-gradient(135deg,#1B2140,#6366F1)" },
  { name: "AURA Editorial", css: "linear-gradient(135deg,#F3EEE8,#947442)" },
  { name: "Cyber Tokyo", css: "linear-gradient(135deg,#2A0A3D,#EC4899)" },
  { name: "Clean Minimal", css: "linear-gradient(135deg,#F8FAFC,#E2E8F0)" },
  { name: "Matcha Warmth", css: "linear-gradient(135deg,#F4F1E8,#2F855A)" },
  { name: "Neo-Brutalist", css: "linear-gradient(135deg,#FDF0D5,#FFE066)" },
  { name: "Luxe Noir", css: "linear-gradient(135deg,#0C0A06,#D4AF37)" },
];

export default function Landing() {
  const bundle = DEMO_PROFILE_BUNDLE;
  const { profile, links } = bundle;

  return (
    <div className="premium-shell min-h-svh bg-background text-foreground">
      <Navbar />

      <section className="relative overflow-hidden border-b">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <h1 className="premium-title mt-7 max-w-3xl">
              <span className="block">Your links.</span>
              <span className="block">One <span className="premium-title-accent">profile.</span></span>
            </h1>
            <p className="premium-copy mt-7">
              Add your social links and work to one page. Let visitors message you, ask questions, and join polls. Share one link to your profile.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className={cn(buttonVariants({ size: "lg" }), "premium-link")}
                data-testid="hero-cta-button"
              >
                Create your profile <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/explore"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "premium-link-ghost")}
                data-testid="hero-demo-link"
              >
                See creator profiles
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[500px] lg:ml-auto">
            <div className="premium-preview-glow absolute -inset-8 rounded-full blur-3xl" aria-hidden />
            <article
              className="premium-profile-preview relative overflow-hidden rounded-[1.75rem] border border-border/80 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur-xl"
              data-testid="profile-preview-card"
              aria-label="Example AURA creator profile"
            >
              <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
                <div className="flex gap-1.5" aria-hidden>
                  <span className="size-2 rounded-full bg-rose-400/80" />
                  <span className="size-2 rounded-full bg-amber-400/80" />
                  <span className="size-2 rounded-full bg-emerald-400/80" />
                </div>
                <span className="min-w-0 flex-1 truncate rounded-md bg-muted/70 px-3 py-1.5 text-center font-mono text-[11px] text-muted-foreground">
                  aura.page/{profile.username}
                </span>
                <span className="premium-kicker hidden text-[9px] sm:block">AURA / PROFILE</span>
              </div>

              <div className="premium-profile-cover relative h-36 overflow-hidden sm:h-44">
                <div className="premium-profile-cover-wash absolute inset-0" aria-hidden />
                <div className="absolute -right-10 -top-20 size-56 rounded-full border border-white/10" aria-hidden />
                <div className="absolute -right-1 top-2 size-36 rounded-full border border-white/10" aria-hidden />
                <div className="absolute bottom-4 left-6 flex items-end gap-4 sm:left-8">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="size-[4.5rem] rounded-2xl border-4 border-card object-cover shadow-xl"
                    />
                  ) : (
                    <span className="premium-profile-avatar grid size-[4.5rem] place-items-center rounded-2xl border-4 border-card font-heading text-2xl font-bold text-white shadow-xl">
                      {profile.name.charAt(0)}
                    </span>
                  )}
                  <div className="pb-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/65">AURA creator</p>
                    <p className="mt-1 text-xs font-medium text-white">@{profile.username}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-5 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-2xl font-bold tracking-tight">{profile.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{profile.bio}</p>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                    The creator edit
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {profile.interests.slice(0, 3).map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs capitalize text-muted-foreground"
                    >
                      {interest}
                    </span>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {links.slice(0, 2).map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/50 px-3 py-3"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Link2 className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{link.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {link.description}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
                  <span className="premium-kicker text-[9px]">A little more you, everywhere</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    Explore profile <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* platform marquee */}
      <section className="border-y bg-card/40 py-5" aria-hidden>
        <div className="flex overflow-hidden">
          <div className="marquee-track flex shrink-0 items-center gap-10 pr-10 font-mono text-sm uppercase tracking-widest text-muted-foreground">
            {[...Array(2)].map((_, dup) => (
              <span key={dup} className="flex items-center gap-10">
                {["instagram", "tiktok", "youtube", "spotify", "discord", "linkedin", "x", "github", "twitch", "telegram", "whatsapp", "snapchat"].map(
                  (p) => (
                    <span key={p}>{p}</span>
                  )
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="premium-kicker">ONE PAGE, TWO SIDES OF THE CONVERSATION</p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Your online home, made more useful.
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            AURA brings your introduction, work, and ways to connect together in one profile.
            Share a single link, then choose how much of the conversation you want to make public.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="link-card rounded-2xl border bg-card p-6 sm:p-8">
            <p className="premium-kicker text-primary">FOR YOU</p>
            <h3 className="mt-3 font-heading text-xl font-bold tracking-tight">Build a page that is yours.</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Add your bio, social links, and work. Choose the colors and fonts, set a daily
              question or poll, and manage incoming messages from your dashboard.
            </p>
          </article>
          <article className="link-card rounded-2xl border bg-card p-6 sm:p-8">
            <p className="premium-kicker text-primary">FOR YOUR VISITORS</p>
            <h3 className="mt-3 font-heading text-xl font-bold tracking-tight">Make it easy to connect.</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Visitors can explore your links, send an anonymous message, answer a poll, or
              read the questions you have chosen to answer.
            </p>
          </article>
        </div>
      </section>

      {/* features bento */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you can do with AURA.
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          From your first introduction to ongoing conversations, the tools to shape your page
          and connect with visitors are all in one place.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="link-card rounded-2xl border bg-card p-6"
              data-testid={feature.testid}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary">
                <feature.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-heading text-lg font-bold tracking-tight">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* themes strip */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:pb-24">
        <div className="rounded-3xl border bg-card p-8 sm:p-12">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                Choose how your page looks.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick a design, then adjust the colors and fonts to suit you.
              </p>
            </div>
            <Link
              to="/dashboard/customize"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              data-testid="themes-customize-link"
            >
              Customize your page <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {THEME_SWATCHES.map((t) => (
              <div key={t.name} className="group">
                <div
                  className="aspect-[4/3] rounded-2xl border border-white/10 shadow-lg transition-transform duration-300 group-hover:-translate-y-1"
                  style={{ background: t.css }}
                />
                <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="premium-cta relative overflow-hidden rounded-[1.75rem] border border-border/80 bg-card px-7 py-9 shadow-sm sm:px-10 sm:py-11 lg:px-14">
          <div className="premium-cta-glow pointer-events-none absolute -right-16 -top-36 size-96 rounded-full blur-3xl" aria-hidden />
          <div className="premium-cta-accent absolute inset-x-10 top-0 h-px" aria-hidden />
          <div className="relative flex flex-col items-start justify-between gap-7 sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <p className="premium-kicker inline-flex items-center gap-2 text-primary">
                GET STARTED
              </p>
              <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Ready to create your profile?
              </h2>
              <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
                Add your links and work, then share your profile with one link.
              </p>
            </div>
            <Link
              to="/auth"
              className={cn(buttonVariants({ size: "lg" }), "premium-link shrink-0")}
              data-testid="landing-final-cta"
            >
              Create your profile <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
