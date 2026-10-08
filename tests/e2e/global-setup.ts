import { execFileSync } from "node:child_process";
import { E2E_ADMIN } from "./helpers";

export default function globalSetup() {
  execFileSync(
    process.execPath,
    ["--env-file-if-exists=.env.local", "scripts/create-admin.mts", E2E_ADMIN.email, E2E_ADMIN.name],
    { stdio: "inherit", env: { ...process.env, ADMIN_PASSWORD: E2E_ADMIN.password } },
  );
}
