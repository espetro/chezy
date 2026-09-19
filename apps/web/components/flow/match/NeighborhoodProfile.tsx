import type { NeighborhoodProfile as NeighborhoodProfileData } from "@/lib/flow/types";

interface NeighborhoodProfileProps {
  profile: NeighborhoodProfileData;
}

const metrics: Array<{
  key: keyof NeighborhoodProfileData;
  label: string;
  format: (value: number) => string;
}> = [
  { key: "shops", label: "Shops & leisure", format: (v) => `${v}/100` },
  { key: "nightlife", label: "Nightlife", format: (v) => `${v}/100` },
  { key: "safety", label: "Safety", format: (v) => `${v}/100` },
  { key: "noise", label: "Noise", format: (v) => `${v}/100` },
];

export const NeighborhoodProfile = ({ profile }: NeighborhoodProfileProps) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between rounded-[14px] bg-card-subtle px-4 py-3">
      <span className="text-[14px] text-iron">Commute to your office</span>
      <span className="text-[15px] font-semibold text-obsidian">
        {profile.transitMinutesToWork} min
      </span>
    </div>

    <div className="flex flex-col gap-3">
      {metrics.map((metric) => (
        <div key={metric.key} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-fog">{metric.label}</span>
            <span className="text-iron">{metric.format(profile[metric.key])}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-pills bg-cloud">
            <div
              className="h-full rounded-pills bg-obsidian"
              style={{ width: `${profile[metric.key]}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
);
