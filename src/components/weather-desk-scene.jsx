"use client";

import { useReducedMotion } from "motion/react";
import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

const CONDITIONS = new Set(["clear", "partly", "cloudy", "rain", "snow", "storm", "fog"]);

/*
 * The band is wide and short (roughly 1200 x 300 and often wider), so the
 * drawing is composed for that shape. `slice` crops the top and bottom to fit;
 * keeping every meaningful element between y=30 and y=300 means nothing
 * important is ever cut off.
 */
const HORIZON = 246;

function Clouds({ condition }) {
  const heavy = condition === "cloudy" || condition === "rain" || condition === "storm";
  const few = condition === "clear" ? 1 : heavy ? 4 : 3;
  const cloud = "var(--hero-art-cloud)";

  const shapes = [
    { x: 168, y: 54, s: 0.78, o: 0.92 },
    { x: 452, y: 38, s: 0.6, o: 0.72 },
    { x: 706, y: 66, s: 0.9, o: 0.86 },
    { x: 1044, y: 44, s: 0.66, o: 0.68 },
  ].slice(0, few);

  return (
    <g className="desk-cloud-drift">
      {shapes.map((shape, index) => (
        <g
          key={index}
          transform={`translate(${shape.x} ${shape.y}) scale(${shape.s})`}
          opacity={shape.o}
        >
          <ellipse cx="0" cy="0" rx="58" ry="24" fill={cloud} />
          <circle cx="-26" cy="-8" r="25" fill={cloud} />
          <circle cx="14" cy="-16" r="33" fill={cloud} />
          <circle cx="46" cy="-2" r="21" fill={cloud} />
        </g>
      ))}
    </g>
  );
}

function SunOrMoon({ isDay }) {
  if (!isDay) {
    return (
      <g>
        <circle cx="952" cy="62" r="78" fill="var(--hero-glow)" opacity="0.45" />
        <circle cx="952" cy="62" r="40" fill="var(--hero-art-primary)" opacity="0.92" />
        <circle cx="936" cy="52" r="36" fill="var(--hero-bg)" opacity="0.92" />
      </g>
    );
  }
  return (
    <g>
      <circle cx="952" cy="58" r="90" fill="var(--hero-glow)" opacity="0.55" />
      <circle cx="952" cy="58" r="44" fill="var(--hero-art-primary)" opacity="0.95" />
    </g>
  );
}

function Skyline() {
  const buildings = [
    { x: 40, w: 58, h: 68 },
    { x: 106, w: 42, h: 96 },
    { x: 156, w: 70, h: 58 },
    { x: 234, w: 50, h: 84 },
    { x: 292, w: 38, h: 64 },
    { x: 338, w: 64, h: 100 },
    { x: 412, w: 46, h: 74 },
    { x: 466, w: 34, h: 56 },
    { x: 826, w: 54, h: 80 },
    { x: 888, w: 40, h: 62 },
    { x: 936, w: 62, h: 92 },
    { x: 1006, w: 44, h: 68 },
    { x: 1058, w: 56, h: 84 },
  ];

  return (
    <g>
      {buildings.map((building, index) => (
        <g key={index}>
          <rect
            x={building.x}
            y={HORIZON - building.h}
            width={building.w}
            height={building.h}
            rx="5"
            fill="var(--hero-art-detail)"
            opacity={index % 2 === 0 ? 0.58 : 0.4}
          />
          {[0, 1, 2].map((row) =>
            [0, 1].map((column) => (
              <rect
                key={`${row}-${column}`}
                x={building.x + 8 + column * (building.w - 24)}
                y={HORIZON - building.h + 12 + row * 18}
                width="11"
                height="10"
                rx="2"
                fill="var(--hero-art-cloud)"
                opacity="0.5"
              />
            )),
          )}
        </g>
      ))}
    </g>
  );
}

function TreeLine() {
  return (
    <g opacity="0.85">
      {[56, 112, 178, 716, 780, 844, 1104, 1152].map((x, index) => (
        <g key={x} transform={`translate(${x} ${HORIZON})`}>
          <rect
            x="-2"
            y="-16"
            width="4"
            height="18"
            rx="2"
            fill="var(--hero-art-detail)"
            opacity="0.55"
          />
          <circle
            cx="0"
            cy="-23"
            r={10 + (index % 3) * 3}
            fill="var(--hero-art-detail)"
            opacity="0.7"
          />
        </g>
      ))}
    </g>
  );
}

/*
 * The positioning transform lives on an outer <g>. A CSS animation sets the
 * `transform` property, which overrides the SVG transform *attribute*, so
 * animating the positioned element itself would teleport it to the origin.
 */
