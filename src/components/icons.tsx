import type { ComponentType, ReactNode } from "react";
import type { SkillId } from "@/lib/types";

export interface IconProps {
  className?: string;
}

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

function StrokeIcon({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg {...svgProps} className={className}>
      {children}
    </svg>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M12 6.6C10.6 5.4 8.6 4.8 6 4.8H4v13.4h2c2.6 0 4.6.6 6 1.8 1.4-1.2 3.4-1.8 6-1.8h2V4.8h-2c-2.6 0-4.6.6-6 1.8Z" />
      <path d="M12 6.6v13.4" />
    </StrokeIcon>
  );
}

export function HeadphonesIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M4 14.5v-2.3a8 8 0 0 1 16 0v2.3" />
      <rect x="2.6" y="14" width="4.2" height="6" rx="1.7" />
      <rect x="17.2" y="14" width="4.2" height="6" rx="1.7" />
    </StrokeIcon>
  );
}

export function PenIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M4 20h4L18.2 9.8a2.7 2.7 0 0 0-3.8-3.8L4 16.2V20Z" />
      <path d="m13.6 6.8 3.8 3.8" />
    </StrokeIcon>
  );
}

export function MicIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <rect x="9" y="2.8" width="6" height="10.4" rx="3" />
      <path d="M5.4 11.2a6.6 6.6 0 0 0 13.2 0" />
      <path d="M12 17.8V21" />
    </StrokeIcon>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M4 3.6v16.8h16" />
      <path d="M8 16.8V13" />
      <path d="M13 16.8V8.4" />
      <path d="M18 16.8v-5.6" />
    </StrokeIcon>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M4.5 12h14" />
      <path d="m13 6.5 5.5 5.5-5.5 5.5" />
    </StrokeIcon>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="m4.5 12.5 5 5 10-11" />
    </StrokeIcon>
  );
}

/** Brand mark: two overlapping speech bubbles. */
export function LogoMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <path d="M3 6.2A2.2 2.2 0 0 1 5.2 4h8.6A2.2 2.2 0 0 1 16 6.2v5.3a2.2 2.2 0 0 1-2.2 2.2H8.9l-3.6 2.6a.7.7 0 0 1-1.1-.6v-2.2A2.2 2.2 0 0 1 3 11.5V6.2Z" />
      <path
        d="M18.6 8.2h.2A2.2 2.2 0 0 1 21 10.4v5.3c0 .9-.5 1.6-1.3 2v2.3a.7.7 0 0 1-1.1.6l-3.5-2.5h-4.4a2.2 2.2 0 0 1-2-1.4h5.1a4 4 0 0 0 4-4V8.2Z"
        opacity="0.55"
      />
    </svg>
  );
}

export const SKILL_ICONS: Record<SkillId, ComponentType<IconProps>> = {
  reading: BookIcon,
  listening: HeadphonesIcon,
  writing: PenIcon,
  speaking: MicIcon,
};
