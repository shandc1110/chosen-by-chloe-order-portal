import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const tenant = getActiveTenant();

export const metadata: Metadata = {
  title: tenant.storefront.title,
  description: tenant.storefront.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full text-ink">
        <div className="w-full bg-espresso px-4 py-2 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-cream">
            {tenant.storefront.bannerText}
          </p>
        </div>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
