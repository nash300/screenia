import Link from "next/link";
import Image from "next/image";
import "../../landing.css";

export default function PaymentSuccessPage() {
  return (
    <div className="landing-page flow-page flow-result-page">
      <main className="flow-shell flow-result-shell">
        <section className="flow-result-copy" aria-labelledby="payment-success-title">
          <span className="flow-result-icon">✓</span>
          <p className="landing-eyebrow">Betalning mottagen</p>
          <h1 id="payment-success-title">Betalningen lyckades</h1>
          <p>
            Tack. Betalningen &auml;r mottagen och vi f&ouml;rbereder din kundportal. Du
            f&aring;r ett e-postmeddelande d&auml;r du kan v&auml;lja l&ouml;senord och
            aktivera kontot.
          </p>
          <div className="flow-result-actions">
            <Link href="/login" className="landing-button landing-button-primary">
              Till inloggning
            </Link>
            <Link
              href="/support-service-policy"
              className="landing-button landing-button-secondary"
            >
              Servicevillkor
            </Link>
          </div>
        </section>
        <aside className="flow-result-visual" aria-hidden="true">
          <Image
            src="/brand/infosync-helper.png"
            alt=""
            width={420}
            height={420}
            priority
          />
        </aside>
      </main>
    </div>
  );
}
