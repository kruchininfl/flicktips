import type { ReactNode } from 'react';

// Figma «Вход» / «Инвайт»: the whole screen without the shell, a warm glow and a huge tilted «flick tips»
// in Pacifico behind the card. The font is loaded only here, for these nine letters.
export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-page p-4 [background-image:radial-gradient(ellipse_50%_50%_at_50%_50%,rgb(255_158_31/0.6),rgb(255_158_31/0.3)_45%,transparent)] dark:[background-image:radial-gradient(ellipse_50%_50%_at_50%_50%,rgb(255_158_31/0.25),transparent)]">
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- a decorative face for this screen only */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap&text=flickts"
        precedence="default"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-10 bg-gradient-to-r from-[#ffc76b] to-[#ffa833] bg-clip-text text-center font-[Pacifico] text-[clamp(260px,35vw,500px)] leading-[0.85] tracking-[0.08em] whitespace-nowrap text-transparent opacity-40 select-none dark:opacity-20"
      >
        flick
        <br />
        tips
      </div>
      <div className="relative w-full max-w-[420px]">{children}</div>
    </div>
  );
}
