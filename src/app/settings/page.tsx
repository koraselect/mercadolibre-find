"use client";

import { useState } from "react";
import { Settings, Save } from "lucide-react";

interface FeeSettings {
  marketplaceFeePct: number;
  shippingCost: number;
  taxesPct: number;
  paymentFeePct: number;
  otherCosts: number;
}

const defaultFees: FeeSettings = {
  marketplaceFeePct: 13,
  shippingCost: 0,
  taxesPct: 0,
  paymentFeePct: 0,
  otherCosts: 0,
};

export default function SettingsPage() {
  const [fees, setFees] = useState<FeeSettings>(defaultFees);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("feeSettings", JSON.stringify(fees));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="size-6" />
        <h1 className="text-2xl font-bold">Ajustes</h1>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold mb-4">Perfil de costos</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Configura las comisiones y costos para calcular la rentabilidad.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              Comision ML (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={fees.marketplaceFeePct}
              onChange={(e) =>
                setFees({ ...fees, marketplaceFeePct: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Envio estimado ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={fees.shippingCost}
              onChange={(e) =>
                setFees({ ...fees, shippingCost: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Impuestos (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={fees.taxesPct}
              onChange={(e) =>
                setFees({ ...fees, taxesPct: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Comision pago (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={fees.paymentFeePct}
              onChange={(e) =>
                setFees({ ...fees, paymentFeePct: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Otros costos ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={fees.otherCosts}
              onChange={(e) =>
                setFees({ ...fees, otherCosts: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Save className="size-4" />
          {saved ? "Guardado" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
