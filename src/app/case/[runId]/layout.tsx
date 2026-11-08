// Force this entire route segment to be dynamic (no static prerender)
export const dynamic = "force-dynamic";

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
