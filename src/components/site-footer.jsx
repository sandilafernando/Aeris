import { ExternalLink } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border/80 pb-2 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-sm font-semibold tracking-[-0.02em]">Aeris</p>
          <p className="mt-1 max-w-[42ch] text-xs leading-5 text-muted-foreground">
            An independent weather app. No account, no ads, and no live radar — just the
            forecast, clearly told.
          </p>
        </div>
        <div className="text-xs leading-5 text-muted-foreground sm:text-right">
          <p>
            Forecasts by{" "}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-semibold text-foreground underline decoration-outline-variant underline-offset-4 hover:text-primary"
            >
              Open-Meteo
              <ExternalLink aria-hidden="true" className="size-3" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>{" "}
            (CC BY 4.0)
          </p>
          <p className="mt-1">
            Place search by GeoNames · Not affiliated with Google
          </p>
        </div>
      </div>
    </footer>
  );
}
