import type { Title } from '@/lib/titles'

const toneClass: Record<Title['tone'], string> = {
  good: 'bg-primary/10 text-primary',
  bad: 'bg-loss/10 text-loss',
  neutral: 'bg-muted text-muted-foreground',
}

export function TitleBadge({ title, className = '' }: { title: Title; className?: string }) {
  return (
    <span
      title={title.blurb}
      className={`rounded-sm px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider ${toneClass[title.tone]} ${className}`}
    >
      {title.label}
    </span>
  )
}
