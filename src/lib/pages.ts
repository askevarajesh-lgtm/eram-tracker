// Page titles and subtitles, keyed by route segment (from the original page).
export const PAGES = {
  "home": {
    "title": "ERAM HCM Business Tools Development Stats",
    "subtitle": "Developers' day-to-day activity, task status and all development at a glance"
  },
  "approvals": {
    "title": "Approvals",
    "subtitle": "Urgent work waiting for Admin or Project Manager approval"
  },
  "uat": {
    "title": "UAT & sign-off",
    "subtitle": "Developed items waiting for users to test and accept"
  },
  "plan": {
    "title": "Plan & control",
    "subtitle": "Milestones, change requests, releases, risks and dependencies"
  },
  "reports": {
    "title": "Reports",
    "subtitle": "Trends, delivery stages, issue performance and management summary"
  },
  "health": {
    "title": "Data health",
    "subtitle": "Gaps that make the status report less reliable, with bulk fixes"
  },
  "chat": {
    "title": "Team chat",
    "subtitle": "Internal communication by channel, with @mentions and issue links"
  },
  "issues": {
    "title": "Urgent issues",
    "subtitle": "Raise and track urgent issues by token number, with response-time targets"
  },
  "workload": {
    "title": "Work on hand",
    "subtitle": "What each developer is carrying now, and sharing or handing over work"
  },
  "calendar": {
    "title": "Calendar",
    "subtitle": "Meetings and discussions with users and developers, due dates, reminders and go-lives"
  },
  "reminders": {
    "title": "Reminders",
    "subtitle": "Reminders and messages to developers by email or WhatsApp"
  },
  "admin": {
    "title": "Admin dashboard",
    "subtitle": "Companies, licences and access across the Eram HCM group"
  },
  "daily": {
    "title": "Eram HCM board",
    "subtitle": "Software implementation by company, and today's status"
  },
  "overview": {
    "title": "Development overview",
    "subtitle": "Progress across SAP B1, ATS, CRM and LMS"
  },
  "tasks": {
    "title": "Tasks & assignment",
    "subtitle": "Every development item, who owns it and where it stands"
  },
  "delivered": {
    "title": "Delivered software",
    "subtitle": "Register of developed and completed items"
  },
  "developers": {
    "title": "Developers",
    "subtitle": "Workload and open items per developer"
  },
  "users": {
    "title": "Users & access",
    "subtitle": "Who uses which system, and on which licence"
  },
  "licences": {
    "title": "Licences",
    "subtitle": "Purchased, assigned and available licences, with renewals"
  },
  "modules": {
    "title": "Projects",
    "subtitle": "The systems under development"
  },
  "panel": {
    "title": "Admin panel",
    "subtitle": "Roles and permissions, lists, activity log and data control"
  },
  "manuals": {
    "title": "User manuals",
    "subtitle": "Guides by level (Admin ▸ Manager ▸ Developer), by project and module, with coverage of delivered software"
  },
  "accounts": {
    "title": "Sign-in accounts",
    "subtitle": "The team who use this tracker. New accounts are Admin."
  },
  "account": {
    "title": "My account",
    "subtitle": "Change your password"
  }
} as const;

export type PageKey = keyof typeof PAGES;
