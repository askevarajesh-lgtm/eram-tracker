"use client";
import { usePathname } from "next/navigation";
import { navByHref } from "@/lib/nav";
import { PAGES } from "@/lib/pages";
import { Icon, hasIcon } from "@/components/Icon";

export function ModuleHeader() {
  const path = usePathname();
  const nav = navByHref(path);
  const seg = path.split("/")[1] as keyof typeof PAGES;
  // If route is an unmatched or unknown route (like /chat or /404), suppress the module header so NotFoundView has full visual control
  if (!nav && !(seg in PAGES) && path !== "/") {
    return null;
  }
  const key = nav?.key ?? (seg in PAGES ? seg : "home");
  const page = PAGES[key];
  if (!page) return null;
  const title = nav?.label ?? page.title;

  return (
    <div className="mheader">
      <span className="mico">
        <Icon name={hasIcon(key) ? key : "home"} />
      </span>
      <div className="mtx">
        <h1 className="mtitle">{title}</h1>
        <p className="mdesc">{page.subtitle}</p>
      </div>
    </div>
  );
}
