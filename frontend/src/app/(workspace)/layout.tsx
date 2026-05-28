export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full">
      {/* TODO: WorkspaceSidebar — documents, ratings, company verification, templates */}
      {children}
    </div>
  );
}
