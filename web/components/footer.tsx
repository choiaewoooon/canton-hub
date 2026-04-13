"use client";

interface FooterProps {
  lang: string;
}

export default function Footer({ lang }: FooterProps) {
  return (
    <footer className="border-t border-canton-border mt-8">
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-gradient-to-br from-canton-lime to-[#a3c93a] rounded-md flex items-center justify-center text-[11px] font-black text-black">
              C
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-300">Canton Hub</div>
              <div className="text-[10px] text-zinc-600">
                {lang === "ko"
                  ? "Canton 네트워크 실시간 대시보드"
                  : "Real-time Canton Network Dashboard"}
              </div>
            </div>
          </div>

          {/* Data sources / attributions */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px]">
            <span className="text-zinc-600">
              {lang === "ko" ? "데이터 출처:" : "Data sources:"}
            </span>
            <a
              href="https://www.coingecko.com/en/api"
              target="_blank"
              rel="noopener"
              className="text-zinc-500 hover:text-canton-lime transition flex items-center gap-1"
            >
              Powered by CoinGecko
            </a>
            <a
              href="https://www.cantonscan.com/"
              target="_blank"
              rel="noopener"
              className="text-zinc-500 hover:text-canton-lime transition"
            >
              CantonScan
            </a>
            <a
              href="https://github.com/canton-foundation/cips"
              target="_blank"
              rel="noopener"
              className="text-zinc-500 hover:text-canton-lime transition"
            >
              Canton CIPs
            </a>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-canton-border/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-[10px] text-zinc-700">
          <div>
            © 2026 Canton Hub.{" "}
            {lang === "ko"
              ? "본 사이트는 Canton Network와 공식적으로 연관되지 않습니다."
              : "Not officially affiliated with Canton Network."}
          </div>
          <div>
            {lang === "ko"
              ? "이 사이트의 정보는 투자 자문이 아닙니다."
              : "Information on this site is not investment advice."}
          </div>
        </div>
      </div>
    </footer>
  );
}
