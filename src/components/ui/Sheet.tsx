import type { ReactNode } from 'react'

export function Sheet({
  title,
  children,
  onClose,
  tone = 'default',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  tone?: 'default' | 'request'
}) {
  const surface = tone === 'request' ? 'bg-violet-200' : 'bg-white'

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className={`max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] ${surface}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="sheet-title" className="text-2xl font-bold">
            {title}
          </h2>
          <button type="button" className="min-h-11 min-w-11 text-2xl" onClick={onClose}>
            ×<span className="sr-only">Fermer</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
