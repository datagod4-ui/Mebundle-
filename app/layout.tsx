import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mebundle.vercel.app";
const siteName = "Mebundle";
const description =
  "Buy affordable MTN, Telecel and AT data bundles in Ghana. Compare bundle options, pay securely with Paystack and track your data order online.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Buy Affordable Data Bundles in Ghana | MTN, Telecel & AT | Mebundle",
    template: "%s | Mebundle",
  },
  description,
  applicationName: siteName,
  category: "technology",
  keywords: [
    "buy data bundles in Ghana",
    "cheap data bundles Ghana",
    "affordable data bundles Ghana",
    "MTN data bundles Ghana",
    "Telecel data bundles Ghana",
    "AT data bundles Ghana",
    "Ghana internet bundles",
    "buy MTN data online",
    "buy Telecel data online",
    "buy AT data online",
    "data reseller Ghana",
  ],
  alternates: { canonical: "/" },
  icons: { icon: "/mark.svg" },
  openGraph: {
    type: "website",
    locale: "en_GH",
    url: siteUrl,
    siteName,
    title: "Buy Affordable Data Bundles in Ghana | Mebundle",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Buy Affordable Data Bundles in Ghana | Mebundle",
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#eef8f1",
  width: "device-width",
  initialScale: 1,
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": siteUrl + "/#organization",
      name: "Mebundle",
      url: siteUrl,
      description,
      areaServed: { "@type": "Country", name: "Ghana" },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+233546495835",
        contactType: "customer support",
        areaServed: "GH",
        availableLanguage: ["English"],
      },
    },
    {
      "@type": "WebSite",
      "@id": siteUrl + "/#website",
      url: siteUrl,
      name: "Mebundle",
      description,
      inLanguage: "en-GH",
      publisher: { "@id": siteUrl + "/#organization" },
    },
    {
      "@type": "WebPage",
      "@id": siteUrl + "/#webpage",
      url: siteUrl,
      name: "Buy Affordable Data Bundles in Ghana | Mebundle",
      description,
      isPartOf: { "@id": siteUrl + "/#website" },
      about: { "@id": siteUrl + "/#organization" },
      inLanguage: "en-GH",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GH">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
