export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials =
    name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  const sizeClasses = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-700 font-medium flex-shrink-0 ${sizeClasses}`}
    >
      {initials}
    </span>
  );
}
