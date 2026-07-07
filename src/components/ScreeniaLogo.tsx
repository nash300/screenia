type ScreeniaLogoProps = {
  className?: string;
  showTagline?: boolean;
};

export default function ScreeniaLogo({
  className = "",
}: ScreeniaLogoProps) {
  return (
    <span className={`screenia-logo ${className}`.trim()} aria-label="Screenia">
      <img
        className="screenia-logo-wordmark"
        src="/brand/screenia-logo-full-transparent.png"
        alt=""
        aria-hidden="true"
      />
    </span>
  );
}
