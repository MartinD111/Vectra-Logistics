export default function RoutesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full">
      {/* TODO: RoutesToolbar — map mode toggle, waypoint panel, traffic overlay */}
      {children}
    </div>
  );
}
