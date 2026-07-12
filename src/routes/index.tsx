import { createFileRoute, Link } from "@tanstack/react-router";
import { FileCheck, Shield, Clock, MapPin, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-navy-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold-gradient shadow-gold">
              <FileCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none">Sai Enterprise</p>
              <p className="text-xs text-gold">Kalyan, Maharashtra</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/auth">
              <Button variant="ghost" className="text-primary-foreground hover:bg-white/10">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-navy-gradient text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gold">
              Trusted Registration Partner
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
              Track your agreement <span className="text-gold">registration</span> with confidence
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-primary-foreground/80">
              Sai Enterprise handles your rent agreement, sale deed, and document registration
              end-to-end. Sign in with your mobile number and application number to see live
              progress, appointments, and download your registered agreement.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="bg-gold-gradient text-gold-foreground shadow-gold hover:opacity-90">
                  Track my application
                </Button>
              </Link>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noreferrer"
                className="inline-flex"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 bg-white/5 text-primary-foreground hover:bg-white/10"
                >
                  <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp us
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Shield,
              title: "Secure by design",
              body: "Your data is protected. You can only see your own application — nobody else's.",
            },
            {
              icon: Clock,
              title: "Live progress tracking",
              body: "See every step: documents received, draft ready, appointment, biometric, registration.",
            },
            {
              icon: FileCheck,
              title: "Download final agreement",
              body: "Once registered, download your signed agreement PDF anytime from your phone.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-card p-6 shadow-elegant transition hover:-translate-y-1"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gold-gradient text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact strip */}
      <section className="border-t bg-secondary">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-gold" />
            <div>
              <p className="font-semibold">Visit our office</p>
              <p className="text-sm text-muted-foreground">Kalyan, Thane District, Maharashtra</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-5 w-5 text-gold" />
            <div>
              <p className="font-semibold">Call us</p>
              <a href="tel:+919876543210" className="text-sm text-muted-foreground hover:underline">
                +91 98765 43210
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-5 w-5 text-gold" />
            <div>
              <p className="font-semibold">WhatsApp support</p>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted-foreground hover:underline"
              >
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-navy-gradient py-8 text-center text-sm text-primary-foreground/70">
        © {new Date().getFullYear()} Sai Enterprise. Agreement & Document Registration Services.
      </footer>
    </div>
  );
}
