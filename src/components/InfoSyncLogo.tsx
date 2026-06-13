type InfoSyncLogoProps = {
  className?: string;
  showTagline?: boolean;
};

export default function InfoSyncLogo({
  className = "",
  showTagline = true,
}: InfoSyncLogoProps) {
  return (
    <span className={`infosync-logo ${className}`.trim()} aria-label="InfoSync">
      <img
        className="infosync-logo-mark"
        src="/brand/infosync-icon.png"
        alt=""
        aria-hidden="true"
      />
      <span className="infosync-logo-copy">
        <span className="infosync-logo-name">
          <span>Info</span>
          <span>Sync</span>
        </span>
        {showTagline && (
          <span className="infosync-logo-tagline">
            DIGITAL DISPLAYS, SIMPLIFIED,
          </span>
        )}
      </span>
    </span>
  );
}
