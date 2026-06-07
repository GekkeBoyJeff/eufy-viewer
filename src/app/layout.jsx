import './globals.css';

export const metadata = {
  title: 'Eufy Viewer',
  description: 'Bekijk je eigen Eufy-camera’s lokaal',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport = {
  themeColor: '#0a0b0d',
};

const RootLayout = ({ children }) => (
  <html lang="nl">
    <body>{children}</body>
  </html>
);

export default RootLayout;
