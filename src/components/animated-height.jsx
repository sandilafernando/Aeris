"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

/**
 * Animates a card whose height depends on live data.
 *
 * The At a glance widget grows or shrinks when the observation source changes
 * (one group, or two). Without this wrapper the neighbouring Right Now card,
 * which stretches to the same grid row, snapped between heights in a single
 * frame. The content keeps its natural height and only the wrapper is animated,
 * so nothing is clipped and the visible layout stays correct when JS is still
 * hydrating.
 */
export default function AnimatedHeight({ children, className }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(null);
  const reduceMotion = useReducedMotion();
  const { reducedEffects } = usePreferences();
  const animate = !reduceMotion && !reducedEffects;

  useEffect(() => {
    const node = innerRef.current;
    if (!node) return undefined;

    const measure = () => {
      const next = node.getBoundingClientRect().height;
      if (Number.isFinite(next) && next > 0) setHeight(next);
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(className, "min-w-0")}
      style={
        animate && height
          ? {
              height,
              transition: "height 420ms cubic-bezier(0.22, 1, 0.36, 1)",
            }
          : undefined
      }
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
