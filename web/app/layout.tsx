import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";

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

export const metadata: Metadata = {
  title: "Chosen by Chloe",
  description: "Order your favourites from Chosen by Chloe.",
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
            Chosen by Chloe is now open — carefully chosen by us, beautifully lived by you.
          </p>
        </div>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
