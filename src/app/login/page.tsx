import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { signupPolicy } from "@/lib/signup-policy";
import { LoginForm } from "./LoginForm";
import s from "./login.module.css";

export const metadata: Metadata = { title: "Sign in · Eram Tracker" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getViewer()) redirect(next && /^\/(?!\/)/.test(next) ? next : "/");
  const policy = await signupPolicy();
  const appName = process.env.APP_NAME || "Eram Tracker";

  return (
    <div className={s.page}>
      {/* Top corporate branding */}
      <header className={s.topBar}>
        <div className={s.logo}>
          <span className={s.logoMark}>ERAM</span>
          <div className={s.logoInfo}>
            <b>Eram Tracker</b>
            <small>Business Tools · ERAM HCM</small>
          </div>
        </div>
      </header>

      {/* Cosmic background with planetary horizon & floating gems in Eram teal/cyan theme */}
      <div className={s.spaceScene} aria-hidden="true">
        <div className={s.starField} />
        <div className={s.nebulaGlow} />
        <div className={s.planetHorizon} />
        <div className={s.horizonGlow} />

        {/* Floating 3D Sparkle Gems with teal/cyan glow */}
        <div className={`${s.gem} ${s.gemLeft}`}>
          <svg viewBox="0 0 54 54" fill="none" className={s.gemSvg}>
            <defs>
              <linearGradient id="gemGradL" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#ccfbf1" />
                <stop offset="70%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#0f766e" />
              </linearGradient>
              <filter id="gemDropL" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="glow" />
                <feComposite in="SourceGraphic" in2="glow" operator="over" />
              </filter>
            </defs>
            <path
              d="M27 3 C28.5 16 38 25.5 51 27 C38 28.5 28.5 38 27 51 C25.5 38 16 28.5 3 27 C16 25.5 25.5 16 27 3 Z"
              fill="url(#gemGradL)"
              filter="url(#gemDropL)"
            />
            <path
              d="M27 10 C28 19 35 26 44 27 C35 28 28 35 27 44 C26 35 19 28 10 27 C19 26 26 19 27 10 Z"
              fill="#ffffff"
              opacity="0.4"
            />
          </svg>
        </div>

        <div className={`${s.gem} ${s.gemRight}`}>
          <svg viewBox="0 0 50 50" fill="none" className={s.gemSvg}>
            <defs>
              <linearGradient id="gemGradR" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#e0f2fe" />
                <stop offset="75%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <filter id="gemDropR" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="glow" />
                <feComposite in="SourceGraphic" in2="glow" operator="over" />
              </filter>
            </defs>
            <path
              d="M25 3 C26.5 15 35 23.5 47 25 C35 26.5 26.5 35 25 47 C23.5 35 15 26.5 3 25 C15 23.5 23.5 15 25 3 Z"
              fill="url(#gemGradR)"
              filter="url(#gemDropR)"
            />
            <path
              d="M25 9 C26 17 33 24 41 25 C33 26 26 33 25 41 C24 33 17 26 9 25 C17 24 24 17 25 9 Z"
              fill="#ffffff"
              opacity="0.45"
            />
          </svg>
        </div>

        <div className={`${s.gem} ${s.gemFar}`}>
          <svg viewBox="0 0 32 32" fill="none" className={s.gemSvg}>
            <defs>
              <linearGradient id="gemGradF" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#2dd4bf" />
              </linearGradient>
            </defs>
            <path
              d="M16 2 C17 10 22 15 30 16 C22 17 17 22 16 30 C15 22 10 17 2 16 C10 15 15 10 16 2 Z"
              fill="url(#gemGradF)"
              opacity="0.85"
            />
          </svg>
        </div>
      </div>

      {/* Centered Auth Stage */}
      <main className={s.mainStage}>
        <LoginForm policy={policy} next={next ?? "/"} appName={appName} />
      </main>

      {/* Footer copyright */}
      <footer className={s.footer}>
        <span>© ERAM HCM</span>
      </footer>
    </div>
  );
}
