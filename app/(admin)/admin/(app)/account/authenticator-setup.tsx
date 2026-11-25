import { renderSVG } from "uqr";
import { totpUri } from "@/lib/auth/totp";
import { btn, field } from "../../_components/ui";
import { ActionForm } from "../../_components/action-feedback";
import { beginTotp, confirmTotp } from "./actions";
import { CopyKey } from "./copy-key";

export function AuthenticatorSetup({ email, secret }: { email: string; secret: string }) {
  const svg = renderSVG(totpUri(email, secret), { ecc: "M", border: 2, pixelSize: 4 });
  return (
    <div className="flex flex-col gap-4">
      <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-sm text-zinc-600">
        <li>Open Google Authenticator, Microsoft Authenticator, or a similar app.</li>
        <li>Scan the code, or enter the key by hand.</li>
        <li>Type the 6-digit code the app shows. It changes every 30 seconds.</li>
      </ol>
      <img
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        alt="Scan this with your authenticator app"
        width={196}
        height={196}
        className="rounded-lg bg-white p-2 ring-1 ring-zinc-200"
      />
      <CopyKey secret={secret} />
      <ActionForm action={confirmTotp} success="Authenticator 2FA enabled!" inline="Saved!" className="flex flex-col gap-2">
        <input name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} placeholder="6-digit code" className={`${field} h-11`} />
        <button className={`${btn.base} ${btn.primary} ${btn.md} w-fit`}>Confirm code</button>
      </ActionForm>
      <ActionForm action={beginTotp}>
        <button className={`${btn.base} ${btn.ghost} ${btn.sm} px-0`}>Generate a new code</button>
      </ActionForm>
    </div>
  );
}