function Boat({ x, scale = 1, sail }) {
  return (
    <g transform={`translate(${x} ${HORIZON + 30}) scale(${scale})`}>
      <g className="desk-sail">
        {sail ? (
          <>
            <path d="M0 -40 L0 -2 L-24 -2 Z" fill="var(--hero-art-cloud)" opacity="0.95" />
            <path d="M4 -31 L24 -2 L4 -2 Z" fill="var(--hero-art-primary)" opacity="0.85" />
          </>
        ) : (
          <rect
            x="-22"
            y="-15"
            width="44"
            height="11"
            rx="5"
            fill="var(--hero-art-cloud)"
            opacity="0.55"
          />
        )}
        <path d="M-28 0 L28 0 L18 13 L-18 13 Z" fill="var(--hero-ink)" opacity="0.82" />
      </g>
    </g>
  );
}

function Balloon() {
  return (
    <g transform="translate(652 46)">
      <g className="desk-balloon">
        <ellipse cx="0" cy="0" rx="23" ry="27" fill="var(--hero-art-primary)" opacity="0.9" />
        <path
          d="M-23 6 Q0 20 23 6 Q16 31 0 34 Q-16 31 -23 6 Z"
          fill="var(--hero-art-primary)"
          opacity="0.5"
        />
        <rect x="-7" y="36" width="14" height="10" rx="3" fill="var(--hero-art-detail)" opacity="0.9" />
        <line x1="-12" y1="27" x2="-6" y2="36" stroke="var(--hero-ink)" strokeWidth="1.4" opacity="0.5" />
        <line x1="12" y1="27" x2="6" y2="36" stroke="var(--hero-ink)" strokeWidth="1.4" opacity="0.5" />
      </g>
    </g>
  );
}

function Precipitation({ condition }) {
  if (condition === "rain" || condition === "storm") {
    return (
      <g stroke="var(--hero-art-cloud)" strokeWidth="3" strokeLinecap="round" opacity="0.5">
        {Array.from({ length: 24 }, (_, index) => {
          const x = 34 + (index % 12) * 96;
          const y = 96 + Math.floor(index / 12) * 62 + (index % 3) * 8;
          return <line key={index} x1={x} y1={y} x2={x - 6} y2={y + 18} />;
        })}
      </g>
    );
  }
  if (condition === "snow") {
    return (
      <g fill="var(--hero-art-cloud)" opacity="0.6">
        {Array.from({ length: 16 }, (_, index) => (
          <circle
            key={index}
            cx={44 + (index % 8) * 142}
            cy={100 + Math.floor(index / 8) * 60 + (index % 3) * 10}
            r={3 + (index % 3)}
          />
        ))}
      </g>
    );
  }
  if (condition === "fog") {
    return (
      <g fill="var(--hero-art-cloud)" opacity="0.32">
        {[132, 166, 200].map((y, index) => (
          <rect key={y} x={index * 36} y={y} width="1200" height="18" rx="9" />
        ))}
      </g>
    );
  }
  return null;
}

/**
 * A flat, poster-style landscape for the Weather Desk. Every colour comes from
 * the active condition's `--hero-*` tokens, so the illustration follows real
 * weather rather than being decorative noise. It is purely decorative and
 * hidden from assistive technology; the readings beside it carry the meaning.
 */
export default function WeatherDeskScene({ group = "partly", isDay = true, className }) {
  const condition = CONDITIONS.has(group) ? group : "partly";
  const reduceMotion = useReducedMotion();
  const { reducedEffects } = usePreferences();
  const animate = !reduceMotion && !reducedEffects;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1200 300"
      preserveAspectRatio="xMidYMax slice"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      <g className={animate ? "desk-scene-drift" : undefined}>
        <SunOrMoon isDay={isDay} />
        <Clouds condition={condition} />
        <Balloon />
        <Precipitation condition={condition} />

        {/* Distant hills, then the city, then the near tree line. */}
        <path
          d="M-40 232 Q120 172 280 216 Q420 258 560 208 Q700 156 850 212 Q980 254 1110 204 Q1170 182 1240 206 L1240 300 L-40 300 Z"
          fill="var(--hero-art-detail)"
          opacity="0.24"
        />
        <path
          d="M-40 258 Q160 216 340 248 Q520 278 700 242 Q900 200 1080 246 Q1160 264 1240 250 L1240 300 L-40 300 Z"
          fill="var(--hero-art-detail)"
          opacity="0.38"
        />
        <Skyline />
        <TreeLine />

        {/* Water band with a sailboat and a motor yacht. */}
        <rect
          x="0"
          y={HORIZON}
          width="1200"
          height="54"
          fill="var(--hero-art-detail)"
          opacity="0.22"
        />
        <g stroke="var(--hero-art-cloud)" strokeWidth="2.5" strokeLinecap="round" opacity="0.42">
          {[262, 276, 290].map((y, index) => (
            <line
              key={y}
              x1={140 + index * 70}
              y1={y}
              x2={420 + index * 90}
              y2={y}
              strokeDasharray="16 22"
            />
          ))}
        </g>
        <Boat x={556} scale={0.95} sail />
        <Boat x={690} scale={0.72} />
      </g>
    </svg>
  );
}
