import { Outlet } from "react-router";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Toaster } from "sonner";
import { useScrollToTop } from "../../hooks/useScrollToTop";

export function Layout() {
  useScrollToTop();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#FAFAF7",
            color: "#1C4A3A",
            border: "1px solid #C4B8A8",
            borderRadius: "50px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
          },
        }}
      />
    </div>
  );
}
