import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-full"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <Sidebar />
      <main
        className="flex-1 flex flex-col"
        style={{ paddingBottom: 64 /* space for mobile bottom nav */ }}
      >
        <div
          className="flex-1 w-full mx-auto px-4 md:px-8 py-6"
          style={{ maxWidth: 1100 }}
        >
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
