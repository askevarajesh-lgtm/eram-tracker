"use client";
import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { Icon } from "@/components/Icon";
import { Menu } from "./Menu";
import { ThemeToggle } from "./ThemeToggle";
import { logout } from "@/server/auth";

export type Alerts = {
  issues: number;
  approvals: number | null;
  calendar: number;
  uat: number;
};

export type NotificationItemDTO = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string;
  read: boolean;
  priority: string;
  createdAt: string;
};

type Props = {
  canEdit: boolean;
  canImport: boolean;
  projects: { id: string; name: string }[];
  name: string;
  role: string;
  alerts: Alerts;
  initialUnreadCount?: number;
};

const initials = (n: string) => {
  const w = n.trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] ?? "?").slice(0, 2)).toUpperCase();
};

const timeAgo = (dateStr: string) => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Play dual-tone chime using Web Audio API
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.45);
  } catch {
    // Ignore audio errors if blocked by browser policy
  }
}

export function Header({ name, role, alerts, initialUnreadCount = 0 }: Props) {
  const [tab, setTab] = useState<"unread" | "all" | "counts">("unread");
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<NotificationItemDTO[]>([]);
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission>("default");
  const prevCountRef = useRef(initialUnreadCount);

  // Check desktop notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setDesktopPerm(Notification.permission);
    }
  }, []);

  const requestDesktopPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const p = await Notification.requestPermission();
      setDesktopPerm(p);
      if (p === "granted") {
        new Notification("Eram Tracker", {
          body: "Desktop notifications enabled successfully!",
          icon: "/favicon.ico",
        });
      }
    }
  };

  // Fetch notifications from API
  const refreshNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.items || []);
      const newCount = data.unreadCount || 0;

      // New notification arrived!
      if (newCount > prevCountRef.current) {
        playChime();
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          const latest = (data.items || [])[0];
          if (latest) {
            new Notification(latest.title, {
              body: latest.message,
              icon: "/favicon.ico",
            });
          }
        }
      }
      prevCountRef.current = newCount;
      setUnreadCount(newCount);
    } catch {
      // Ignore network hiccup
    }
  }, []);

  // Poll notifications every 20 seconds
  useEffect(() => {
    refreshNotifications();
    const timer = setInterval(refreshNotifications, 20_000);
    return () => clearInterval(timer);
  }, [refreshNotifications]);

  const markRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    prevCountRef.current = Math.max(0, prevCountRef.current - 1);

    try {
      await fetch(`/api/notifications/${id}`, { method: "POST" });
    } catch {
      // Ignore
    }
  };

  const deleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const wasUnread = notifications.find(n => n.id === id && !n.read);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) {
      setUnreadCount(c => Math.max(0, c - 1));
      prevCountRef.current = Math.max(0, prevCountRef.current - 1);
    }

    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    } catch {
      // Ignore
    }
  };

  const markAllRead = async () => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    prevCountRef.current = 0;

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read-all" }),
      });
    } catch {
      // Ignore
    }
  };

  const clearRead = async () => {
    setNotifications(prev => prev.filter(n => !n.read));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-read" }),
      });
    } catch {
      // Ignore
    }
  };

  const notes = [
    { key: "issues", href: "/issues", label: "Open urgent issues", n: alerts.issues, tone: "bad" },
    ...(alerts.approvals != null ? [{ key: "approvals", href: "/approvals", label: "Waiting for approval", n: alerts.approvals, tone: "warn" }] : []),
    { key: "calendar", href: "/calendar", label: "Meetings planned today", n: alerts.calendar, tone: "info" },
    { key: "uat", href: "/uat", label: "Waiting for user sign-off", n: alerts.uat, tone: "ok" },
  ];

  // The badge displays actual unread notifications, fallback to urgent counts
  const totalBadge = unreadCount > 0 ? unreadCount : alerts.issues + (alerts.approvals ?? 0) + alerts.calendar;

  const typeMeta = (t: string, priority: string) => {
    switch (t) {
      case "meeting":
        return { label: "Meeting", tone: "info" };
      case "task":
        return { label: priority === "urgent" ? "Overdue Task" : "Task", tone: priority === "urgent" ? "bad" : "ok" };
      case "milestone":
        return { label: "Milestone", tone: "warn" };
      case "licence":
        return { label: "Licence", tone: "bad" };
      case "issue":
        return { label: priority === "urgent" ? "SLA Alert" : "Issue", tone: "bad" };
      case "approval":
        return { label: "Approval", tone: "warn" };
      case "standup":
        return { label: "Standup", tone: "warn" };
      default:
        return { label: "Reminder", tone: "warn" };
    }
  };

  const visibleNotifications = tab === "unread" ? notifications.filter(n => !n.read) : notifications;
  const hasReadItems = notifications.some(n => n.read);

  return (
    <header className="top">
      <div className="topin">
        <button
          className="iconbtn navbtn"
          type="button"
          aria-label="Open navigation"
          onClick={() => document.body.classList.add("navopen")}
        >
          <Icon name="menu" />
        </button>

        <div className="tright">
          <ThemeToggle />

          <Menu
            label={totalBadge ? `Notifications (${totalBadge})` : "Notifications"}
            btnClass="ticon"
            popStyle={{
              width: 385,
              maxWidth: "calc(100vw - 20px)",
              padding: 0,
              overflow: "hidden",
              gap: 0,
              borderRadius: 14,
            }}
            trigger={
              <>
                <Icon name="bell" />
                {totalBadge > 0 && <span className="nbadge">{totalBadge > 99 ? "99+" : totalBadge}</span>}
              </>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
              {/* Header with 3 clean tabs */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 12px",
                  borderBottom: "1px solid var(--line)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setTab("unread")}
                    style={{
                      border: "none",
                      background: tab === "unread" ? "var(--sunk)" : "transparent",
                      color: tab === "unread" ? "var(--fg)" : "var(--muted)",
                      fontWeight: tab === "unread" ? 700 : 500,
                      fontSize: 12.5,
                      padding: "4px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Unread
                    {unreadCount > 0 && (
                      <span className="npill bad" style={{ fontSize: 10.5, padding: "0 5px" }}>
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab("all")}
                    style={{
                      border: "none",
                      background: tab === "all" ? "var(--sunk)" : "transparent",
                      color: tab === "all" ? "var(--fg)" : "var(--muted)",
                      fontWeight: tab === "all" ? 700 : 500,
                      fontSize: 12.5,
                      padding: "4px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    All ({notifications.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab("counts")}
                    style={{
                      border: "none",
                      background: tab === "counts" ? "var(--sunk)" : "transparent",
                      color: tab === "counts" ? "var(--fg)" : "var(--muted)",
                      fontWeight: tab === "counts" ? 700 : 500,
                      fontSize: 12.5,
                      padding: "4px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Counts
                  </button>
                </div>

                {tab !== "counts" && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: "var(--accent)",
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "2px 4px",
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                    {tab === "all" && hasReadItems && (
                      <button
                        type="button"
                        onClick={clearRead}
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: "var(--muted)",
                          fontSize: 11.5,
                          padding: "2px 4px",
                        }}
                      >
                        Clear read
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Tab Content */}
              {tab !== "counts" ? (
                <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, padding: "6px" }}>
                  {visibleNotifications.length === 0 ? (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>✓</div>
                      <b>All caught up!</b>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        {tab === "unread" ? "No unread notifications." : "No notifications on record."}
                      </div>
                    </div>
                  ) : (
                    visibleNotifications.map(n => {
                      const meta = typeMeta(n.type, n.priority);
                      return (
                        <div
                          key={n.id}
                          style={{
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            padding: "9px 12px",
                            borderRadius: 10,
                            background: n.read ? "transparent" : "var(--sunk)",
                            border: n.read ? "1px solid transparent" : "1px solid var(--line2)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <Link
                            href={n.link || "/reminders"}
                            onClick={() => !n.read && markRead(n.id)}
                            style={{
                              textDecoration: "none",
                              color: "inherit",
                              display: "block",
                            }}
                          >
                            {/* Meta Top Line */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                              <span
                                className={`npill ${meta.tone}`}
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                {meta.label}
                              </span>

                              <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                                {timeAgo(n.createdAt)}
                              </span>
                            </div>

                            {/* Title */}
                            <div
                              style={{
                                fontWeight: n.read ? 500 : 700,
                                fontSize: 13.5,
                                color: n.read ? "var(--muted)" : "var(--fg)",
                                lineHeight: 1.35,
                                wordBreak: "break-word",
                              }}
                            >
                              {n.title}
                            </div>

                            {/* Message Details */}
                            {n.message && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--muted)",
                                  marginTop: 3,
                                  lineHeight: 1.4,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {n.message}
                              </div>
                            )}
                          </Link>

                          {/* Quick Actions (Mark Read & Dismiss) */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: 6,
                              marginTop: 2,
                              paddingTop: 2,
                            }}
                          >
                            {!n.read && (
                              <button
                                type="button"
                                title="Mark read"
                                onClick={e => markRead(n.id, e)}
                                style={{
                                  border: "none",
                                  background: "none",
                                  cursor: "pointer",
                                  color: "var(--accent)",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                }}
                              >
                                ✓ Mark read
                              </button>
                            )}

                            <button
                              type="button"
                              title="Dismiss"
                              onClick={e => deleteSingle(n.id, e)}
                              style={{
                                border: "none",
                                background: "none",
                                cursor: "pointer",
                                color: "var(--muted)",
                                fontSize: 11,
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {desktopPerm !== "granted" && (
                    <div
                      style={{
                        padding: "8px 12px",
                        marginTop: 4,
                        background: "var(--sunk)",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: 12, color: "var(--fg)" }}>Desktop alerts:</span>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: "2px 10px", fontSize: 11.5 }}
                        onClick={requestDesktopPermission}
                      >
                        Enable alerts
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "6px" }}>
                  {notes.map(x => (
                    <Link key={x.key} href={x.href} className="tpopitem" role="menuitem">
                      <span className={"nico " + x.tone}>
                        <Icon name={x.key as any} />
                      </span>
                      <span className="grow">{x.label}</span>
                      <span className={"npill" + (x.n ? " " + x.tone : "")}>{x.n}</span>
                    </Link>
                  ))}
                </div>
              )}

              <Link
                href="/reminders"
                role="menuitem"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "11px 16px",
                  margin: 0,
                  width: "100%",
                  boxSizing: "border-box",
                  borderTop: "1px solid var(--line)",
                  background: "var(--surface)",
                  color: "var(--accent)",
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                  borderBottomLeftRadius: 14,
                  borderBottomRightRadius: 14,
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--sunk)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
              >
                Open Reminders Dashboard <Icon name="chevR" />
              </Link>
            </div>
          </Menu>

          <Menu
            label="Account menu"
            btnClass="tuser"
            trigger={
              <>
                <span className="uav">
                  {initials(name)}
                  <i />
                </span>
                <span className="utx">
                  <b>{name}</b>
                  <small>{role === "Admin" ? "Administrator" : role}</small>
                </span>
                <Icon name="chevD" className="i uchev" />
              </>
            }
          >
            <div className="tpophead">
              <b>{name}</b>
              <span className="muted">{role}</span>
            </div>
            <Link href="/account" className="tpopitem" role="menuitem">
              <span className="nico">
                <Icon name="account" />
              </span>
              <span className="grow">Account &amp; password</span>
            </Link>
            <form action={logout} className="tpopform">
              <button type="submit" className="tpopitem danger" role="menuitem">
                <span className="nico bad">
                  <Icon name="logout" />
                </span>
                <span className="grow">Sign out</span>
              </button>
            </form>
          </Menu>
        </div>
      </div>
    </header>
  );
}
