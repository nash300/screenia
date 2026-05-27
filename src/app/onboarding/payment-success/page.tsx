import Link from "next/link";
import "../../landing.css";

export default function PaymentSuccessPage() {
  return (
    <div className="landing-page flow-page">
      <main className="flow-shell flow-result">
        <span className="flow-result-icon">✓</span>
        <h1>Betalningen lyckades</h1>
        <p>
          Tack. Din betalning är mottagen och InfoSync förbereder nu nästa steg
          för din skärm.
        </p>
        <Link href="/" className="landing-button landing-button-primary">
          Till startsidan
        </Link>
      </main>
    </div>
  );
}
