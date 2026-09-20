import type { NeighborhoodProfile as NeighborhoodProfileData } from "~/lib/flow/types";

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
  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between rounded-[14px] bg-paper px-4 py-2.5">
      <span className="text-[13px] text-iron">Commute to your office</span>
      <span className="text-[15px] font-semibold text-obsidian">
        {profile.transitMinutesToWork} min
      </span>
    </div>

    <div className="flex flex-col gap-2.5">
      {metrics.map((metric) => (
        <div key={metric.key} className="flex flex-col gap-1">
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
