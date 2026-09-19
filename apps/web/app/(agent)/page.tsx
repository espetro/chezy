import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Mail,
  ShieldCheck,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Suspense } from "react";

import { listRentCandidates } from "@/lib/listings";

const events = [
  {
    icon: Shield,
    iconClass: "bg-cloud text-fog",
    title: "14 anuncios filtrados",
    detail: "Gràcia · Descartados por fianza desproporcionada",
    meta: "12m",
    metaClass: "text-fog",
  },
  {
    icon: CalendarDays,
    iconClass: "bg-ember/15 text-ember",
    title: "1 visita pre-agendada",
    detail: "Jueves 18:30 · C/ Verdi 42, 2º exterior",
    meta: "Confirmar",
    metaClass: "text-ember",
  },
  {
    icon: ClipboardCheck,
    iconClass: "bg-cloud text-obsidian",
    title: "Contrato analizado",
    detail: "0 cláusulas abusivas detectadas por la IA",
    meta: "1h",
    metaClass: "text-fog",
  },
];

export default function LandingPage() {
  return (
    <Suspense>
      <Landing />
    </Suspense>
  );
}

async function Landing() {
  const candidates = await listRentCandidates({});
  const hero = candidates.find((c) => c.coverUrl)?.coverUrl;

  return (
    <main className="flex flex-col px-4 py-6">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />
            <span className="font-medium text-ember text-xs uppercase tracking-wider">
              Agente 24/7 Verificado
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cloud bg-snow px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-fog" />
            <span className="font-medium text-iron text-xs">
              0 spam, 100% automático
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="font-bold text-4xl text-obsidian leading-tight tracking-tight">
            Tu agente autónomo de alquiler.
          </h1>
          <p className="text-base text-steel leading-relaxed">
            Conoce tu{" "}
            <span className="font-medium text-obsidian">Casilla</span>: el buzón
            inteligente donde Chezy negocia, filtra cláusulas abusivas y
            coordina visitas presenciales sin que recibas una sola llamada
            comercial.
          </p>
        </div>

        <div className="flex w-full flex-col gap-4 rounded-[36px] border border-cloud bg-snow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-obsidian text-snow">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-obsidian text-sm">
                    Casilla Chezy
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-ember" />
                </div>
                <p className="text-fog text-xs">Sincronizado ahora</p>
              </div>
            </div>
            <span className="rounded-full bg-paper px-2.5 py-1 text-fog text-xs">
              En directo
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <div
                className="flex items-start gap-3 rounded-xl bg-paper p-3"
                key={event.title}
              >
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${event.iconClass}`}
                >
                  <event.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate font-medium text-obsidian text-sm">
                      {event.title}
                    </p>
                    <span
                      className={`shrink-0 text-xs ${event.metaClass}`}
                    >
                      {event.meta}
                    </span>
                  </div>
                  <p className="truncate text-steel text-xs">{event.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 text-steel">
            <span className="flex items-center gap-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ahorro estimado hoy: 4h 20m</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-[28px] border border-cloud bg-snow p-4">
            <TrendingUp className="h-5 w-5 text-ember" />
            <p className="font-bold text-2xl text-obsidian">10.000+</p>
            <p className="text-steel text-xs">
              Pisos auditados en tiempo real
            </p>
          </div>
          <div className="flex flex-col gap-1 rounded-[28px] border border-cloud bg-snow p-4">
            <Zap className="h-5 w-5 text-obsidian" />
            <p className="font-bold text-2xl text-obsidian">3.4x</p>
            <p className="text-steel text-xs">Más rápido en firmar contrato</p>
          </div>
        </div>

        <div className="relative h-44 w-full overflow-hidden rounded-[32px]">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Interior de un piso verificado por Chezy en Barcelona"
              className="h-full w-full object-cover"
              src={hero}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-cloud to-mist" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/60 via-transparent to-transparent" />
          <div className="absolute right-4 bottom-3 left-4 flex items-center justify-between text-snow">
            <span className="text-xs">
              Auditorías activas en Barcelona y Madrid
            </span>
            <span className="rounded-full bg-snow/20 px-2 py-0.5 text-xs backdrop-blur-sm">
              Mercado libre
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4 rounded-[36px] border border-cloud bg-snow p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-lg text-obsidian">
              Crea tu Casilla de búsqueda
            </h2>
            <p className="text-steel text-sm">
              El agente comenzará a rastrear portales y propietarios directos de
              inmediato.
            </p>
          </div>
          <form action="/onboarding/preferences" className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="absolute top-3.5 left-3.5 h-5 w-5 text-fog" />
              <input
                className="h-12 w-full rounded-[14px] bg-paper pr-4 pl-11 text-obsidian transition-colors placeholder:text-ash focus:bg-snow focus:outline-none focus:ring-1 focus:ring-obsidian"
                name="barrio"
                placeholder="tu@email.com o barrio preferido"
                type="text"
              />
            </div>
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-obsidian font-medium text-sm text-snow transition-all active:bg-slate"
              type="submit"
            >
              <span>Activar mi Agente</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3 rounded-[28px] border border-cloud bg-snow p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember/10 text-ember">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-obsidian text-sm">
              Garantía Chezy Cero Sorpresas
            </p>
            <p className="text-steel text-xs">
              Sin comisiones ocultas, sin honorarios de agencia duplicados y
              cancelación instantánea.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-4 text-fog">
          <CalendarCheck className="h-3.5 w-3.5" />
          <span className="text-xs">Chezy · agente de alquiler</span>
        </div>
      </div>
    </main>
  );
}
