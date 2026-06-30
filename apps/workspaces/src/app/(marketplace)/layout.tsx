export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full">
      {/* TODO: MarketplaceFilterBar — route type, weight range, date picker */}
      {children}
    </div>
  );
}
