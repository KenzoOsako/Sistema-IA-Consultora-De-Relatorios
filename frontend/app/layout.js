import './globals.css';

export const metadata = {
  title: 'Delta Empreendimentos | Alto Padrão com Qualidade de Vida',
  description:
    'A Delta Empreendimentos transforma sonhos em lares. Empreendimentos residenciais de alto padrão com integração à natureza, qualidade de vida e transparência.',
  keywords: 'delta empreendimentos, imóveis alto padrão, empreendimentos residenciais, qualidade de vida, natureza',
  openGraph: {
    title: 'Delta Empreendimentos | Alto Padrão com Qualidade de Vida',
    description: 'Transformando sonhos em lares há mais de uma década.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Delta Empreendimentos',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#F2F4F7" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
