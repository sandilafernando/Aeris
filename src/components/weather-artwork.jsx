"use client";

import { cn } from "@/lib/utils";

const ART_FALLBACKS = {
  "--art-primary": "#eda300",
  "--art-cloud": "#f8fcfd",
  "--art-detail": "#c65322",
};

function Sun({ x = 105, y = 92, r = 42, rays = true }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--art-primary)" />
      {rays && (
        <g stroke="var(--art-primary)" strokeWidth="6" strokeLinecap="round">
          <path d={`M${x} ${y - r - 24}V${y - r - 9}`} />
          <path d={`M${x} ${y + r + 9}V${y + r + 24}`} />
          <path d={`M${x - r - 24} ${y}H${x - r - 9}`} />
          <path d={`M${x + r + 9} ${y}H${x + r + 24}`} />
          <path d={`M${x - r - 17} ${y - r - 17}L${x - r - 7} ${y - r - 7}`} />
          <path d={`M${x + r + 7} ${y + r + 7}L${x + r + 17} ${y + r + 17}`} />
          <path d={`M${x - r - 17} ${y + r + 17}L${x - r - 7} ${y + r + 7}`} />
          <path d={`M${x + r + 7} ${y - r - 7}L${x + r + 17} ${y - r - 17}`} />
        </g>
      )}
    </g>
  );
}

function Moon({ x = 105, y = 92, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M24 -48A54 54 0 1 0 45 43 43 43 0 0 1 24-48Z"
        fill="var(--art-primary)"
      />
      <circle cx="45" cy="-43" r="5" fill="var(--art-detail)" />
      <circle cx="63" cy="-21" r="3.5" fill="var(--art-detail)" opacity="0.8" />
    </g>
  );
}

function Cloud({ x = 0, y = 0, scale = 1, opacity = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <path
        d="M54 138c-14 0-25-10.5-25-24 0-13 10-23.5 22.5-24 4-22 22.5-38 44.5-38 19 0 35 11.8 41.5 28.5 4-1.8 8.5-2.8 13-2.8 14.5 0 26.5 11.5 26.5 26 0 14-11 25.5-25 26.3v8H54Z"
        fill="var(--art-cloud)"
      />
      <path
        d="M92 52c18.5 0 34 11.6 40 28l1.5 4.2 4.4-1.2a25 25 0 0 1 6.6-.9c13 0 23.5 10.2 24 23l.1 2.3 2.3.4c8 1.3 14.1 8.2 14.1 16.5 0 9.2-7.4 16.7-16.5 16.8l-3.5.1v8H54c-13.2 0-24-10.5-24-24 0-12.2 9.3-22.3 21.2-23.8l3.4-.4.8-3.3C58.7 76.5 74 60 92 60Z"
        fill="var(--art-detail)"
        opacity="0.1"
      />
    </g>
  );
}

function RainDrops() {
  return (
    <g stroke="var(--art-detail)" strokeWidth="6" strokeLinecap="round">
      <path d="M68 156l-8 15" />
      <path d="M103 158l-8 15" />
      <path d="M138 156l-8 15" />
    </g>
  );
}

function Snowflakes() {
  return (
    <g stroke="var(--art-primary)" strokeWidth="4" strokeLinecap="round">
      {[72, 108, 144].map((x, index) => (
        <g key={x} transform={`translate(${x} ${162 + (index % 2) * 5})`}>
          <path d="M-10 0H10" />
          <path d="M-7-7L7 7" />
          <path d="M-7 7L7-7" />
        </g>
      ))}
    </g>
  );
}

function FogLines() {
  return (
    <g stroke="var(--art-detail)" strokeWidth="6" strokeLinecap="round">
      <path d="M45 153h82" opacity="0.8" />
      <path d="M70 169h84" opacity="0.55" />
    </g>
  );
}

function Bolt() {
  return (
    <path
      d="M113 142h22l-19 30h13l-30 38 8-31H90l23-37Z"
      fill="var(--art-detail)"
      stroke="var(--art-detail)"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  );
}

export function WeatherGlyph({ group = "partly", isDay = true, className }) {
  const colorVars = ART_FALLBACKS;
  let content = null;

  if (group === "clear") {
    content = isDay ? <Sun /> : <Moon />;
  } else if (group === "partly") {
    content = isDay ? (
      <>
        <Sun x={127} y={73} r={31} />
        <Cloud x={10} y={5} scale={0.92} />
      </>
    ) : (
      <>
        <Moon x={131} y={74} scale={0.68} />
        <Cloud x={10} y={5} scale={0.92} />
      </>
    );
  } else if (group === "cloudy") {
    content = (
      <>
        <Cloud x={38} y={0} scale={0.67} opacity={0.4} />
        <Cloud x={0} y={30} scale={0.9} />
      </>
    );
  } else if (group === "fog") {
    content = (
      <>
        <Cloud x={14} y={-4} scale={0.82} opacity={0.72} />
        <FogLines />
      </>
    );
  } else if (group === "rain") {
    content = (
      <>
        <Cloud x={4} y={-2} scale={0.85} />
        <RainDrops />
      </>
    );
  } else if (group === "snow") {
    content = (
      <>
        <Cloud x={4} y={-2} scale={0.85} />
        <Snowflakes />
      </>
    );
  } else if (group === "storm") {
    content = (
      <>
        <Cloud x={4} y={-6} scale={0.85} />
        <Bolt />
      </>
    );
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 200 200"
      className={cn("h-full w-full overflow-visible", className)}
      style={colorVars}
    >
      {content}
    </svg>
  );
}

