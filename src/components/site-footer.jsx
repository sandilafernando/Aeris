import { ArrowUpRight, Database, ExternalLink } from "lucide-react";
import PresenceChip from "@/components/presence-chip";

function SourceLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-lg py-1 text-xs leading-5 text-muted-foreground underline decoration-outline-variant/80 underline-offset-4 transition-colors hover:text-foreground focus-visible:text-foreground"
    >
      <span className="min-w-0 break-words text-left">{children}</span>
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export default function SiteFooter({ onOpenSources }) {
  return (
    <footer
      aria-label="About Aeris and data sources"
      className="mt-10 border-t border-border/80 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-6 sm:mt-12 sm:pt-8"
    >
      <div className="grid min-w-0 gap-7 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(12rem,0.75fr)] lg:gap-x-12">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold tracking-[-0.025em]">Aeris</p>
          <p className="mt-1.5 max-w-[46ch] text-xs leading-5 text-muted-foreground">
            An independent weather app. No account, no ads, and no live radar — just the
            forecast, clearly told. Official Sri Lankan station readings sit beside the model,
            never blended into it.
          </p>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            © 2026 Aeris
            <span aria-hidden="true"> · </span>
            <span className="font-semibold text-foreground">Project by Sandila Fernando</span>
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Data &amp; attribution
          </p>
          <div className="mt-2 flex flex-col items-start">
            <SourceLink href="https://open-meteo.com/">Forecast: Open-Meteo (CC BY 4.0)</SourceLink>
            <SourceLink href="https://meteo.gov.lk/">
              Official observations: Department of Meteorology, Sri Lanka
            </SourceLink>
            <SourceLink href="https://www.geonames.org/">Place search: GeoNames</SourceLink>
            <p className="mt-1 max-w-full text-xs leading-5 text-muted-foreground">
              Not affiliated with Google or the Department of Meteorology.
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-2.5 sm:col-span-2 lg:col-span-1 lg:items-end">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto lg:justify-end">
            {onOpenSources ? (
              <button
                type="button"
                onClick={onOpenSources}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant px-3.5 text-xs font-semibold text-foreground transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-container/45 active:translate-y-0"
              >
                <Database aria-hidden="true" className="size-3.5" />
                Data sources &amp; limits
                <ArrowUpRight aria-hidden="true" className="size-3" />
              </button>
            ) : null}
            <PresenceChip className="min-h-11 px-3" />
          </div>
          <p className="max-w-[30ch] text-[0.68rem] leading-4 text-muted-foreground sm:text-left lg:text-right">
            Forecasts update when Open-Meteo ingests a new model run. Station readings keep
            their own observation time.
          </p>
        </div>
      </div>
    </footer>
  );
}
