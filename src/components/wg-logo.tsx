import wgLogoAsset from "@/assets/wg-logo.png.asset.json";

export function WGLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={wgLogoAsset.url}
      alt="Grupo WG"
      className={`${className} object-contain`}
      loading="eager"
    />
  );
}
