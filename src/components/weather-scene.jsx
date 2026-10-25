"use client";

import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";
import styles from "./weather-scene.module.css";

const CONDITION_GROUPS = new Set([
  "clear",
  "partly",
  "cloudy",
  "rain",
  "snow",
  "storm",
  "fog",
]);

const ORB_TONE_CLASS = {
  primary: styles.tonePrimary,
  detail: styles.toneDetail,
  cloud: styles.toneCloud,
  glow: styles.toneGlow,
};

/*
 * All particle geometry is declared up front. Nothing is randomized during
 * render, so the server and client produce identical markup.
 */
const ORB_PRESETS = {
  clear: [
    {
      tone: "primary",
      size: "min(58%, 28rem)",
      top: "-24%",
      right: "-8%",
      duration: "26s",
      delay: "-4s",
    },
    {
      tone: "detail",
      size: "min(34%, 17rem)",
      bottom: "-18%",
      left: "2%",
      duration: "32s",
      delay: "-13s",
    },
    {
      tone: "glow",
      size: "min(54%, 24rem)",
      top: "22%",
      left: "34%",
      duration: "28s",
      delay: "-9s",
    },
  ],
  partly: [
    {
      tone: "cloud",
      size: "min(62%, 30rem)",
      top: "-22%",
      left: "-10%",
      duration: "30s",
      delay: "-5s",
    },
    {
      tone: "primary",
      size: "min(34%, 18rem)",
      top: "-4%",
      right: "0%",
      duration: "26s",
      delay: "-12s",
    },
    {
      tone: "detail",
      size: "min(44%, 22rem)",
      bottom: "-20%",
      right: "-6%",
      duration: "34s",
      delay: "-18s",
    },
  ],
  cloudy: [
    {
      tone: "cloud",
      size: "min(66%, 32rem)",
      top: "-24%",
      right: "-10%",
      duration: "30s",
      delay: "-7s",
    },
    {
      tone: "detail",
      size: "min(50%, 24rem)",
      bottom: "-22%",
      left: "-8%",
      duration: "36s",
      delay: "-15s",
    },
    {
      tone: "glow",
      size: "min(42%, 20rem)",
      top: "30%",
      left: "24%",
      duration: "32s",
      delay: "-3s",
    },
  ],
  rain: [
    {
      tone: "detail",
      size: "min(52%, 24rem)",
      top: "-18%",
      left: "-8%",
      duration: "32s",
      delay: "-6s",
    },
    {
      tone: "cloud",
      size: "min(46%, 22rem)",
      top: "-8%",
      right: "-6%",
      duration: "36s",
      delay: "-16s",
    },
    {
      tone: "glow",
      size: "min(50%, 24rem)",
      bottom: "-24%",
      left: "30%",
      duration: "34s",
      delay: "-11s",
    },
  ],
  snow: [
    {
      tone: "cloud",
      size: "min(60%, 28rem)",
      top: "-22%",
      left: "-12%",
      duration: "34s",
      delay: "-8s",
    },
    {
      tone: "detail",
      size: "min(42%, 20rem)",
      bottom: "-18%",
      right: "-8%",
      duration: "38s",
      delay: "-20s",
    },
    {
      tone: "primary",
      size: "min(36%, 18rem)",
      top: "28%",
      right: "12%",
      duration: "32s",
      delay: "-3s",
    },
  ],
  storm: [
    {
      tone: "detail",
      size: "min(54%, 26rem)",
      top: "-20%",
      left: "-10%",
      duration: "28s",
      delay: "-4s",
    },
    {
      tone: "cloud",
      size: "min(50%, 24rem)",
      top: "-6%",
      right: "-8%",
      duration: "34s",
      delay: "-14s",
    },
    {
      tone: "primary",
      size: "min(26%, 12rem)",
      bottom: "8%",
      right: "8%",
      duration: "30s",
      delay: "-9s",
    },
  ],
  fog: [
    {
      tone: "cloud",
      size: "min(64%, 30rem)",
      top: "-24%",
      left: "-10%",
      duration: "36s",
      delay: "-6s",
    },
    {
      tone: "detail",
      size: "min(46%, 22rem)",
      bottom: "-20%",
      right: "-6%",
      duration: "40s",
      delay: "-18s",
    },
    {
      tone: "glow",
      size: "min(44%, 20rem)",
      top: "32%",
      left: "28%",
      duration: "38s",
      delay: "-12s",
    },
  ],
};

