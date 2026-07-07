type ScreeniaLogoProps = {
  className?: string;
  showTagline?: boolean;
};

export default function ScreeniaLogo({
  className = "",
  showTagline = true,
}: ScreeniaLogoProps) {
  return (
    <span className={`screenia-logo ${className}`.trim()} aria-label="Screenia">
      <img
        className="screenia-logo-mark"
        src="/brand/infosync-icon.png"
        alt=""
        aria-hidden="true"
      />
      <span className="screenia-logo-copy">
        <span className="screenia-logo-name">
          <span>Screen</span>
          <span>ia</span>
        </span>
        {showTagline && (
          <span className="screenia-logo-tagline">
            DIGITAL DISPLAYS, SIMPLIFIED,
          </span>
        )}
      </span>
    </span>
  );
}
