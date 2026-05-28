import Link from "next/link";
import {
  ArrowRight,
  Globe,
  TrendingUp,
  ShieldCheck,
  Smartphone,
  Car,
  Map,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="bg-white dark:bg-dark-bg transition-colors">
      {/* Hero Section */}
      <section className="relative px-6 lg:px-8 py-24 sm:py-32 overflow-hidden border-b dark:border-dark-border">
        <div
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#86efac] to-[#15803d] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-6xl animate-slide-up">
            Monetize Unused Truck Capacity.
          </h1>
          <p
            className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto animate-slide-up"
            style={{ animationDelay: "100ms" }}
          >
            VECTRA is the intelligent digital marketplace for dynamic
            consolidation of expected LTL transports. Connect shippers with
            overlapping empty trailer space instantly.
          </p>
          <div
            className="mt-10 flex items-center justify-center gap-x-6 animate-fade-in"
            style={{ animationDelay: "200ms" }}
          >
            <Link
              href="/dashboard"
              className="rounded-full bg-primary-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition"
            >
              Get Started
            </Link>
            <Link
              href="/how-it-works"
              className="text-sm font-semibold leading-6 text-slate-900 dark:text-white flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition"
            >
              Learn how it works <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 sm:py-32 bg-slate-50 dark:bg-dark-card border-b dark:border-dark-border transition-colors">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-base font-semibold leading-7 text-primary-600 dark:text-primary-400 uppercase tracking-wide">
              Platform Advantages
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Logistics driven by algorithms
            </p>
          </div>

          <div className="mx-auto max-w-7xl grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="saas-card group">
              <Globe className="h-10 w-10 text-primary-500 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Dynamic Matching
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Connect shipments via existing routes instead of Point A to
                Point B direct matches. Our algorithm calculates detours under
                15% to keep capacities full.
              </p>
            </div>
            <div className="saas-card group">
              <TrendingUp className="h-10 w-10 text-primary-500 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Yield Optimization
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Price is calculated dynamically taking into account detours,
                volume, weight, and delivery urgency, ensuring fair payment for
                carriers.
              </p>
            </div>
            <div className="saas-card group">
              <ShieldCheck className="h-10 w-10 text-primary-500 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Automated Execution
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Every match seamlessly passes through real-time confirmations
                and generates standardized CMR documents instantly, mitigating
                delays.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming VECTRA Tools Section */}
      <section className="py-24 sm:py-32 bg-white dark:bg-dark-bg border-b dark:border-dark-border transition-colors">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              In Development
            </span>
            <h2 className="text-base font-semibold leading-7 text-primary-600 dark:text-primary-400 uppercase tracking-wide">
              Coming Soon
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Upcoming VECTRA Tools
            </p>
            <p className="mt-4 text-slate-600 dark:text-slate-400 text-base leading-relaxed">
              We are actively building the next generation of tools to put
              VECTRA in the hands of every driver and dispatcher — on any
              device, anywhere.
            </p>
          </div>

          <div className="mx-auto max-w-7xl grid grid-cols-1 gap-8 sm:grid-cols-3">
            {/* Card 1 — Driver Mobile App */}
            <div
              className="saas-card group animate-fade-in"
              style={{ animationDelay: "0ms" }}
            >
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 mb-6 group-hover:scale-110 transition-transform">
                <Smartphone className="h-7 w-7 text-primary-500 dark:text-primary-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Driver Mobile App
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-5">
                A dedicated mobile application for truck drivers to stay
                connected with every shipment assigned through VECTRA.
              </p>
              <ul className="space-y-2">
                {[
                  "Real-time shipment updates",
                  "Delivery confirmation",
                  "Location sharing",
                  "Job notifications",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary-100 dark:bg-primary-900/50">
                      <svg
                        className="h-2.5 w-2.5 text-primary-600 dark:text-primary-400"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2 6.5L4.5 9L10 3"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2 — Android Auto App */}
            <div
              className="saas-card group animate-fade-in"
              style={{ animationDelay: "100ms" }}
            >
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 mb-6 group-hover:scale-110 transition-transform">
                <Car className="h-7 w-7 text-primary-500 dark:text-primary-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Android Auto App
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-5">
                An in-vehicle interface for safe driver interaction with VECTRA,
                designed for use while on the road.
              </p>
              <ul className="space-y-2">
                {[
                  "Load opportunity notifications",
                  "Delivery confirmations",
                  "Voice-based commands",
                  "Route-based cargo suggestions",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary-100 dark:bg-primary-900/50">
                      <svg
                        className="h-2.5 w-2.5 text-primary-600 dark:text-primary-400"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2 6.5L4.5 9L10 3"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 3 — Truck-Focused Navigation Router */}
            <div
              className="saas-card group animate-fade-in"
              style={{ animationDelay: "200ms" }}
            >
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 mb-6 group-hover:scale-110 transition-transform">
                <Map className="h-7 w-7 text-primary-500 dark:text-primary-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Truck-Focused Navigation Router
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-5">
                Truck-optimized navigation that understands vehicle restrictions
                and keeps every driver on the safest, most efficient route.
              </p>
              <ul className="space-y-2">
                {[
                  "Avoid low bridges & weight-restricted roads",
                  "Avoid restricted city zones",
                  "Truck turning radius awareness",
                  "Truck parking suggestions",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary-100 dark:bg-primary-900/50">
                      <svg
                        className="h-2.5 w-2.5 text-primary-600 dark:text-primary-400"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2 6.5L4.5 9L10 3"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing / CTA */}
      <section className="py-24 sm:py-32 dark:bg-dark-bg transition-colors">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Transparent Commission Structure
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-400">
            Free to access and post shipments. Pay only when a match is
            successfully booked.
          </p>
          <div className="mt-16 flex flex-col sm:flex-row justify-center items-center gap-8 max-w-4xl mx-auto">
            <div className="saas-card flex-1 w-full text-center border-2 border-transparent hover:border-primary-100 dark:hover:border-primary-900/50">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Free User
              </h3>
              <div className="mt-4 flex items-baseline justify-center gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                  6%
                </span>
                <span className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-400">
                  per transport
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-2 italic">
                Minimum €25 fee. Includes ads.
              </p>
            </div>

            <div className="saas-card flex-1 w-full text-center ring-2 ring-primary-500 relative transform md:-translate-y-4 shadow-xl">
              <div className="absolute top-0 right-0 bg-primary-500 text-white px-4 py-1 rounded-bl-xl rounded-tr-xl text-xs font-bold uppercase">
                Recommended
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Subscriber
              </h3>
              <div className="mt-4 flex items-baseline justify-center gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                  3%
                </span>
                <span className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-400">
                  per transport
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-2 italic">
                Minimum €15 fee. Ad-free interface.
              </p>
            </div>
          </div>

          <div className="mt-16">
            <Link
              href="/billing"
              className="text-primary-600 dark:text-primary-400 font-bold hover:underline flex items-center justify-center gap-2 transition-transform hover:translate-x-1"
            >
              View Full Details <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
