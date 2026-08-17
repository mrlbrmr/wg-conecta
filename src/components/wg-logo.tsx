export function WGLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src="/wg-logo.png"
      alt="Grupo WG"
      className={`${className} object-contain`}
      loading="eager"
    />
  );
}
