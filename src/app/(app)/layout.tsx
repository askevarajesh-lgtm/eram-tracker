import { requireViewer } from "@/lib/session";
import { db } from "@/lib/db";
import { canEdit, canManage } from "@/lib/permissions";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { ModuleHeader } from "@/components/shell/ModuleHeader";
import { ConfirmModalHost } from "@/components/ui/ConfirmCloseModal";
import { ComposeProvider } from "@/components/shared/compose/Compose";
import pkg from "../../../package.json";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const startOfDay = new Date(new Date().toISOString().slice(0, 10));
  const [tasks, delivered, developers, users, licences, projects, openIssues, uat, projectList, apIssues, apTasks, apChanges, meetingsToday, manuals] = await Promise.all([
    db.task.count(),
    db.task.count({ where: { status: "done" } }),
    db.developer.count(),
    db.accessRecord.count(), // "Users & access" register entries, not app accounts
    db.licence.aggregate({ _sum: { quantity: true } }),
    db.project.count(),
    db.issue.count({ where: { priority: "Urgent", status: { notIn: ["resolved", "closed"] } } }),
    db.task.count({ where: { status: "done", NOT: { acceptStatus: "Accepted" } } }),
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.issue.count({ where: { approvalState: "pending", status: { notIn: ["resolved", "closed"] } } }),
    db.task.count({ where: { approvalState: "pending" } }),
    db.changeRequest.count({ where: { status: { in: ["Submitted", "Under review"] } } }),
    db.meeting.count({ where: { date: startOfDay, status: "Planned" } }),
    db.manual.count(),
  ]);
  const counts = {
    tasks, delivered, developers, users, licences: licences._sum.quantity ?? 0, modules: projects, issues: openIssues, uat,
    approvals: apIssues + apTasks + apChanges, calendar: meetingsToday, manuals,
  };
  return (
    <ComposeProvider>
      <div className="app">
        <Sidebar counts={counts} role={viewer.role} version={pkg.version} />
        <div className="maincol">
          <Header canEdit={canEdit(viewer)} canImport={canManage(viewer)} projects={projectList} name={viewer.name} role={viewer.role}
            alerts={{ issues: openIssues, approvals: canManage(viewer) ? counts.approvals : null, calendar: meetingsToday, uat }} />
          <main className="content">
            <ModuleHeader />
            {children}
          </main>
        </div>
        <ConfirmModalHost />
      </div>
    </ComposeProvider>
  );
}
