import "server-only";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { markAllReadAction } from "@/app/_actions/notifications";
import { Button, Card, EmptyState, PageHeader, cn } from "@/components/ui";

export async function NotificationsView({ basePath }: { basePath: string }) {
  const user = await requireUser();

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const adaBelumDibaca = notifications.some((n) => !n.readAt);

  return (
    <div>
      <PageHeader
        title="Notifikasi"
        description="Campaign baru, hasil review, dan kabar payout."
        action={
          adaBelumDibaca ? (
            <form action={markAllReadAction}>
              <input type="hidden" name="path" value={`${basePath}/notifications`} />
              <Button variant="secondary" size="sm" type="submit">
                Tandai semua dibaca
              </Button>
            </form>
          ) : null
        }
      />

      {notifications.length === 0 ? (
        <EmptyState title="Belum ada notifikasi" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {notifications.map((notification) => {
              const isi = (
                <div
                  className={cn(
                    "px-5 py-4",
                    notification.readAt ? "" : "bg-brand-soft/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{notification.title}</p>
                    <span className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{notification.body}</p>
                </div>
              );

              return (
                <li key={notification.id}>
                  {notification.link ? (
                    <Link href={notification.link} className="block hover:bg-surface-muted">
                      {isi}
                    </Link>
                  ) : (
                    isi
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
