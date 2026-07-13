import Image from "next/image";

type ScreeniaLogoProps = {
  className?: string;
  showTagline?: boolean;
};

export default function ScreeniaLogo({
  className = "",
}: ScreeniaLogoProps) {
  return (
    <span className={`screenia-logo ${className}`.trim()} aria-label="Screenia">
      <Image
        className="screenia-logo-wordmark"
        src="/brand/screenia-logo-full-transparent.png"
        alt=""
        width={1400}
        height={424}
        aria-hidden="true"
        priority
      />
    </span>
  );
}
