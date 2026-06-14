import Link from "next/link";
import "../../landing.css";

export default function PaymentSuccessPage() {
  return (
    <div className="landing-page flow-page">
      <main className="flow-shell flow-result">
        <span className="flow-result-icon">✓</span>
        <h1>Betalningen lyckades</h1>
        <p>
          Tack. Betalningen är mottagen. Vi skickar ett e-postmeddelande där du
          kan välja lösenord och aktivera din kundportal.
        </p>
        <Link href="/login" className="landing-button landing-button-primary">
          Till inloggning
        </Link>
      </main>
    </div>
  );
}
