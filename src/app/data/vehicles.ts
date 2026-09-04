// Vehicle inventory — brief §4.2
import { rebaseDemoDates } from "./demoDates";

export type VehicleStatus = "Available" | "Reserved" | "On Rental" | "In Maintenance" | "Out of Service";
export type VehicleClass = "Pickup" | "Van" | "4-Wheel Truck" | "6-Wheel Truck" | "Sedan";

export type VehicleStatusEvent = {
  status: VehicleStatus;
  at: string;
  // Canonical transition fields. `status` and `at` remain as compatibility
  // aliases for existing reports and old persisted demo records.
  fromStatus?: VehicleStatus | null;
  toStatus?: VehicleStatus;
  actingUser?: string;
  reason?: string;
  bookingId?: string;
  // Legacy fields are read during migration but are never written by the
  // guarded transition API.
  note?: string;
  changedBy?: string;
};

export type MaintenanceLogEntry = {
  date: string;
  type: string;
  cost: number;
  odometerKm: number;
  note: string;
  vendor?: string;
  nextServiceDueKm?: number;
};

export type Vehicle = {
  id: string;
  plateNumber: string;
  vehicleClass: VehicleClass;
  brand: string;
  model: string;
  year: number;
  capacityKg: number;
  homeDepot: string;
  status: VehicleStatus;
  financed: boolean;
  registrationExpiry: string;
  insuranceExpiry: string;
  voluntaryInsuranceExpiry: string;
  taxStickerExpiry: string;
  statusHistory: VehicleStatusEvent[];
  maintenanceLog: MaintenanceLogEntry[];
  created: string;
  updated: string;
};

