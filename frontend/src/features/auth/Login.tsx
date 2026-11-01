import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "./context";
import { Brand, Notice, PaperArt } from "../../components/common";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { Role } from "../../types";
export function Login() {
  const { session, login, demo } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  if (session)
    return (
      <Navigate
        to={
          session.role === "student"
            ? "/student/dashboard"
            : "/teacher/dashboard"
        }
        replace
      />
    );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setError("");
    try {
      const user = await login(token.trim());
      navigate(
        user.role === "student" ? "/student/dashboard" : "/teacher/dashboard",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }
  function explore(role: Role) {
    demo(role);
    navigate(role === "student" ? "/student/dashboard" : "/teacher/dashboard");
  }
  return (
    <div className="login">
      <section className="login-story">
        <Brand />
        <h1>
          Mỗi ngày một chút,
          <br />
          tiếng Anh thêm tự tin.
        </h1>
        <p>
          Khám phá ngữ pháp theo cách của bạn. Học qua thử thách, hiểu từ những
          lỗi sai.
        </p>
        <PaperArt />
        <div className="login-proof">
          <span className="avatar">
            <BookOpen size={19} />
          </span>
          <span>
            3 thì nền tảng <span className="mx-2">·</span> Hàng ngàn bước tiến
            nhỏ
          </span>
        </div>
      </section>
      <section className="login-main">
        <div className="login-form">
          <span className="eyebrow">Welcome to your learning lab</span>
          <h2 className="mt-3">Chào mừng bạn trở lại 👋</h2>
          <p>Hành trình tiếng Anh của bạn bắt đầu từ đây.</p>
          <form onSubmit={submit}>
            <div className="field">
              <Label htmlFor="access-token">Mã truy cập của bạn</Label>
              <div className="relative">
                <Input
                  id="access-token"
                  type={visible ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Nhập mã do nhà trường cung cấp"
                  autoComplete="off"
                  required
                  maxLength={256}
                  className="h-12 pr-12"
                />
                <button
                  type="button"
                  className="icon-button absolute right-2 top-1"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? "Ẩn mã truy cập" : "Hiện mã truy cập"}
                >
                  {visible ? <EyeOff /> : <Eye />}
                </button>
              </div>
              <p className="small muted">
                Vai trò học sinh hoặc giáo viên được xác định tự động.
              </p>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <Button
              type="submit"
              className="h-12"
              disabled={busy || !token.trim()}
            >
              <KeyRound size={17} />
              {busy ? "Đang xác thực…" : "Vào TenseLab"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="small muted text-center mt-5">
            Chưa có tài khoản?{" "}
            <Link className="text-link" to="/register">
              Hướng dẫn nhận mã
            </Link>
          </p>
          <div className="login-divider">HOẶC KHÁM PHÁ TRƯỚC</div>
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={() => setShowDemo((v) => !v)}
            aria-expanded={showDemo}
          >
            <Sparkles size={17} />
            Khám phá giao diện mẫu
          </Button>
          {showDemo && (
            <>
              <p className="small muted mt-3">
                Không đăng nhập vào hệ thống thật. Mọi dữ liệu trong bản mẫu đều
                là tổng hợp.
              </p>
              <div className="demo-roles">
                <Button variant="secondary" onClick={() => explore("student")}>
                  Góc học sinh
                </Button>
                <Button variant="secondary" onClick={() => explore("teacher")}>
                  Góc giáo viên
                </Button>
                <Button
                  variant="ghost"
                  className="col-span-2"
                  onClick={() => explore("admin")}
                >
                  Quản trị & nghiên cứu mẫu
                </Button>
              </div>
            </>
          )}
          <div className="login-foot">
            <ShieldCheck size={15} className="inline mr-1" />
            Mã truy cập chỉ được gửi đến máy chủ TenseLab.
          </div>
        </div>
      </section>
    </div>
  );
}
