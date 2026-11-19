import { CircleCheck, TriangleAlert } from 'lucide-react'

export type Notice = { kind: 'warn' | 'ok' | 'bad'; text: string }

export function Alert({ notice }: { notice: Notice }) {
  const tone = { warn: 'bg-amber-50 text-amber-700', ok: 'bg-green-50 text-green-700', bad: 'bg-rose-50 text-rose-700' }[notice.kind]
  const Icon = notice.kind === 'ok' ? CircleCheck : TriangleAlert
  return (
    <div role={notice.kind === 'ok' ? 'status' : 'alert'} className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px] ${tone}`}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p>{notice.text}</p>
    </div>
  )
}