export const mockVehicles: Vehicle[] = rebaseDemoDates<Vehicle[]>([
  {
    id: "VEH-001", plateNumber: "1กข 2345", vehicleClass: "4-Wheel Truck", brand: "Isuzu", model: "D-Max Cab-4",
    year: 2023, capacityKg: 1500, homeDepot: "Bangkok — Lat Krabang", status: "Reserved", financed: true,
    registrationExpiry: "2027-03-01", insuranceExpiry: "2027-09-10", voluntaryInsuranceExpiry: "2027-09-10",
    taxStickerExpiry: "2027-03-01",
    statusHistory: [
      { status: "Available", at: "2026-06-01 09:00" },
      { status: "Reserved", at: "2026-08-14 08:45", bookingId: "BK-2026-0005", note: "Reserved for BK-2026-0005" },
      { status: "On Rental", at: "2026-08-14 09:00", bookingId: "BK-2026-0005", note: "Rental started — BK-2026-0005" },
      { status: "Available", at: "2026-08-14 18:00", bookingId: "BK-2026-0005", note: "Rental completed — BK-2026-0005" },
      { status: "Reserved", at: "2026-08-29 09:00", bookingId: "BK-2026-0024", note: "Reserved for BK-2026-0024; BK-2026-0014 follows on 15 Sept" },
    ],
    maintenanceLog: [
      { date: "2026-06-15", type: "Scheduled service", cost: 3200, odometerKm: 46000, note: "Oil change, brake check" },
    ],
    created: "2023-02-10 10:00", updated: "2026-08-14 18:00",
  },
  {
    id: "VEH-002", plateNumber: "2กค 5566", vehicleClass: "Van", brand: "Toyota", model: "Hiace",
    year: 2022, capacityKg: 900, homeDepot: "Bangkok — Lat Krabang", status: "Available", financed: true,
    registrationExpiry: "2027-01-15", insuranceExpiry: "2026-08-25", voluntaryInsuranceExpiry: "2026-08-25",
    taxStickerExpiry: "2027-01-15",
    statusHistory: [{ status: "Available", at: "2026-07-28 14:00" }],
    maintenanceLog: [],
    created: "2022-11-05 10:00", updated: "2026-07-28 14:00",
  },
  {
    id: "VEH-003", plateNumber: "3กง 7788", vehicleClass: "Pickup", brand: "Toyota", model: "Hilux Revo",
    year: 2024, capacityKg: 1000, homeDepot: "Nonthaburi", status: "Available", financed: true,
    registrationExpiry: "2027-06-01", insuranceExpiry: "2026-12-01", voluntaryInsuranceExpiry: "2026-12-01",
    taxStickerExpiry: "2027-06-01",
    statusHistory: [
      { status: "On Rental", at: "2026-08-16 08:00", note: "Assigned to BK-2026-0006" },
      { status: "Available", at: "2026-08-23 17:00", note: "Rental completed — BK-2026-0006" },
    ],
    maintenanceLog: [],
    created: "2024-01-20 10:00", updated: "2026-08-23 17:00",
  },
  {
    id: "VEH-004", plateNumber: "4กจ 1122", vehicleClass: "6-Wheel Truck", brand: "Hino", model: "300 Series",
    year: 2021, capacityKg: 3500, homeDepot: "Bangkok — Lat Krabang", status: "In Maintenance", financed: true,
    registrationExpiry: "2026-11-01", insuranceExpiry: "2026-08-20", voluntaryInsuranceExpiry: "2026-08-20",
    taxStickerExpiry: "2026-11-01",
    statusHistory: [{ status: "In Maintenance", at: "2026-08-12 09:00", note: "Suspension repair" }],
    maintenanceLog: [
      { date: "2026-08-12", type: "Repair", cost: 18500, odometerKm: 92100, note: "Rear suspension bushings" },
    ],
    created: "2021-05-14 10:00", updated: "2026-08-12 09:00",
  },
  {
    id: "VEH-005", plateNumber: "5กฉ 3344", vehicleClass: "Van", brand: "Toyota", model: "Hiace",
    year: 2023, capacityKg: 900, homeDepot: "Chonburi", status: "On Rental", financed: true,
    registrationExpiry: "2027-02-14", insuranceExpiry: "2026-10-05", voluntaryInsuranceExpiry: "2026-10-05",
    taxStickerExpiry: "2027-02-14",
    statusHistory: [
      { status: "Reserved", at: "2026-05-28 10:00", bookingId: "BK-2026-0004", note: "Reserved for BK-2026-0004" },
      { status: "On Rental", at: "2026-06-01 08:00", bookingId: "BK-2026-0004", note: "Rental started — BK-2026-0004" },
    ],
    maintenanceLog: [],
    created: "2023-03-18 10:00", updated: "2026-07-15 08:00",
  },
  {
    id: "VEH-006", plateNumber: "6กช 9900", vehicleClass: "4-Wheel Truck", brand: "Isuzu", model: "D-Max Cab-4",
    year: 2020, capacityKg: 1500, homeDepot: "Nonthaburi", status: "On Rental", financed: false,
    registrationExpiry: "2027-09-01", insuranceExpiry: "2027-09-01", voluntaryInsuranceExpiry: "2027-09-01",
    taxStickerExpiry: "2027-09-01",
    statusHistory: [{ status: "On Rental", at: "2026-08-01 08:00", note: "Assigned to BK-2026-0016" }],
    maintenanceLog: [
      { date: "2026-03-01", type: "Scheduled service", cost: 2800, odometerKm: 112000, note: "Full service" },
    ],
    created: "2020-08-22 10:00", updated: "2026-08-01 08:00",
  },
  {
    id: "VEH-007", plateNumber: "7กซ 6677", vehicleClass: "Pickup", brand: "Isuzu", model: "D-Max",
    year: 2024, capacityKg: 1000, homeDepot: "Bangkok — Lat Krabang", status: "Reserved", financed: true,
    registrationExpiry: "2027-07-01", insuranceExpiry: "2027-01-01", voluntaryInsuranceExpiry: "2027-01-01",
    taxStickerExpiry: "2027-07-01",
    statusHistory: [
      { status: "Available", at: "2026-08-11 09:00" },
      { status: "Reserved", at: "2026-08-15 10:00", bookingId: "BK-2026-0017", note: "Reserved for BK-2026-0017" },
    ],
    maintenanceLog: [],
    created: "2024-06-01 10:00", updated: "2026-08-11 09:00",
  },
  {
    id: "VEH-008", vehicleClass: "Sedan", plateNumber: "8กฌ 4455", brand: "Toyota", model: "Camry",
    year: 2022, capacityKg: 450, homeDepot: "Chonburi", status: "Out of Service", financed: false,
    registrationExpiry: "2026-08-18", insuranceExpiry: "2026-08-18", voluntaryInsuranceExpiry: "2026-08-18",
    taxStickerExpiry: "2026-08-18",
    statusHistory: [{ status: "Out of Service", at: "2026-08-13 16:00", note: "Awaiting registration renewal" }],
    maintenanceLog: [],
    created: "2022-09-09 10:00", updated: "2026-08-13 16:00",
  },
  {
    id: "VEH-009", plateNumber: "9กญ 2211", vehicleClass: "Van", brand: "Toyota", model: "Hiace",
    year: 2024, capacityKg: 900, homeDepot: "Bangkok — Lat Krabang", status: "Available", financed: false,
    registrationExpiry: "2027-09-12", insuranceExpiry: "2027-02-18", voluntaryInsuranceExpiry: "2027-02-18",
    taxStickerExpiry: "2027-09-12",
    statusHistory: [{ status: "Available", at: "2026-08-18 09:00", note: "Ready for assignment demo" }],
    maintenanceLog: [],
    created: "2024-09-12 10:00", updated: "2026-08-18 09:00",
  },
  {
    id: "VEH-010", plateNumber: "1ขก 8844", vehicleClass: "4-Wheel Truck", brand: "Isuzu", model: "D-Max Spark",
    year: 2024, capacityKg: 1500, homeDepot: "Nonthaburi", status: "Available", financed: false,
    registrationExpiry: "2027-10-20", insuranceExpiry: "2027-04-15", voluntaryInsuranceExpiry: "2027-04-15",
    taxStickerExpiry: "2027-10-20",
    statusHistory: [{ status: "Available", at: "2026-08-19 09:00", note: "Ready for assignment demo" }],
    maintenanceLog: [],
    created: "2024-10-20 10:00", updated: "2026-08-19 09:00",
  },
]);
