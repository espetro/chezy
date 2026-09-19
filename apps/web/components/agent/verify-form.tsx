"use client";

import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  FileScan,
  Fingerprint,
  Landmark,
  Lock,
  Send,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const PERKS = [
  {
    icon: Send,
    iconClass: "bg-paper text-ember",
    title: "Contacto hiper-rápido",
    badge: "< 3 min",
    text: "Escribe por WhatsApp o portales a los pisos calientes antes de que se saturen de candidatos.",
  },
  {
    icon: CalendarDays,
    iconClass: "bg-paper text-obsidian",
    title: "Auto-reserva de visitas",
    badge: null,
    text: "Sincroniza franjas libres con tu agenda personal sin cadenas interminables de mensajes.",
  },
  {
    icon: BadgeCheck,
    iconClass: "bg-paper text-ember",
    title: "Inquilino Certificado",
    badge: "x4 Respuestas",
    text: "Los propietarios con mayor puntuación priorizan perfiles con solvencia digital validada.",
  },
];

export function VerifyForm({ alreadyVerified }: { alreadyVerified: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<"id" | "bank">("id");
  const [fileName, setFileName] = useState<string>();
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const activate = async () => {
    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verified: true }),
      });
      if (res.ok) {
        router.push("/feed");
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo activar el agente.");
        setSubmitting(false);
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setSubmitting(false);
    }
  };

  const zoneTitle =
    method === "id" ? "Escanear anverso del DNI/NIE" : "Conexión segura Open Banking o Cl@ve";
  const zoneSubtitle =
    method === "id"
      ? "Usa la cámara o sube archivo PDF / JPG"
      : "Verificación instantánea sin subir imágenes";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-2 pb-12">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-ember/15 px-3 py-1 text-ember">
          <Lock className="h-3.5 w-3.5" />
          <span className="text-xs">Cifrado bancario de extremo a extremo</span>
        </div>
        <div className="flex items-center gap-1 text-fog">
          <Zap className="h-4 w-4 text-ember" />
          <span className="text-xs">Paso 3 de 3</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-3xl text-graphite tracking-tight">
          Verifica tu perfil en 60 segundos
        </h1>
        <p className="text-iron text-sm leading-relaxed">
          Permite que Chezy contacte a propietarios verificados y reserve turnos
          de visita prioritarios a tu nombre de forma 100% autónoma.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-[28px] border border-cloud bg-snow p-5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-fog text-xs uppercase tracking-wider">
            Poderes que desbloqueas
          </span>
          <span className="rounded-full bg-ember/10 px-2 py-0.5 font-semibold text-ember text-xs">
            3 activos
          </span>
        </div>
        {PERKS.map((perk, i) => (
          <div key={perk.title}>
            {i > 0 && <div className="mb-4 h-px w-full bg-cloud" />}
            <div className="flex items-start gap-3.5">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${perk.iconClass}`}
              >
                <perk.icon className="h-5 w-5" />
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[15px] text-obsidian leading-tight">
                    {perk.title}
                  </span>
                  {perk.badge && (
                    <span className="rounded bg-ember/15 px-1.5 py-0.5 font-bold text-[10px] text-ember">
                      {perk.badge}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-iron leading-snug">
                  {perk.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-[28px] border border-cloud bg-snow p-5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-base text-obsidian">
            Selecciona método ágil
          </span>
          <Fingerprint className="h-4.5 w-4.5 text-fog" />
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-paper p-1">
          <button
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm transition-all ${
              method === "id"
                ? "bg-snow font-semibold text-obsidian shadow-sm"
                : "text-fog"
            }`}
            onClick={() => setMethod("id")}
            type="button"
          >
            <BadgeCheck className="h-4 w-4" />
            <span>DNI/NIE (IA)</span>
          </button>
          <button
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm transition-all ${
              method === "bank"
                ? "bg-snow font-semibold text-obsidian shadow-sm"
                : "text-fog"
            }`}
            onClick={() => setMethod("bank")}
            type="button"
          >
            <Landmark className="h-4 w-4" />
            <span>Banco / Cl@ve</span>
          </button>
        </div>

        <button
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-cloud border-dashed bg-paper/70 p-5 text-center transition-all"
          onClick={() => fileInput.current?.click()}
          type="button"
        >
          <input
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name)}
            ref={fileInput}
            type="file"
          />
          <div className="relative mb-3 flex h-12 w-16 items-center justify-center rounded-xl bg-snow">
            <FileScan className="h-7 w-7 text-ember" />
            {!fileName && (
              <span className="-top-1 -right-1 absolute flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-ember" />
              </span>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-semibold text-obsidian text-sm">
              {fileName ?? zoneTitle}
            </span>
            <span className="text-[12px] text-fog">
              {fileName ? "Documento listo para análisis" : zoneSubtitle}
            </span>
          </div>
          <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-snow px-2.5 py-1 text-steel">
            {fileName ? (
              <Check className="h-3.5 w-3.5 text-ember" />
            ) : (
              <FileScan className="h-3.5 w-3.5 text-ember" />
            )}
            <span className="text-xs">
              {fileName ? "Lectura óptica simulada" : "Lectura óptica biométrica preparada"}
            </span>
          </div>
        </button>

        <label className="flex cursor-pointer items-start gap-3 pt-1">
          <input
            checked={consent}
            className="peer sr-only"
            onChange={(e) => setConsent(e.target.checked)}
            type="checkbox"
          />
          <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-paper transition-colors peer-checked:bg-obsidian">
            <Check className="h-4 w-4 scale-0 font-bold text-snow transition-transform peer-checked:scale-100" />
          </div>
          <span className="text-[13px] text-iron leading-snug">
            Autorizo a Chezy a contactar propietarios bajo mi supervisión y
            pre-agendar visitas según mi calendario.
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {error && <p className="text-center text-red-600 text-xs">{error}</p>}
        {alreadyVerified && (
          <p className="text-center text-ember text-xs">
            Tu perfil ya está verificado; puedes ir directo al feed.
          </p>
        )}
        <button
          className="flex h-14 w-full transform items-center justify-center gap-2 rounded-2xl bg-obsidian font-semibold text-sm text-snow transition-all active:scale-[0.99] active:bg-slate disabled:opacity-50"
          disabled={!consent || submitting}
          onClick={activate}
          type="button"
        >
          <Zap className="h-5 w-5 text-ember" />
          <span>{submitting ? "Sincronizando agente…" : "Activar Agente Autónomo"}</span>
          <ArrowRight className="h-4.5 w-4.5" />
        </button>
        <div className="flex items-center justify-center gap-2 text-center">
          <ShieldCheck className="h-3.5 w-3.5 text-fog" />
          <span className="text-fog text-xs underline decoration-mist underline-offset-2">
            ¿Cómo protegemos tus datos personales?
          </span>
        </div>
      </div>
    </main>
  );
}
