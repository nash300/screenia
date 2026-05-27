import Link from "next/link";
import "../../landing.css";

export default function PaymentCancelledPage() {
  return (
    <div className="landing-page flow-page">
      <main className="flow-shell flow-result">
        <span className="flow-result-icon warning">!</span>
        <h1>Betalningen avbröts</h1>
        <p>
          Ingen betalning genomfördes. Du kan gå tillbaka till din startlänk och
          försöka igen.
        </p>
        <Link href="/" className="landing-button landing-button-primary">
          Till startsidan
        </Link>
      </main>
    </div>
  );
}
