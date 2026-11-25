"use client";

import React, { useState, useTransition } from "react";
import { changeOwnPassword } from "@/server/accounts";
import { logout } from "@/server/auth";
import { toast } from "@/components/ui/Toaster";
import { AntPassword } from "@/components/ui/antd";
import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import Link from "next/link";
import "../account.css";

export type ProfileData = {
  id: string;
  name: string;
  email: string;
  role: string;
  isOwner: boolean;
  active: boolean;
  createdAt: string;
  developerName: string | null;
  developerTitle: string | null;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
};

export function ProfileView({ profile }: { profile: ProfileData }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, startTransition] = useTransition();

  const handleReset = () => {
    setCur("");
    setNext("");
    setAgain("");
    setError("");
    setSuccess("");
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!cur) {
      setError("Please enter your current password.");
      return;
    }
    if (!next) {
      setError("Please enter a new password.");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== again) {
      setError("The new passwords don't match.");
      return;
    }

    startTransition(async () => {
      const res = await changeOwnPassword(cur, next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCur("");
      setNext("");
      setAgain("");
      setSuccess("Your password has been successfully updated.");
      toast("Password changed successfully");
    });
  };

  return (
    <div className="profile-page-wrap">
      <div className="profile-card">
        {/* Banner with Refined Eram Atmospheric Silhouette SVG */}
        <div className="profile-banner">
          <svg
            className="profile-banner-svg"
            viewBox="0 0 1440 180"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="eramFarMtn" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0f766e" stopOpacity="0.09" />
                <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="eramMidMtn" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0f766e" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0f766e" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id="erammist" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.5" />
              </linearGradient>
            </defs>
            <path
              d="M0,180 L0,105 C180,68 340,110 500,88 C660,65 800,108 980,80 C1160,52 1300,98 1440,78 L1440,180 Z"
              fill="url(#eramFarMtn)"
            />
            <path
              d="M0,180 L0,130 C160,102 300,132 460,112 C620,92 760,128 920,108 C1080,88 1260,122 1440,105 L1440,180 Z"
              fill="url(#eramMidMtn)"
            />
            <rect y="125" width="100%" height="55" fill="url(#erammist)" />
          </svg>
        </div>

        {/* Avatar & Top Action */}
        <div className="profile-avatar-row">
          <div className="profile-avatar-wrap">
            <span>{getInitials(profile.name)}</span>
            <span className="profile-status-dot" title="Account active" />
          </div>

          <div className="profile-top-action">
            {profile.role === "Admin" ? (
              <Link href="/accounts" className="profile-action-btn">
                <span>View team accounts</span>
                <ChevronRight size={14} />
              </Link>
            ) : (
              <button
                type="button"
                className="profile-action-btn"
                onClick={() => toast(`Signed in as ${profile.email}`)}
              >
                <span>Active session</span>
              </button>
            )}
          </div>
        </div>

        {/* Identity row */}
        <div className="profile-identity">
          <div className="profile-name-row">
            <h1 className="profile-name">{profile.name}</h1>
          </div>
          <p className="profile-email">{profile.email}</p>
        </div>

        {/* 4-Item Quick Meta Grid (Full-Width Pod Cards) */}
        <div className="profile-stats-grid">
          <div className="profile-stat-pod">
            <span className="profile-stat-label">Role</span>
            <div className="profile-stat-val">
              <span className="profile-stat-pill">
                {profile.role === "Admin" ? "Administrator" : profile.role}
              </span>
            </div>
          </div>

          <div className="profile-stat-pod">
            <span className="profile-stat-label">Account status</span>
            <div className="profile-stat-val">
              <span className="profile-stat-dot" />
              <span>{profile.active ? "Active" : "Suspended"}</span>
            </div>
          </div>

          <div className="profile-stat-pod">
            <span className="profile-stat-label">Member since</span>
            <div className="profile-stat-val">
              <span>{profile.createdAt}</span>
            </div>
          </div>

          <div className="profile-stat-pod">
            <span className="profile-stat-label">Developer record</span>
            <div className="profile-stat-val" title={profile.developerTitle || ""}>
              <span>{profile.developerName || "Internal Admin"}</span>
            </div>
          </div>
        </div>

        {/* Section: Change password */}
        <div className="profile-section">
          <div className="profile-section-meta">
            <h2 className="profile-section-title">Change password</h2>
            <p className="profile-section-desc">
              Update your password to keep your account secure. Must be at least 8 characters.
            </p>
          </div>

          <div className="profile-section-body">
            <form id="profile-password-form" onSubmit={handlePasswordSubmit} className="profile-pw-fields">
              <div className="profile-field-item">
                <label htmlFor="pw_cur">Current password</label>
                <AntPassword
                  id="pw_cur"
                  autoComplete="current-password"
                  value={cur}
                  onChange={(e) => setCur(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>

              <div className="profile-field-item">
                <label htmlFor="pw_new">New password</label>
                <AntPassword
                  id="pw_new"
                  autoComplete="new-password"
                  minLength={8}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div className="profile-field-item">
                <label htmlFor="pw_again">New password again</label>
                <AntPassword
                  id="pw_again"
                  autoComplete="new-password"
                  minLength={8}
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                  placeholder="Repeat new password"
                />
              </div>

              {error && (
                <div role="alert" className="profile-error-box">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="profile-error-box"
                  style={{
                    background: "color-mix(in srgb, var(--ok) 12%, transparent)",
                    borderColor: "color-mix(in srgb, var(--ok) 30%, transparent)",
                    color: "var(--ok)",
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{success}</span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Section: Log out of all devices */}
        <div className="profile-section">
          <div className="profile-section-meta">
            <h2 className="profile-section-title">Log out of all devices</h2>
            <p className="profile-section-desc">
              Log out of all other active sessions on other devices besides this one.
            </p>
          </div>

          <div className="profile-section-body">
            <div className="profile-logout-container">
              <form action={logout}>
                <button type="submit" className="profile-logout-btn">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Footer Actions (Aligned with 2-Column Grid) */}
        <div className="profile-footer">
          <p className="profile-footer-note">All password updates take effect immediately on next sign-in.</p>
          <div className="profile-footer-actions">
            <button
              type="button"
              className="profile-btn-cancel"
              onClick={handleReset}
              disabled={busy || (!cur && !next && !again && !error && !success)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="profile-password-form"
              className="profile-btn-save"
              disabled={busy || (!cur && !next && !again)}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
