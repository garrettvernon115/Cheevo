import { redirect } from "next/navigation";

// With OpenXBL OAuth, signing in already yields the user's XUID — there's no
// separate gamertag-linking step anymore. Anyone landing here goes to the
// dashboard (the proxy only sends signed-in users with an XUID, which is always
// the case now).
export default function SetupPage() {
  redirect("/");
}
