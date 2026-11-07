import type { ReactNode } from "react";

type AdminTooltipProps = {
  text: string;
  children: ReactNode;
  className?: string;
};

export function AdminTooltip({ text, children, className = "" }: AdminTooltipProps) {
  return (
    <span className={`admin-tooltip-anchor ${className}`.trim()}>
      {children}
      <span className="admin-tooltip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}

type AdminWorkflowStepIconProps = {
  stage: string;
  complete?: boolean;
};

export function AdminWorkflowStepIcon({
  stage,
  complete = false,
}: AdminWorkflowStepIconProps) {
  return (
    <span
      className={`admin-workflow-step-icon${complete ? " admin-workflow-step-icon-complete" : ""}`}
      aria-hidden="true"
    >
      {complete ? (
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="m5 12.5 4.2 4.2L19 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </svg>
      ) : (
        stage
      )}
    </span>
  );
}
