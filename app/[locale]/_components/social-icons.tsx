/** Each mark is drawn in its platform's own colours so it is recognisable at a glance. */
export function SocialIcon({ label }: { label: string }) {
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", "aria-hidden": true, focusable: false } as const;

  switch (label) {
    case "Instagram":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#FEDA75" />
              <stop offset="0.35" stopColor="#FA7E1E" />
              <stop offset="0.6" stopColor="#D62976" />
              <stop offset="0.8" stopColor="#962FBF" />
              <stop offset="1" stopColor="#4F5BD5" />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="url(#ig-grad)" strokeWidth="2" />
          <circle cx="12" cy="12" r="4.2" fill="none" stroke="url(#ig-grad)" strokeWidth="2" />
          <circle cx="17.4" cy="6.6" r="1.2" fill="#D62976" />
        </svg>
      );
    case "TikTok": {
      const note =
        "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z";
      return (
        <svg {...common}>
          <path d={note} fill="#25F4EE" transform="translate(-0.7 -0.7)" />
          <path d={note} fill="#FE2C55" transform="translate(0.7 0.7)" />
          <path d={note} fill="#000" />
        </svg>
      );
    }
    case "LinkedIn":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#0A66C2" />
          <rect x="5.4" y="9.6" width="2.6" height="8.4" fill="#fff" />
          <circle cx="6.7" cy="6.8" r="1.5" fill="#fff" />
          <path d="M10.2 9.6h2.5v1.2c.4-.7 1.3-1.4 2.7-1.4 2.6 0 3.1 1.7 3.1 3.9V18h-2.6v-4.2c0-1 0-2.2-1.4-2.2s-1.6 1.1-1.6 2.2V18h-2.6z" fill="#fff" />
        </svg>
      );
    case "YouTube":
      return (
        <svg {...common}>
          <path
            d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8C22 15.2 22 12 22 12s0-3.2-.4-4.8z"
            fill="#FF0000"
          />
          <path d="M10 15.2V8.8l5.3 3.2z" fill="#fff" />
        </svg>
      );
    case "X":
      return (
        <svg {...common}>
          <path
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
            fill="#000"
          />
        </svg>
      );
    default:
      return <span className="text-[11px] tracking-[0.2em] uppercase">{label}</span>;
  }
}
