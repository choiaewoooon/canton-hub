import Navbar from "./navbar";
import Footer from "./footer";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ch-app">
      <Navbar />
      <main className="ch-main">{children}</main>
      <Footer />
    </div>
  );
}
