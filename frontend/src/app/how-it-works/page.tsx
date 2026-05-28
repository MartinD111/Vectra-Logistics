import { Truck, Package, Map, Bell, BarChart3, FileCheck, Zap, ShieldCheck } from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <div className="bg-slate-50 dark:bg-dark-bg min-h-screen pb-24">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-24 px-6 sm:px-12 lg:px-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <span className="inline-block bg-white/10 border border-white/20 text-primary-100 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">Platform Guide</span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 animate-slide-up">
            How VECTRA Works
          </h1>
          <p className="text-lg md:text-xl text-primary-100 mb-10 max-w-2xl mx-auto opacity-90 animate-slide-up leading-relaxed" style={{ animationDelay: '100ms' }}>
            VECTRA is an AI-powered freight marketplace that dynamically connects carriers with available truck space to shippers who need cost-effective LTL transport — in real time.
          </p>
          <div className="flex justify-center gap-10 flex-wrap">
            {[['94%', 'Average truck utilization'], ['&lt;3min', 'Average match time'], ['15%', 'Max allowed detour'], ['€0', 'Subscription required']].map(([val, label]) => (
              <div key={label} className="text-center">
                <div className="text-3xl font-black text-white" dangerouslySetInnerHTML={{ __html: val }} />
                <div className="text-xs text-primary-200 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-[-48px]">

        {/* For Carriers & Shippers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* For Carriers */}
          <div className="saas-card flex flex-col items-start gap-5 animate-fade-in group">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-2xl text-primary-600 dark:text-primary-300">
                <Truck size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">Za Prevoznike</h2>
                <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold uppercase tracking-wide">For Carriers</p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Vsak prazen kilometer pomeni izgubo. VECTRA vam omogoča, da monetizirate vsak kubični meter prostora v prikolici — brez klasičnega iskanja tovora po telefonu ali e-mailu. Enostavno objavite svojo razpoložljivo kapaciteto, naša platforma pa samodejno poišče ustrezen tovor vzdolž vaše poti.
            </p>
            <ol className="list-none space-y-4 w-full">
              {[
                ['1', 'Objavite razpoložljivo kapaciteto', 'Vnesite podatke o poti (izvorno in ciljno mesto), datum odhoda, razpoložljivo težo in volumen. Platforma shrani vašo kapaciteto in jo takoj primerja z obstoječimi povpraševanji.'],
                ['2', 'AI algoritem poišče ujemanja', 'Naš algoritem na osnovi Haversine formule izračuna vse poti nakladačev, ki se prekrivajo z vašo traso — z dovoljenim odklonom do 15%, kar pomeni max 10–20 minut dodatne vožnje.'],
                ['3', 'Pregledajte in potrdite match', 'Prejmete obvestilo o ujemanju z natančnim prikazom: koliko km je odklon, koliko zaslužite dodatno, in kakšen tovor boste prevzeli. Vi odločate — sprejemete ali zavrnete.'],
                ['4', 'Generirajte CMR / e-CMR in odpeljite', 'Po potrditvi ujemanja sistem samodejno pripravi transportni dokument (CMR ali e-CMR prek Transfollow). Voznik dobi WhatsApp sporočilo z naslovi in linkom do dokumenta.'],
              ].map(([num, title, desc]) => (
                <li key={num} className="flex gap-4">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-black">{num}</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* For Shippers */}
          <div className="saas-card flex flex-col items-start gap-5 animate-fade-in group" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-2xl text-blue-600 dark:text-blue-300">
                <Package size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">Za Pošiljatelje</h2>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wide">For Shippers</p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Zakaj plačevati za celoten tovornjak, ko pošiljate le delni tovor? VECTRA vam omogoča, da hitro in pregledno poiščete razpoložljivega prevoznika, ki gre v pravo smer — in plačate samo za prostor, ki ga dejansko využijete.
            </p>
            <ol className="list-none space-y-4 w-full">
              {[
                ['1', 'Objavite povpraševanje', 'Vnesite podatke o pošiljki: teža, volumen, število palet, vrsta tovora, naslov prevzema in dostave ter rok dostave. Sistem takoj začne iskati ujemanja.'],
                ['2', 'Pregledajte razpoložljive prevoznike', 'V realnem času prejmete seznam prevoznikov z ustrezno kapaciteto, ki gredo v vašo smer. Vidite ceno, oceno prevoznika in predviden čas dostave.'],
                ['3', 'Transparentna cena in pogoji', 'Ni skritih provizij. Cena je izračunana na osnovi razdalje, teže, volumna in tržnih cen. Vidite točno, za kaj plačujete.'],
                ['4', 'Potrdite in sledite pošiljki', 'Po potrditvi booking prevoznik prejme dokumente, vi pa imate dostop do statusa pošiljke ter možnost prenosa e-CMR ob zaključku transporta.'],
              ].map(([num, title, desc]) => (
                <li key={num} className="flex gap-4">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-black">{num}</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Tech Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="col-span-1 lg:col-span-2 saas-card animate-slide-up">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                <Map className="text-primary-500" size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Dinamično ujemanje tovora (AI Matching)</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              VECTRA uporablja lasten algoritem, ki temelji na Haversine formuli za izračun razdalj med geografskimi koordinatami. Sistem ne zahteva neposredne povezave med točko A in točko B — namesto tega dovoli tovornjaku, da se rahlo odkloni od primarne poti in prevzame tovor na vmesni točki.
            </p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
              Vsako ujemanje dobi <span className="font-bold text-slate-800 dark:text-white">match score (0–100)</span>, ki upošteva: odmik od poti (km), časovni dodatek (min), prihodek od tovora in razpoložljivo kapaciteto. Prevozniki vidijo samo ujemanja z match_score nad 70 — kar pomeni, da je vsakdo, ki se pojavi na njem, resnično primeren.
            </p>
            <div className="bg-slate-100 dark:bg-slate-700/60 p-5 rounded-xl border border-slate-200 dark:border-slate-600">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Primer ujemanja</p>
              <blockquote className="italic font-medium text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
                "Tovornjak gre iz Ljubljane v München. VECTRA zazna, da pošiljatelj v Salzburgu potrebuje dostavo 1.200 kg tovora v München. Odklon: +12 km, +11 minut. Match score: 88/100. Prevoznik zasluži dodatnih €145."
              </blockquote>
            </div>
          </div>

          <div className="col-span-1 saas-card animate-slide-up" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                <Bell className="text-amber-500" size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Smart Freight Alerts</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
              Prevozniki ne rabijo ročno pregledovati tržnice. VECTRA v ozadju neprekinjeno primerja vse objavljene kapacitete z novimi povpraševanji — 24/7.
            </p>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
              Ko se pojavi nova pošiljka, ki ustreza vaši trasi in match score preseže prag, sistem takoj sproži:
            </p>
            <ul className="space-y-2.5 mb-4">
              {[
                ['🟢', 'Real-time WebSocket obvestilo na dashboard'],
                ['📧', 'Email obvestilo (nastavljivo: instant / daily / weekly)'],
                ['💬', 'WhatsApp sporočilo vozniku z naslovi in PDF linkom'],
              ].map(([icon, text]) => (
                <li key={text} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>{icon}</span><span>{text}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sistem deluje brez prekinitev — tudi ko ste vi na cesti.</p>
          </div>
        </div>

        {/* Extra Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: FileCheck, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', title: 'e-CMR & Dokumenti', desc: 'Avtomatska generacija CMR in e-CMR dokumentov prek Transfollow API. Možnost ZIP prenosa večih dokumentov z filtri.' },
            { icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', title: 'Dashboard & Analytics', desc: 'Pregled aktivnih kapacitet, ujemanj, ocen in prihodkov na enem mestu. Ločen pogled za Carrier in Shipper.' },
            { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', title: 'Instant Booking', desc: 'Po potrditvi ujemanja se booking ustvari takoj — brez dolginegociacije. Transparentna cena in provizija.' },
            { icon: ShieldCheck, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', title: 'Verifikacija in varnost', desc: 'Vsak prevoznik je verificiran z registracijskimi dokumenti. GDPR-skladno upravljanje podatkov in šifriranje gesel.' },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="saas-card group">
              <div className={`inline-flex p-2.5 rounded-xl ${bg} mb-4`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white mb-2 group-hover:text-primary-600 transition-colors">{title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
