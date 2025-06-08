"use client"

import { CloseButton } from "@/components/ui/CloseButton"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <CloseButton />
        {children}
      </body>
    </html>
  )
} 