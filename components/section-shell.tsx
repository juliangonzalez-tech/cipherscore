type SectionShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export function SectionShell({
  eyebrow,
  title,
  description,
  children
}: SectionShellProps) {
  return (
    <section className="card px-6 py-6 sm:px-8 sm:py-8">
      <div className="max-w-2xl">
        <div className="text-xs uppercase tracking-[0.24em] text-white/45">{eyebrow}</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-white/65 sm:text-base">{description}</p>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
