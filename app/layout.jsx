import './globals.css';

export const metadata = {
  title: 'Eufy Viewer',
  description: 'Bekijk je eigen Eufy-camera’s lokaal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
