import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import type { VehicleDraft } from "./Vehicles";
import { useVehicles, updateVehicle } from "@/app/lib/vehiclesStore";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { usePageHeader } from "@/app/lib/pageHeaderStore";
import { VehicleDetailContent, VehicleForm } from "./Vehicles";
import { toastSuccess } from "@/app/lib/toast";
import { demoNowStamp } from "@/app/data/demoDates";

function nowStamp() {
  return demoNowStamp();
}

// Routed landing spot for one vehicle. Vehicle records include compliance,
// status history, and maintenance workflows, so this detail view needs real
// page space and a shareable URL instead of a transient overlay.
export function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const vehicles = useVehicles();
  const vehicle = vehicles.find((item) => item.id === id);
  const [editing, setEditing] = useState(false);

  usePageHeader(vehicle?.plateNumber, "Vehicles");

  function handleEditSave(draft: VehicleDraft) {
    if (!vehicle) return;
    updateVehicle(vehicle.id, { ...draft, updated: nowStamp() });
    setEditing(false);
    toastSuccess("Vehicle {plateNumber} updated.", { plateNumber: draft.plateNumber });
  }

  return (
    <div>
      {editing && vehicle && <VehicleForm vehicle={vehicle} onClose={() => setEditing(false)} onSave={handleEditSave} />}
      <Button variant="ghost" size="icon" className="flex items-center gap-1.5 text-xs mb-4"
        onClick={() => navigate("/ops/fleet")}
      >
        <ArrowLeft size={14} /> Back to Vehicles
      </Button>

      {vehicle ? (
        <VehicleDetailContent vehicle={vehicle} onEdit={() => setEditing(true)} />
      ) : (
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FileQuestion}
            title="Vehicle not found"
            subtitle={`${id ?? "This vehicle"} doesn't exist.`}
            action={{ label: "Go to Vehicles", to: "/ops/fleet" }}
          />
        </div>
      )}
    </div>
  );
}
