import Link from "next/link";

export default function AccessDeniedPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-slate-900">
    <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-100 text-xl font-bold text-amber-700">!</span>
      <h1 className="mt-5 text-2xl font-semibold">Boggan laguu oggolaan ma jiro</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Role-kaaga ma laha oggolaanshaha qaybtan. La xiriir admin-ka pharmacy-ga haddii aad u baahan tahay gelitaan.</p>
      <Link href="/home" className="mt-6 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Ku noqo Home</Link>
    </section>
  </main>;
}
