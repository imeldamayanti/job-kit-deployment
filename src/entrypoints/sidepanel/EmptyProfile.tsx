import { openEditProfile } from '../../platform/navigation'
import { Mascot } from '../../ui/mascot/Mascot'
import { Button } from '../../ui/primitives/Button'

export function EmptyProfile() {
  return (
    <section className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-4">
      <Mascot state="neutral" />
      <h2 className="text-[13px] font-bold text-text-primary">Profil masih kosong</h2>
      <p className="text-text-secondary">
        Autofill hanya seakurat data yang ada. Isi Personal Info dan Contact dulu — sisanya bisa menyusul.
      </p>
      <Button className="mt-1" onClick={() => void openEditProfile('personal')}>
        Isi profil sekarang
      </Button>
    </section>
  )
}
