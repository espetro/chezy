"use client";

import type { SearchProfileInput } from "@chezy/contract";
import { MUST_HAVES, RED_LINES } from "@chezy/contract";
import {
  ArrowRight,
  BellRing,
  Bot,
  Briefcase,
  CalendarDays,
  Check,
  Minus,
  Navigation,
  Plus,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { eur } from "@/lib/format";
import { MUST_HAVE_LABELS, RED_LINE_LABELS } from "@/lib/labels";
import { DISTRICT_CHIPS } from "@/lib/neighbourhoods";

const COMMUTE_OPTIONS = [15, 25, 40] as const;
const M2_OPTIONS = [50, 60, 70, 90] as const;
const PRICE_MIN = 800;
const PRICE_MAX = 4000;
const PRICE_STEP = 50;

const MUST_HAVE_ICONS: Record<string, typeof Sun> = {
  exterior: Sun,
  balcony_or_terrace: Sun,
  elevator: Navigation,
  air_conditioning: Sun,
  furnished: Sun,
  pets_allowed: Sun,
  heating: Sun,
};

interface Props {
  readonly initial: SearchProfileInput;
  readonly initialCount: number;
}

export function PreferencesForm({ initial, initialCount }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<SearchProfileInput>(initial);
  const [count, setCount] = useState(initialCount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherValue, setOtherValue] = useState("");
  const countTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const update = (patch: Partial<SearchProfileInput>) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (countTimer.current) {
      clearTimeout(countTimer.current);
    }
    countTimer.current = setTimeout(() => {
      const params = new URLSearchParams();
      params.set("maxPriceEur", String(next.maxPriceEur));
      params.set("minRooms", String(next.minRooms));
      params.set("minM2", String(next.minM2));
      if (next.neighbourhoods.length > 0) {
        params.set("neighbourhoods", next.neighbourhoods.join(","));
      }
      fetch(`/api/profile/count?${params}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && typeof data.count === "number") {
            setCount(data.count);
          }
        })
        .catch(() => {});
    }, 300);
  };

  const toggleIn = (key: "neighbourhoods" | "mustHaves" | "redLines", value: string) => {
    const list = form[key] as string[];
    update({
      [key]: list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value],
    } as Partial<SearchProfileInput>);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push("/onboarding/verify");
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo guardar el perfil. Inténtalo de nuevo.");
        setSubmitting(false);
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setSubmitting(false);
    }
  };

  const addOther = () => {
    const value = otherValue.trim();
    if (value && !form.neighbourhoods.includes(value)) {
      update({ neighbourhoods: [...form.neighbourhoods, value] });
    }
    setOtherValue("");
    setOtherOpen(false);
  };

  const chip = (label: string, active: boolean, onClick: () => void, key?: string) => (
    <button
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all ${
        active ? "bg-obsidian text-snow" : "bg-paper text-steel"
      }`}
      key={key ?? label}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <Check className={`h-3.5 w-3.5 ${active ? "" : "opacity-0"}`} />
    </button>
  );

  return (
    <main className="flex w-full flex-col pb-32">
      <div className="flex w-full flex-col gap-2 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between text-steel">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ember" />
            <span className="text-obsidian text-xs uppercase tracking-wider">
              Paso 1 de 2
            </span>
          </div>
          <span className="text-fog text-xs">Parámetros de búsqueda</span>
        </div>
        <div className="flex h-1 w-full overflow-hidden rounded-full bg-cloud">
          <div className="h-full w-1/2 rounded-full bg-obsidian" />
        </div>
      </div>

      <div className="flex w-full flex-col gap-5 px-4 pt-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-obsidian text-snow">
              <Bot className="h-5 w-5" />
            </div>
            <span className="-right-0.5 -bottom-0.5 absolute flex h-3 w-3 items-center justify-center rounded-full bg-ember">
              <span className="h-1.5 w-1.5 rounded-full bg-snow" />
            </span>
          </div>
          <div className="flex max-w-[85%] flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-obsidian text-sm">Chezy AI</span>
              <span className="text-fog text-xs">Agente Personal</span>
            </div>
            <div className="flex flex-col gap-2 rounded-[24px] rounded-tl-sm border border-cloud bg-snow p-4">
              <p className="text-obsidian text-sm">
                ¡Hola! Para que filtre con precisión milimétrica entre miles de
                portales y agentes, define tus imprescindibles.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="rounded-full bg-paper px-2 py-0.5 text-fog text-xs">
                  Tiempo estimado: 1 min
                </span>
                <span className="h-1 w-1 rounded-full bg-mist" />
                <span className="font-medium text-ember text-xs">
                  Búsqueda 24/7 activa
                </span>
              </div>
            </div>
          </div>
        </div>

        <section className="flex flex-col gap-4 rounded-[32px] border border-cloud bg-snow p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-paper text-obsidian">
                <Navigation className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-base text-obsidian">
                1. Tu rutina &amp; Zona
              </h3>
            </div>
            <span className="rounded-full bg-ember/10 px-2.5 py-1 font-semibold text-ember text-xs">
              Prioridad Alta
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-steel text-xs">
              Dirección de trabajo o estudio frecuente
            </label>
            <div className="relative flex items-center">
              <Briefcase className="absolute left-3.5 h-4.5 w-4.5 text-fog" />
              <input
                className="h-12 w-full rounded-[14px] bg-paper pr-4 pl-10 font-medium text-graphite text-sm transition-colors focus:bg-snow focus:outline-none focus:ring-1 focus:ring-obsidian"
                onChange={(e) => update({ workAddress: e.target.value })}
                type="text"
                value={form.workAddress}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-steel text-xs">Tiempo máx. de trayecto</span>
              <span className="font-semibold text-obsidian text-sm">
                Max {form.maxCommuteMin} min en metro
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {COMMUTE_OPTIONS.map((min) => (
                <button
                  className={`rounded-[12px] px-1 py-2 text-center text-sm transition-colors ${
                    form.maxCommuteMin === min
                      ? "bg-obsidian font-semibold text-snow"
                      : "bg-paper text-steel"
                  }`}
                  key={min}
                  onClick={() => update({ maxCommuteMin: min })}
                  type="button"
                >
                  {min} min
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <span className="text-steel text-xs">Barrios objetivo</span>
            <div className="flex flex-wrap gap-1.5">
              {DISTRICT_CHIPS.map((c) =>
                chip(c.label, form.neighbourhoods.includes(c.value), () =>
                  toggleIn("neighbourhoods", c.value),
                ),
              )}
              {form.neighbourhoods
                .filter((v) => !DISTRICT_CHIPS.some((c) => c.value === v))
                .map((place) =>
                  chip(place, true, () => toggleIn("neighbourhoods", place)),
                )}
              <button
                className="flex items-center gap-1 rounded-full bg-paper px-3 py-1.5 text-fog text-sm"
                onClick={() => setOtherOpen((o) => !o)}
                type="button"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Otro</span>
              </button>
            </div>
            {otherOpen && (
              <div className="flex gap-2 pt-1">
                <input
                  className="h-10 flex-1 rounded-[14px] bg-paper px-3 text-graphite text-sm focus:bg-snow focus:outline-none focus:ring-1 focus:ring-obsidian"
                  onChange={(e) => setOtherValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addOther()}
                  placeholder="Nombre del barrio"
                  type="text"
                  value={otherValue}
                />
                <button
                  className="rounded-[14px] bg-obsidian px-4 text-snow text-sm"
                  onClick={addOther}
                  type="button"
                >
                  Añadir
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[32px] border border-cloud bg-snow p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-paper text-obsidian">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-base text-obsidian">
                2. Presupuesto &amp; Espacio
              </h3>
            </div>
            <span className="text-fog text-xs">Sin comisión oculta</span>
          </div>

          <div className="flex flex-col gap-2 rounded-[20px] bg-paper p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-steel text-xs">Rango mensual</span>
              <span className="font-semibold text-obsidian text-sm">
                {eur.format(form.minPriceEur)} — {eur.format(form.maxPriceEur)}
              </span>
            </div>
            <div className="flex flex-col gap-1 py-1">
              <input
                aria-label="Precio mínimo"
                className="w-full accent-ember"
                max={PRICE_MAX}
                min={PRICE_MIN}
                onChange={(e) =>
                  update({
                    minPriceEur: Math.min(
                      Number(e.target.value),
                      form.maxPriceEur,
                    ),
                  })
                }
                step={PRICE_STEP}
                type="range"
                value={form.minPriceEur}
              />
              <input
                aria-label="Precio máximo"
                className="w-full accent-ember"
                max={PRICE_MAX}
                min={PRICE_MIN}
                onChange={(e) =>
                  update({
                    maxPriceEur: Math.max(
                      Number(e.target.value),
                      form.minPriceEur,
                    ),
                  })
                }
                step={PRICE_STEP}
                type="range"
                value={form.maxPriceEur}
              />
            </div>
            <div className="flex justify-between text-fog text-xs">
              <span>{eur.format(PRICE_MIN)}</span>
              <span>Media en zona: 1.150€</span>
              <span>{eur.format(PRICE_MAX)}+</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-steel text-xs">
              Configuración del inmueble
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-3 rounded-[18px] bg-paper p-3">
                <div className="flex flex-col">
                  <span className="text-fog text-xs">Dormitorios</span>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label="Menos dormitorios"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-snow text-steel"
                      onClick={() =>
                        update({ minRooms: Math.max(1, form.minRooms - 1) })
                      }
                      type="button"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-semibold text-obsidian text-sm">
                      {form.minRooms} hab
                    </span>
                    <button
                      aria-label="Más dormitorios"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-snow text-steel"
                      onClick={() =>
                        update({ minRooms: Math.min(5, form.minRooms + 1) })
                      }
                      type="button"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-[18px] bg-paper p-3">
                <span className="text-fog text-xs">Superficie mín.</span>
                <div className="flex flex-wrap gap-1">
                  {M2_OPTIONS.map((m2) => (
                    <button
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        form.minM2 === m2
                          ? "bg-obsidian text-snow"
                          : "bg-snow text-steel"
                      }`}
                      key={m2}
                      onClick={() => update({ minM2: m2 })}
                      type="button"
                    >
                      +{m2}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[32px] border border-cloud bg-snow p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-paper text-obsidian">
              <CalendarDays className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-base text-obsidian">
              3. ¿Cuándo te mudas?
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            <input
              aria-label="Fecha de mudanza"
              className="h-12 w-full rounded-[14px] bg-paper px-4 text-graphite text-sm focus:bg-snow focus:outline-none focus:ring-1 focus:ring-obsidian"
              onChange={(e) => update({ moveDate: e.target.value || null })}
              type="date"
              value={form.moveDate ?? ""}
            />
            <button
              className={`flex items-center justify-between rounded-[14px] px-3 py-2.5 text-sm transition-colors ${
                form.flexibleDays > 0
                  ? "bg-obsidian text-snow"
                  : "bg-paper text-graphite"
              }`}
              onClick={() =>
                update({ flexibleDays: form.flexibleDays > 0 ? 0 : 15 })
              }
              type="button"
            >
              <span>Flexible (±15 días)</span>
              <Check className={`h-4 w-4 ${form.flexibleDays > 0 ? "" : "opacity-0"}`} />
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[32px] border border-cloud bg-snow p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-paper text-obsidian">
                <Check className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-base text-obsidian">
                4. Imprescindibles
              </h3>
            </div>
            <span className="text-fog text-xs">Filtros estrictos</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MUST_HAVES.map((mh) => {
              const active = form.mustHaves.includes(mh);
              const Icon = MUST_HAVE_ICONS[mh] ?? Sun;
              return (
                <button
                  className="flex items-center justify-between rounded-[18px] bg-paper p-3 transition-all"
                  key={mh}
                  onClick={() => toggleIn("mustHaves", mh)}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      className={`h-4.5 w-4.5 ${active ? "text-ember" : "text-fog"}`}
                    />
                    <span
                      className={`truncate text-sm ${active ? "text-obsidian" : "text-steel"}`}
                    >
                      {MUST_HAVE_LABELS[mh] ?? mh}
                    </span>
                  </div>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full ${
                      active ? "bg-obsidian text-snow" : "bg-cloud text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[32px] border border-cloud bg-snow p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ember/15 text-ember">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-base text-obsidian">
                5. Líneas Rojas
              </h3>
            </div>
            <span className="font-medium text-ember text-xs">Auto-descarte</span>
          </div>
          <p className="text-fog text-sm">
            Chezy descarta automáticamente cualquier inmueble con estas
            condiciones:
          </p>
          <div className="flex flex-col gap-2">
            {RED_LINES.map((rl) => {
              const active = form.redLines.includes(rl);
              return (
                <button
                  className="flex items-center justify-between rounded-[18px] bg-paper p-3"
                  key={rl}
                  onClick={() => toggleIn("redLines", rl)}
                  type="button"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="h-4.5 w-4.5 text-ember" />
                    <span className="text-left font-medium text-obsidian text-sm">
                      {RED_LINE_LABELS[rl] ?? rl}
                    </span>
                  </div>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] ${
                      active ? "bg-obsidian text-snow" : "bg-cloud text-transparent"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex w-full items-center justify-between rounded-[28px] border border-cloud bg-paper p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-snow text-obsidian">
              <BellRing className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-obsidian text-sm">
                Alerta en tiempo real
              </span>
              <span className="text-fog text-xs">
                Chezy te avisará vía Push &amp; WhatsApp
              </span>
            </div>
          </div>
          <button
            className={`rounded-full px-2.5 py-1 font-semibold text-xs ${
              form.alertsEnabled
                ? "bg-ember/10 text-ember"
                : "bg-cloud text-fog"
            }`}
            onClick={() => update({ alertsEnabled: !form.alertsEnabled })}
            type="button"
          >
            {form.alertsEnabled ? "Activo" : "Inactivo"}
          </button>
        </div>
      </div>

      <div className="fixed right-0 bottom-0 left-0 mx-auto w-full max-w-[480px] bg-snow/90 p-4 backdrop-blur-md">
        <div className="flex flex-col gap-2">
          {error && <p className="text-center text-red-600 text-xs">{error}</p>}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />
              <span className="font-semibold text-obsidian text-sm">
                {count >= 3
                  ? `${count} pisos coinciden en este momento`
                  : `${count} coinciden exactamente · Chezy ampliará la búsqueda automáticamente`}
              </span>
            </div>
          </div>
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-obsidian font-semibold text-sm text-snow transition-transform active:scale-[0.99] disabled:opacity-60"
            disabled={submitting}
            onClick={submit}
            type="button"
          >
            <span>{submitting ? "Guardando…" : "Guardar y Continuar"}</span>
            <ArrowRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </main>
  );
}
