type ScreeniaPortalGraphicProps = {
  className?: string;
  label?: string;
};

export default function ScreeniaPortalGraphic({
  className = "",
  label = "Screenia dashboard illustration",
}: ScreeniaPortalGraphicProps) {
  return (
    <div className={`screenia-portal-graphic ${className}`.trim()} aria-label={label} role="img">
      <span className="screenia-portal-graphic-orbit screenia-portal-graphic-orbit-one" />
      <span className="screenia-portal-graphic-orbit screenia-portal-graphic-orbit-two" />
      <div className="screenia-portal-graphic-screen">
        <div className="screenia-portal-graphic-screen-top"><span /><span /><span /></div>
        <div className="screenia-portal-graphic-screen-body">
          <div className="screenia-portal-graphic-chart"><span /><span /><span /><span /><span /></div>
          <div className="screenia-portal-graphic-lines"><span /><span /><span /></div>
        </div>
      </div>
      <span className="screenia-portal-graphic-chip screenia-portal-graphic-chip-primary">LIVE</span>
      <span className="screenia-portal-graphic-chip screenia-portal-graphic-chip-secondary">4K</span>
      <span className="screenia-portal-graphic-spark screenia-portal-graphic-spark-one" />
      <span className="screenia-portal-graphic-spark screenia-portal-graphic-spark-two" />
    </div>
  );
}
