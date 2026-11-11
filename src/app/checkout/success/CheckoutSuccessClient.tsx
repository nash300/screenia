"use client";

import Link from "next/link";
import { useState } from "react";

export default function CheckoutSuccessClient({ order }: { order: string | null }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const resendActivation = async () => {
    setSending(true);
    const response = await fetch("/api/checkout/activation-resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order, email }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(data.message || "Om ordern är betald skickas en ny aktiveringslänk.");
    setSending(false);
  };

  return (
    <main className="flow-page">
      <section className="flow-state-panel">
        <span className="flow-state-mark" aria-hidden="true">✓</span>
        <p className="landing-eyebrow">Screenia</p>
        <h1>Betalningen är mottagen</h1>
        <p>
          Vi skickar snart ett e-postmeddelande där du väljer lösenord och
          aktiverar kundportalen. Efter aktiveringen kan du lägga upp logotyp,
          prislista, bilder och annat material.
        </p>
        {order && <p className="flow-message">Orderreferens: {order}</p>}
        <div className="flow-card">
          <label className="flow-select-label">
            <span>Fick du ingen aktiveringslänk?</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Din beställnings-e-post" />
          </label>
          <button type="button" onClick={resendActivation} disabled={sending || !order || !email} className="landing-button landing-button-secondary">
            {sending ? "Skickar..." : "Skicka länken igen"}
          </button>
          {message && <p className="flow-message">{message}</p>}
        </div>
        <Link href="/login" className="landing-button landing-button-primary">
          Till kundinloggning
        </Link>
      </section>
    </main>
  );
}
