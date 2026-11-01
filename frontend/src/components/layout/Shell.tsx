import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Award,
  CalendarCheck,
  ClipboardList,
  BarChart3,
  BookOpen,
  ChevronDown,
  FlaskConical,
  HelpCircle,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  Settings2,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../features/auth/context";
import { usePageGuide } from "../../features/guidance/use-page-guide";
import { Brand } from "../common";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
export function Shell() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const student = session?.role === "student";
  const guide = usePageGuide(session!, location.pathname, location.search);
  const links = student
    ? [
        {
          to: "/student/dashboard",
          label: "Góc học tập",
          icon: LayoutDashboard,
        },
        { to: "/student/grammar", label: "Khám phá ngữ pháp", icon: BookOpen },
        { to: "/student/practice", label: "Luyện tập", icon: Target },
        { to: "/student/exercises", label: "Bài thầy cô giao", icon: ClipboardList },
        { to: "/student/ai-coach", label: "Cố vấn AI", icon: Sparkles },
        { to: "/student/progress", label: "Tiến bộ của bạn", icon: BarChart3 },
      ]
    : [
        { to: "/teacher/dashboard", label: "Tổng quan", icon: LayoutDashboard },
        { to: "/teacher/students", label: "Học sinh", icon: Users },
        { to: "/teacher/attendance", label: "Điểm danh", icon: CalendarCheck },
        { to: "/teacher/exercises", label: "Giao bài tập", icon: ClipboardList },
        {
          to: "/teacher/question-bank",
          label: "Ngân hàng câu hỏi",
          icon: LibraryBig,
        },
        { to: "/teacher/ai-studio", label: "AI Studio", icon: Sparkles },
        { to: "/teacher/ai-tools", label: "Trợ lý giảng dạy AI", icon: Sparkles },
        {
          to: "/teacher/analytics",
          label: "Phân tích học tập",
          icon: BarChart3,
        },
        ...(session?.role === "admin"
          ? [
              {
                to: "/research/dashboard",
                label: "Nghiên cứu & đánh giá",
                icon: FlaskConical,
              },
            ]
          : []),
      ];
  const current =
    links.find((l) => location.pathname.startsWith(l.to))?.label ??
    "Bài học của bạn";
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);
  const leave = () => {
    logout();
    navigate("/login");
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Đóng menu điều hướng"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`app-sidebar ${open ? "open" : ""}`}
        aria-label="Điều hướng chính"
      >
        <button
          className="icon-button close-sidebar"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <Brand />
        <div className="sidebar-caption eyebrow">
          {student ? "Hành trình của bạn" : "Không gian giáo viên"}
        </div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <l.icon />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-tip">
          <Sparkles size={22} />
          <h3 style={{ fontSize: 13, marginBottom: 6 }}>
            {student ? "Một chút mỗi ngày" : "Dạy học cùng AI"}
          </h3>
          <p className="muted">
            {student
              ? "Mỗi lỗi sai là một cơ hội để hiểu tiếng Anh tốt hơn. Cùng tiến bộ nhé!"
              : "AI gợi ý nội dung. Sự kiểm duyệt của bạn tạo nên chất lượng bài học."}
          </p>
        </div>
        <div className="sidebar-footer">
          <div className="avatar">{student ? "HS" : "GV"}</div>
          <div>
            <h3 style={{ fontSize: 12 }}>
              {student
                ? "Học sinh TenseLab"
                : session?.role === "admin"
                  ? "Quản trị viên"
                  : "Giáo viên"}
            </h3>
            <div className="small muted">
              {session?.demo
                ? "Không gian mẫu"
                : student
                  ? "Học vui, hiểu sâu"
                  : "Quản lý học liệu"}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto"
            onClick={leave}
            aria-label="Đăng xuất"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </aside>
      <div className="app-main">
        {session?.demo && (
          <div className="demo-banner">
            <strong>BẢN MẪU</strong> · Dữ liệu tổng hợp để khám phá giao diện.
            Không phải kết quả học tập hay nghiên cứu thực.
          </div>
        )}
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Mở menu"
              aria-expanded={open}
            >
              <Menu />
            </button>
            <div className="topbar-breadcrumb small muted">
              <Link to={student ? "/student/dashboard" : "/teacher/dashboard"}>
                TenseLab
              </Link>
              <span className="breadcrumb-detail mx-2">/</span>
              <span className="breadcrumb-detail" style={{ color: "var(--foreground)" }}>{current}</span>
            </div>
          </div>
          <div className="topbar-right">
            <span className="date-label small muted">
              Cùng tiến bộ mỗi ngày
            </span>
            <Button variant="outline" size="sm" onClick={guide.startGuide} disabled={guide.starting} data-guide="guide-replay" className="guide-trigger">
              <Sparkles size={15} />
              {guide.starting ? 'Đang mở…' : 'Hướng dẫn'}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="icon-button"
                  aria-label="Trợ giúp"
                  onClick={() => navigate("/help")}
                >
                  <HelpCircle />
                </button>
              </TooltipTrigger>
              <TooltipContent>Hướng dẫn sử dụng</TooltipContent>
            </Tooltip>
            <div className="topbar-divider" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <span className="avatar">{student ? "HS" : "GV"}</span>
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {session?.demo
                    ? "Hồ sơ mẫu"
                    : `ID: ${session?.actorId.slice(0, 12)}`}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    navigate(
                      student ? "/student/progress" : "/teacher/dashboard",
                    )
                  }
                >
                  <Award />
                  Hồ sơ & tiến độ
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/help")}>
                  <Settings2 />
                  Thông tin tài khoản
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={leave}>
                  <LogOut />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main-content" className="page" tabIndex={-1}>
          {guide.showInvitation && (
            <section className="guide-invitation" aria-label="Làm quen với TenseLab">
              <span className="guide-invitation-icon"><Sparkles size={22} /></span>
              <div><h2>{student ? 'Lần đầu ghé TenseLab? Cùng làm quen nhé.' : 'Một phút làm quen, để bắt đầu dễ hơn.'}</h2><p>Mình sẽ chỉ bạn từng bước ngay trên trang này. Bạn có thể xem lại bất cứ lúc nào.</p></div>
              <Button size="sm" onClick={guide.startGuide} disabled={guide.starting}>Chỉ mình với</Button>
              <button className="icon-button" onClick={guide.dismissInvitation} aria-label="Để lúc khác"><X size={17} /></button>
            </section>
          )}
          <Outlet />
        </main>
        <footer className="small muted text-center pb-6">
          TenseLab AI <span className="mx-2">·</span> Hiểu quy tắc. Tự tin diễn
          đạt.{" "}
          <Badge variant="outline" className="ml-2 badge-inline">
            Competition prototype 2026
          </Badge>
        </footer>
      </div>
    </>
  );
}
