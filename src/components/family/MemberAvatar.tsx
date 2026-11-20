import type { AvatarKey, Member } from '../../types/domain.ts'

const fills: Record<AvatarKey, string> = {
  cercle: 'bg-emerald-500',
  carre: 'bg-sky-500',
  triangle: 'bg-amber-500',
  etoile: 'bg-rose-500',
}

function Shape({ avatarKey }: { avatarKey: AvatarKey }) {
  if (avatarKey === 'carre') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <rect width="20" height="20" fill="white" />
      </svg>
    )
  }
  if (avatarKey === 'triangle') {
    return (
      <svg width="22" height="20" viewBox="0 0 22 20" aria-hidden="true">
        <path d="M11 0 L22 20 H0 Z" fill="white" />
      </svg>
    )
  }
  if (avatarKey === 'etoile') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.4 14.6 9h6.8l-5.5 4.2 2.1 6.8L12 16.2 6 19.9l2.1-6.8L2.6 9h6.8Z" fill="white" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="white" />
    </svg>
  )
}

export function MemberAvatar({ member, size = 72 }: { member: Member; size?: number }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border-2 border-neutral-900 ${fills[member.avatarKey]}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Shape avatarKey={member.avatarKey} />
    </span>
  )
}