export function WeatherHeroArt({ group = "partly", isDay = true, className }) {
  return (
    <div
      aria-hidden="true"
      className={cn("relative aspect-square w-full max-w-[360px]", className)}
    >
      <div
        className="absolute inset-[10%] rotate-[-7deg] rounded-[43%_57%_51%_49%/49%_43%_57%_51%] border"
        style={{
          borderColor: "var(--hero-line)",
          backgroundColor: "color-mix(in srgb, var(--hero-art-cloud) 20%, transparent)",
        }}
      />
      <div
        className="absolute inset-[2%] rotate-[8deg] rounded-[55%_45%_42%_58%/47%_56%_44%_53%] border opacity-60"
        style={{ borderColor: "var(--hero-line)" }}
      />
      <div className="absolute inset-[16%] flex items-center justify-center drop-shadow-[0_22px_28px_rgba(0,0,0,0.12)]">
        <WeatherGlyph group={group} isDay={isDay} />
      </div>
      <span
        className="absolute right-[9%] top-[17%] size-3 rounded-full border"
        style={{
          backgroundColor: "var(--hero-art-detail)",
          borderColor: "var(--hero-bg)",
        }}
      />
      <span
        className="absolute bottom-[19%] left-[1%] size-2 rounded-full opacity-60"
        style={{ backgroundColor: "var(--hero-art-detail)" }}
      />
    </div>
  );
}

export function WeatherLineIcon({ group = "partly", isDay = true, className, title }) {
  const strokeProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  let content = null;
  if (group === "clear") {
    content = isDay ? (
      <>
        <circle cx="16" cy="16" r="5.2" />
        <path d="M16 3v2.5M16 26.5V29M3 16h2.5M26.5 16H29M7 7l1.8 1.8M23.2 23.2 25 25M7 25l1.8-1.8M23.2 8.8 25 7" />
      </>
    ) : (
      <path d="M22.5 20.7A9.2 9.2 0 0 1 11.3 8.1 9.8 9.8 0 1 0 25.2 23a9.4 9.4 0 0 1-2.7-2.3Z" />
    );
  } else if (group === "partly") {
    content = (
      <>
        {isDay ? (
          <>
            <circle cx="20.5" cy="10.5" r="3.4" />
            <path d="M20.5 3.5v2M20.5 15.5v2M13.5 10.5h2M25.5 10.5h2" />
          </>
        ) : (
          <path d="M21 8.8a5.5 5.5 0 0 1-4.8 8.7 5.9 5.9 0 1 0 7.4-8.1 5.5 5.5 0 0 1-2.6-.6Z" />
        )}
        <path d="M8.5 24.5h15a4 4 0 0 0 .2-8 6.3 6.3 0 0 0-11.9-1.6 4.8 4.8 0 0 0-3.3 9.6Z" />
      </>
    );
  } else if (group === "cloudy") {
    content = (
      <>
        <path d="M10 18.4a4.8 4.8 0 0 1 0-9.6 6.3 6.3 0 0 1 11.9 1.6 4 4 0 0 1-.2 8" opacity="0.55" />
        <path d="M8 25h15a4 4 0 0 0 .2-8 6.3 6.3 0 0 0-11.9-1.6A4.8 4.8 0 0 0 8 25Z" />
      </>
    );
  } else if (group === "fog") {
    content = (
      <>
        <path d="M8 19h15a4 4 0 0 0 .2-8 6.3 6.3 0 0 0-11.9-1.6A4.8 4.8 0 0 0 8 19Z" />
        <path d="M6 23h15M9 27h15" />
      </>
    );
  } else if (group === "rain") {
    content = (
      <>
        <path d="M8 18h15a4 4 0 0 0 .2-8 6.3 6.3 0 0 0-11.9-1.6A4.8 4.8 0 0 0 8 18Z" />
        <path d="m11 22-1.4 3M16.2 22l-1.4 3M21.4 22l-1.4 3" />
      </>
    );
  } else if (group === "snow") {
    content = (
      <>
        <path d="M8 18h15a4 4 0 0 0 .2-8 6.3 6.3 0 0 0-11.9-1.6A4.8 4.8 0 0 0 8 18Z" />
        <path d="M11 22v4M9.2 23l3.6 2M12.8 23l-3.6 2M21 22v4M19.2 23l3.6 2M22.8 23l-3.6 2" />
      </>
    );
  } else if (group === "storm") {
    content = (
      <>
        <path d="M8 17h15a4 4 0 0 0 .2-8 6.3 6.3 0 0 0-11.9-1.6A4.8 4.8 0 0 0 8 17Z" />
        <path d="M17 19.5 13 24h4l-2 5 6-6.5h-4l2-3Z" />
      </>
    );
  }

  return (
    <svg
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      {...strokeProps}
    >
      {title ? <title>{title}</title> : null}
      {content}
    </svg>
  );
}
