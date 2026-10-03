// components/Providers.js
'use client';

import { Toaster } from 'sonner';

export default function Providers({ children }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={3500}
      />
    </>
  );
}
