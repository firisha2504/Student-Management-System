import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface NavLinkProps {
  to: string;
  icon: ReactNode;
  label: string;
}

export function NavLink({ to, icon, label }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
        isActive
          ? "gradient-primary text-white shadow-md shadow-primary/20"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
