import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import type { AppNotification } from '../../domain/types';
import { formatDateShort, formatTimestamp } from '../../domain/time';

export function NotificationCenter({
  items,
  timeZone,
  onOpen,
  onMarkAll,
}: {
  items: AppNotification[];
  timeZone: string;
  onOpen: (id: string, href: string) => void;
  onMarkAll: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Push delivery is not connected. These alerts stay on this device and omit family and medical details.
      </p>
      {items.length > 0 ? (
        <Button variant="outline" onClick={onMarkAll}>Mark all read</Button>
      ) : (
        <p>No notifications.</p>
      )}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={item.href}
              onClick={() => onOpen(item.id, item.href)}
              className="block rounded-lg border border-border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{item.title}</p>
                {!item.readAt ? <span className="text-sm font-semibold text-info">New</span> : null}
              </div>
              <p className="mt-1">{item.body}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDateShort(item.createdAt.slice(0, 10), timeZone)} {formatTimestamp(item.createdAt, timeZone)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
