import { openEditProfile } from '../../platform/navigation'
import { Button } from '../../ui/primitives/Button'

export function App() {
  return (
    <main className="flex min-h-full flex-col gap-3 p-4">
      <h1 className="text-[17px] font-bold text-text-primary">job-kit</h1>
      <section className="rounded-xl border border-border bg-surface p-3">
        <Button onClick={() => void openEditProfile()}>Edit Profile</Button>
      </section>
    </main>
  )
}
