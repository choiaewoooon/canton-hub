import Link from "next/link";

export default function Footer() {
  return (
    <footer className="ch-footer">
      <div className="ch-footer-inner">
        <div className="ch-footer-status">
          <div className="ch-fss">
            <div className="k">
              <span className="s-dot" />
              Network
            </div>
            <div className="v">Operational</div>
            <div className="sub">Last block · 2s ago</div>
          </div>
          <div className="ch-fss">
            <div className="k">Data feeds</div>
            <div className="v">10 / 10 live</div>
            <div className="sub">5s median polling</div>
          </div>
          <div className="ch-fss">
            <div className="k">API latency</div>
            <div className="v">184 ms</div>
            <div className="sub">p95 · last 5 min</div>
          </div>
          <div className="ch-fss">
            <div className="k">Data freshness</div>
            <div className="v">4.2s</div>
            <div className="sub">since last update</div>
          </div>
        </div>

        <div className="ch-footer-grid">
          <div className="ch-footer-brand-col">
            <div className="ch-footer-brand-row">
              <div className="ch-logo-badge">C</div>
              <span className="ch-logo-name">Canton Hub</span>
            </div>
            <p className="desc">
              Canton Network의 가격, 온체인 활동, 거버넌스, 토큰 이코노믹스를 실시간으로 추적합니다.
            </p>
            <div className="ch-footer-social">
              <a href="https://t.me/coblin_ibc" target="_blank" rel="noopener noreferrer" title="Telegram">
                ✈
              </a>
              <a href="#" title="X / Twitter">𝕏</a>
              <a href="#" title="GitHub">◉</a>
              <a href="#" title="RSS">≋</a>
            </div>
          </div>

          <div className="ch-footer-col">
            <div className="col-title">Product</div>
            <ul>
              <li>
                <Link href="/">대시보드</Link>
              </li>
              <li>
                <Link href="/analytics">분석</Link>
              </li>
              <li>
                <Link href="/feed">피드</Link>
              </li>
              <li>
                <a href="#">
                  API{" "}
                  <span
                    style={{
                      fontSize: "9px",
                      color: "var(--canton-lime)",
                      border: "1px solid color-mix(in oklab, var(--canton-lime) 30%, transparent)",
                      padding: "1px 5px",
                      borderRadius: "3px",
                      marginLeft: "4px",
                    }}
                  >
                    BETA
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <div className="ch-footer-col">
            <div className="col-title">Resources</div>
            <ul>
              <li>
                <a href="#">
                  Documentation <span className="ext">↗</span>
                </a>
              </li>
              <li>
                <a href="#">Methodology</a>
              </li>
              <li>
                <a href="#">
                  Status <span className="ext">↗</span>
                </a>
              </li>
              <li>
                <a href="#">Changelog</a>
              </li>
            </ul>
          </div>

          <div className="ch-footer-col">
            <div className="col-title">Company</div>
            <ul>
              <li>
                <a href="#">About</a>
              </li>
              <li>
                <a href="#">
                  Feedback <span className="ext">↗</span>
                </a>
              </li>
              <li>
                <a href="#">Privacy</a>
              </li>
              <li>
                <a href="#">Terms</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="ch-footer-bottom">
          <div className="legal">
            <span>© 2026 Canton Hub</span>
            <span className="sep">·</span>
            <a href="#">Privacy</a>
            <span className="sep">·</span>
            <a href="#">Terms</a>
          </div>
          <div className="ch-footer-disclaimer">
            Not officially affiliated with Canton Network. Information provided on this site is not
            investment advice.
          </div>
        </div>
      </div>
    </footer>
  );
}
