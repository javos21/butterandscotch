import type { CSSProperties, ReactNode } from "react";

const INK = "#1B1616";
const RULE = "#D9CFC2";

let siteUrlMissingLogged = false;

/**
 * The public site origin for links in email. Throws when NEXT_PUBLIC_SITE_URL is unset, so a
 * template never renders a relative link. The first missing read is logged.
 */
export function siteUrl(): string {
  const url = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  if (!url) {
    if (!siteUrlMissingLogged) {
      siteUrlMissingLogged = true;
      console.error("[email] NEXT_PUBLIC_SITE_URL is not set; email links cannot be built");
    }
    throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  }
  return url;
}

const WHITE = "#FFFFFF";
/** Clean sans stack. Set on the container too, because Gmail drops <body> styles. */
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const body: CSSProperties = {
  margin: 0,
  padding: 0,
  backgroundColor: WHITE,
  color: INK,
  fontFamily: FONT,
};

const container: CSSProperties = {
  maxWidth: 560,
  margin: "0 auto",
  padding: "24px 16px",
  backgroundColor: WHITE,
  color: INK,
  fontFamily: FONT,
};

export function EmailLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={body}>
        <div style={container}>
          <div style={{ backgroundColor: WHITE, padding: "16px 24px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, color: INK }}>
              Butter & Scotch
            </div>
          </div>
          <div style={{ padding: "24px 8px", lineHeight: 1.5, fontSize: 16 }}>
            {children}
          </div>
          <div
            style={{
              borderTop: `1px solid ${RULE}`,
              padding: "16px 8px",
              fontSize: 12,
              color: INK,
              textAlign: "center",
            }}
          >
            Butter & Scotch, Trinidad.
          </div>
        </div>
      </body>
    </html>
  );
}
