import Link from "next/link";
import Image from "next/image";
import "../../landing.css";

export default function PaymentCancelledPage() {
  return (
    <div className="landing-page flow-page flow-result-page">
      <main className="flow-shell flow-result-shell flow-result-shell-warning">
        <section className="flow-result-copy" aria-labelledby="payment-cancelled-title">
          <span className="flow-result-icon warning">!</span>
          <p className="landing-eyebrow">Betalning avbruten</p>
          <h1 id="payment-cancelled-title">Betalningen avbr&ouml;ts</h1>
          <p>
            Ingen betalning genomf&ouml;rdes. Din startl&auml;nk kan anv&auml;ndas igen om
            du vill forts&auml;tta, och du kan alltid kontakta Screenia om n&aring;got
            k&auml;ndes oklart i betalningssteget.
          </p>
          <div className="flow-result-actions">
            <Link href="/" className="landing-button landing-button-primary">
              Till startsidan
            </Link>
            <Link href="/support-service-policy" className="landing-button landing-button-secondary">
              L&auml;s om service
            </Link>
          </div>
        </section>
        <aside className="flow-result-visual" aria-hidden="true">
          <Image
            src="/brand/screenia-helper.png"
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
