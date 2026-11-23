"use client";
import { useActionState, useState } from "react";
import { MailOutlined, LockOutlined } from "@ant-design/icons";
import { LockKeyhole } from "lucide-react";
import { AntInput, AntPassword } from "@/components/ui/antd";
import { login, signup } from "@/server/auth";
import s from "./login.module.css";

type Policy = { hasAccounts: boolean; open: boolean; domain: string | null };

export function LoginForm({ policy, next, appName = "Eram Tracker" }: { policy: Policy; next: string; appName?: string }) {
  const [mode, setMode] = useState<"login" | "signup">(policy.hasAccounts ? "login" : "signup");
  const [loginState, loginAction, loginPending] = useActionState(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState(signup, undefined);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const su = mode === "signup";
  const error = su ? signupState?.error : loginState?.error;
  const pending = su ? signupPending : loginPending;

  const title = !policy.hasAccounts
    ? "Set up Eram Tracker✦!"
    : su
    ? "Create your account✦!"
    : "Welcome to Eram Tracker✦!";

  const sub = !policy.hasAccounts
    ? "Create the first account. It becomes the owner with full admin rights."
    : su
    ? policy.domain
      ? `Use your @${policy.domain} email. All saved data will be stored securely.`
      : "Credentials are only used to authenticate in Eram Tracker. All saved data will be stored in your database."
    : "Credentials are only used to authenticate in Eram Tracker. All saved data will be stored in your database.";

  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

  return (
    <div className={s.cardWrapper}>
      {/* 3D Glass Squircle Icon in Eram teal/cyan theme perched on top of the card */}
      <div className={s.appIcon} aria-hidden="true">
        <div className={s.iconGlow} />
        <div className={s.iconSquircle}>
          <svg viewBox="0 0 38 38" fill="none" className={s.iconGraphic}>
            <defs>
              <linearGradient id="iconStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#ccfbf1" />
                <stop offset="100%" stopColor="#5eead4" />
              </linearGradient>
              <filter id="iconStarBloom" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            {/* Luminous central 4-point star */}
            <path
              d="M19 4 C20 12.5 25.5 18 34 19 C25.5 20 20 25.5 19 34 C18 25.5 12.5 20 4 19 C12.5 18 18 12.5 19 4 Z"
              fill="url(#iconStarGrad)"
              filter="url(#iconStarBloom)"
            />
            {/* 3 horizontal dots across the center */}
            <circle cx="15" cy="19" r="1.3" fill="#ffffff" opacity="0.9" />
            <circle cx="19" cy="19" r="1.5" fill="#ffffff" />
            <circle cx="23" cy="19" r="1.3" fill="#ffffff" opacity="0.9" />
          </svg>
        </div>
      </div>

      <form className={s.card} action={su ? signupAction : loginAction} key={mode}>
        <div className={s.cardHeader}>
          <h1 className={s.title}>{title}</h1>
          <p className={s.sub}>{sub}</p>
        </div>

        <input type="hidden" name="next" value={next} />

        {su && (
          <div className={s.nameRow}>
            <div className={s.fieldCol}>
              <label htmlFor="firstName" className={s.label}>First name</label>
              <AntInput
                id="firstName"
                placeholder="Emily"
                autoComplete="given-name"
                required
                autoFocus
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
            </div>
            <div className={s.fieldCol}>
              <label htmlFor="lastName" className={s.label}>Last name</label>
              <AntInput
                id="lastName"
                placeholder="Jhonson"
                autoComplete="family-name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
            <input type="hidden" name="name" value={fullName} />
          </div>
        )}

        <div className={s.field}>
          <label htmlFor="email" className={s.label}>Email</label>
          <AntInput
            id="email"
            name="email"
            type="email"
            prefix={<MailOutlined className={s.inputIcon} />}
            placeholder="emily@gmail.com"
            autoComplete="username"
            required
            autoFocus={!su}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div className={s.field}>
          <label htmlFor="password" className={s.label}>Password</label>
          <AntPassword
            id="password"
            name="password"
            prefix={<LockOutlined className={s.inputIcon} />}
            placeholder="••••••••••"
            autoComplete={su ? "new-password" : "current-password"}
            required
            minLength={su ? 8 : undefined}
          />
        </div>

        {error && (
          <p className={s.errorMsg} role="alert">
            {error}
          </p>
        )}

        <button className={s.submitBtn} type="submit" disabled={pending}>
          <span>{pending ? "PLEASE WAIT…" : su ? "SIGN UP" : "SIGN IN"}</span>
        </button>

        {policy.hasAccounts && policy.open && (
          <p className={s.switchMode}>
            {su ? "Already have an account? " : "New here? "}
            <button
              type="button"
              className={s.switchBtn}
              onClick={() => {
                setMode(su ? "login" : "signup");
              }}
            >
              {su ? "Sign in" : "Create an account"}
            </button>
          </p>
        )}

        <div className={s.securityNotice}>
          <LockKeyhole size={12} className={s.securityIcon} />
          <span>Secure, private access for your team</span>
        </div>
      </form>
    </div>
  );
}