const CLOUD_PRESETS = {
  partly: [
    {
      top: "14%",
      left: "-12%",
      width: "46%",
      drift: "3rem",
      duration: "38s",
      delay: "-8s",
      opacity: 0.4,
    },
    {
      top: "62%",
      right: "-10%",
      width: "40%",
      drift: "-2.4rem",
      duration: "46s",
      delay: "-24s",
      opacity: 0.32,
    },
  ],
  cloudy: [
    {
      top: "8%",
      left: "-18%",
      width: "56%",
      drift: "3.4rem",
      duration: "40s",
      delay: "-6s",
      opacity: 0.44,
    },
    {
      top: "38%",
      right: "-16%",
      width: "52%",
      drift: "-3rem",
      duration: "48s",
      delay: "-22s",
      opacity: 0.36,
    },
    {
      top: "70%",
      left: "2%",
      width: "38%",
      drift: "2.2rem",
      duration: "44s",
      delay: "-15s",
      opacity: 0.3,
    },
  ],
  fog: [
    {
      top: "18%",
      left: "-20%",
      width: "60%",
      drift: "3.8rem",
      duration: "52s",
      delay: "-10s",
      opacity: 0.42,
    },
    {
      top: "46%",
      right: "-18%",
      width: "56%",
      drift: "-3.2rem",
      duration: "60s",
      delay: "-30s",
      opacity: 0.34,
    },
    {
      top: "72%",
      left: "-4%",
      width: "46%",
      drift: "2.6rem",
      duration: "56s",
      delay: "-18s",
      opacity: 0.3,
    },
  ],
};

const FOG_BANDS = [
  { top: "34%", duration: "40s", delay: "-6s", opacity: 0.32 },
  { top: "57%", duration: "48s", delay: "-26s", opacity: 0.26 },
  { top: "76%", duration: "44s", delay: "-14s", opacity: 0.22 },
];

const STARS = [
  { left: "6%", top: "14%", size: "2px", delay: "-0.4s", duration: "5.2s" },
  { left: "13%", top: "38%", size: "1.5px", delay: "-2.1s", duration: "6.8s" },
  { left: "21%", top: "9%", size: "2.5px", delay: "-4.3s", duration: "7.4s" },
  { left: "28%", top: "27%", size: "1.8px", delay: "-1.2s", duration: "6.1s" },
  { left: "34%", top: "52%", size: "2px", delay: "-3.5s", duration: "8.2s" },
  { left: "41%", top: "17%", size: "1.5px", delay: "-5.1s", duration: "5.7s" },
  { left: "47%", top: "40%", size: "2.6px", delay: "-0.8s", duration: "7.8s" },
  { left: "53%", top: "8%", size: "2px", delay: "-2.7s", duration: "6.4s" },
  { left: "58%", top: "30%", size: "1.6px", delay: "-4.8s", duration: "8.4s" },
  { left: "64%", top: "49%", size: "2.2px", delay: "-1.6s", duration: "5.4s" },
  { left: "69%", top: "19%", size: "1.8px", delay: "-3.9s", duration: "7.1s" },
  { left: "74%", top: "36%", size: "2.8px", delay: "-0.2s", duration: "6.6s" },
  { left: "79%", top: "11%", size: "1.5px", delay: "-5.6s", duration: "8s" },
  { left: "83%", top: "54%", size: "2px", delay: "-2.4s", duration: "5.9s" },
  { left: "87%", top: "25%", size: "2.4px", delay: "-4.1s", duration: "7.6s" },
  { left: "91%", top: "44%", size: "1.7px", delay: "-1.9s", duration: "6.2s" },
  { left: "94%", top: "16%", size: "2.2px", delay: "-3.2s", duration: "8.1s" },
  { left: "97%", top: "58%", size: "1.6px", delay: "-5.3s", duration: "6.9s" },
];

const RAIN_DROPS = Array.from({ length: 14 }, (_, index) => ({
  left: `${3 + ((index * 7.4) % 94)}%`,
  height: `${18 + ((index * 11) % 24)}px`,
  duration: `${1.7 + ((index * 0.31) % 1.2)}s`,
  delay: `-${(index * 0.23).toFixed(2)}s`,
  opacity: 0.38 + ((index * 0.07) % 0.22),
}));

const SNOWFLAKES = Array.from({ length: 12 }, (_, index) => ({
  left: `${4 + ((index * 8.3) % 92)}%`,
  size: `${4 + (index % 3)}px`,
  duration: `${9 + ((index * 1.9) % 7)}s`,
  delay: `-${(index * 1.17).toFixed(2)}s`,
  sway: `${(index % 2 === 0 ? 1 : -1) * (10 + (index % 4) * 5)}px`,
  opacity: 0.5 + ((index * 0.05) % 0.3),
}));

