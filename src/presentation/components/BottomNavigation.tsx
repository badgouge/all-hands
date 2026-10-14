import { Bell, ClipboardCheck, Clock, House, Shield, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';

const sailorItems = [
  { to: '/accountability', label: 'Home', icon: House },
  { to: '/muster', label: 'Muster', icon: Shield },
  { to: '/family', label: 'Family', icon: Users },
  { to: '/requests', label: 'Snivel Log', icon: Clock },
  { to: '/notifications', label: 'Alerts', icon: Bell },
];

const teamItem = { to: '/team', label: 'Team', icon: ClipboardCheck };

export function BottomNavigation({ unread, supervisor }: { unread: number; supervisor: boolean }) {
  const items = supervisor
    ? [...sailorItems.slice(0, 4), teamItem, sailorItems[4]]
    : sailorItems;
  return (
    <nav aria-label="Accountability" className="sticky bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      <ul className="flex">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.to === '/accountability'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-center text-xs font-semibold leading-tight',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {item.to === '/notifications' && unread > 0 ? (
                    <span className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                      {unread}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
