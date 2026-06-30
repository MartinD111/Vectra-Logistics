export default function FleetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full">
      {/* TODO: FleetSidebar — vehicle list, driver roster, maintenance alerts */}
      {children}
    </div>
  );
}
