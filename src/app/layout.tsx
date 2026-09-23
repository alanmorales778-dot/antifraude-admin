import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Consorcio Antifraude en Tiempo Real | Red Federal B2B Argentina',
  description:
    'Plataforma B2B de Threat Intelligence para Bancos y Fintechs de Argentina. Hashing Ciego irreversible (SHA-256) y evaluación de riesgo en menos de 50ms.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark h-full bg-[#090d16] text-slate-100 antialiased">
      <body className="min-h-full flex flex-col bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
