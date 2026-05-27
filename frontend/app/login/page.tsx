import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#2b2d30] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-sm w-full px-6">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-md bg-emerald-500/90 flex items-center justify-center font-black text-zinc-900 text-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.4)_inset]">
            C
          </div>
          <span className="text-3xl font-bold tracking-tight text-zinc-100">Cheevo</span>
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Track your Xbox achievements. Sign in with your Microsoft account to get started.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-3 bg-[#107C10] hover:bg-[#0a5c0a] text-white font-semibold px-6 py-3 rounded-sm transition-colors text-sm"
          >
            Sign in with Xbox
          </button>
        </form>
      </div>
    </main>
  );
}
