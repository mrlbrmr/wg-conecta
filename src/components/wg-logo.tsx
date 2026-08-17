export function WGLogo({
  className = "h-8 w-8",
  variant = "white",
}: {
  className?: string;
  variant?: "white" | "black";
}) {
  return (
    <img
      src={variant === "black" ? "/wg-logo-black.png" : "/wg-logo.png"}
      alt="Grupo WG"
      className={`${className} object-contain`}
      loading="eager"
    />
  );
}
