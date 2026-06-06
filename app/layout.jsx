import './globals.css';

export const metadata = {
  title: 'Eufy Viewer',
  description: 'Bekijk je eigen Eufy-camera’s lokaal',
};

const RootLayout = ({ children }) => (
  <html lang="nl">
    <body>{children}</body>
  </html>
);

export default RootLayout;