function Orbs({ group }) {
  return ORB_PRESETS[group].map((orb, index) => (
    <span
      key={`${orb.tone}-${index}`}
      className={cn(styles.orb, ORB_TONE_CLASS[orb.tone])}
      style={{
        "--orb-size": orb.size,
        "--orb-top": orb.top,
        "--orb-right": orb.right,
        "--orb-bottom": orb.bottom,
        "--orb-left": orb.left,
        "--orb-duration": orb.duration,
        "--orb-delay": orb.delay,
        "--orb-shift-x": index % 2 === 0 ? "1.6rem" : "-1.4rem",
        "--orb-shift-y": index % 3 === 0 ? "-1.1rem" : "0.9rem",
        animationDirection: index % 2 === 0 ? "normal" : "reverse",
      }}
    />
  ));
}

function Clouds({ group }) {
  return (CLOUD_PRESETS[group] ?? []).map((cloud, index) => (
    <span
      key={index}
      className={styles.cloud}
      style={{
        "--cloud-width": cloud.width,
        "--cloud-top": cloud.top,
        "--cloud-left": cloud.left,
        "--cloud-right": cloud.right,
        "--cloud-drift": cloud.drift,
        "--cloud-duration": cloud.duration,
        "--cloud-delay": cloud.delay,
        "--cloud-opacity": cloud.opacity,
      }}
    />
  ));
}

function FogBands() {
  return FOG_BANDS.map((band, index) => (
    <span
      key={index}
      className={styles.fogBand}
      style={{
        "--band-top": band.top,
        "--band-duration": band.duration,
        "--band-delay": band.delay,
        "--band-opacity": band.opacity,
      }}
    />
  ));
}

function RainField({ heavy }) {
  return (
    <div className={cn(styles.rainLayer, heavy && styles.rainHeavy)}>
      {RAIN_DROPS.map((drop, index) => (
        <span
          key={index}
          className={styles.rainDrop}
          style={{
            "--drop-left": drop.left,
            "--drop-height": drop.height,
            "--drop-duration": drop.duration,
            "--drop-delay": drop.delay,
            "--drop-opacity": drop.opacity,
          }}
        />
      ))}
    </div>
  );
}

function SnowField() {
  return (
    <div className={styles.snowLayer}>
      {SNOWFLAKES.map((flake, index) => (
        <span
          key={index}
          className={styles.snowflake}
          style={{
            "--flake-left": flake.left,
            "--flake-size": flake.size,
            "--flake-duration": flake.duration,
            "--flake-delay": flake.delay,
            "--flake-sway": flake.sway,
            "--flake-opacity": flake.opacity,
          }}
        />
      ))}
    </div>
  );
}

function Stars() {
  return (
    <div className={styles.starField}>
      {STARS.map((star, index) => (
        <span
          key={index}
          className={styles.star}
          style={{
            "--star-left": star.left,
            "--star-top": star.top,
            "--star-size": star.size,
            "--star-delay": star.delay,
            "--star-duration": star.duration,
          }}
        />
      ))}
    </div>
  );
}

export default function WeatherScene({
  group = "partly",
  isDay = true,
  intensity = "normal",
  className,
}) {
  const { reducedEffects } = usePreferences();
  const condition = CONDITION_GROUPS.has(group) ? group : "partly";
  const showClouds = condition === "partly" || condition === "cloudy" || condition === "fog";
  const showRain = condition === "rain" || condition === "storm";
  const showSnow = condition === "snow";
  const showRays = condition === "clear" && isDay;
  const showStars = condition === "clear" && !isDay;

  return (
    <div
      aria-hidden="true"
      className={cn(
        styles.root,
        intensity === "subtle" && styles.subtle,
        reducedEffects && styles.reduced,
        className,
      )}
      data-group={condition}
    >
      <div className={styles.atmosphere}>
        <Orbs group={condition} />
        {showClouds ? <Clouds group={condition} /> : null}
        {condition === "fog" ? <FogBands /> : null}
        {showRays ? <span className={styles.rays} /> : null}
        {showStars ? <Stars /> : null}
        {showRain ? <RainField heavy={condition === "storm"} /> : null}
        {showSnow ? <SnowField /> : null}
      </div>
    </div>
  );
}
