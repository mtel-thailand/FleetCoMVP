// Vehicle inventory — brief §4.2

export type VehicleStatus = "Available" | "Reserved" | "On Rental" | "In Maintenance" | "Out of Service";
export type VehicleClass = "Pickup" | "Van" | "4-Wheel Truck" | "6-Wheel Truck" | "Sedan";

export type VehicleStatusEvent = {
  status: VehicleStatus;
  at: string;
  note?: string;
};

export type MaintenanceLogEntry = {
  date: string;
  type: string;
  cost: number;
  odometerKm: number;
  note: string;
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
  lastInspection: string;
  odometerKm: number;
  statusHistory: VehicleStatusEvent[];
  maintenanceLog: MaintenanceLogEntry[];
  created: string;
  updated: string;
};

export const mockVehicles: Vehicle[] = [
  {
    id: "VEH-001", plateNumber: "1กข 2345", vehicleClass: "4-Wheel Truck", brand: "Isuzu", model: "D-Max Cab-4",
    year: 2023, capacityKg: 1500, homeDepot: "Bangkok — Lat Krabang", status: "On Rental", financed: true,
    registrationExpiry: "2027-03-01", insuranceExpiry: "2026-09-10", voluntaryInsuranceExpiry: "2026-09-10",
    taxStickerExpiry: "2027-03-01", lastInspection: "2026-06-15", odometerKm: 48210,
    statusHistory: [
      { status: "Available", at: "2026-06-01 09:00" },
      { status: "On Rental", at: "2026-08-01 08:30", note: "Assigned to BK-2026-0005" },
    ],
    maintenanceLog: [
      { date: "2026-06-15", type: "Scheduled service", cost: 3200, odometerKm: 46000, note: "Oil change, brake check" },
    ],
    created: "2023-02-10 10:00", updated: "2026-08-01 08:30",
  },
  {
    id: "VEH-002", plateNumber: "2กค 5566", vehicleClass: "Van", brand: "Toyota", model: "Hiace",
    year: 2022, capacityKg: 900, homeDepot: "Bangkok — Lat Krabang", status: "Available", financed: true,
    registrationExpiry: "2027-01-15", insuranceExpiry: "2026-08-25", voluntaryInsuranceExpiry: "2026-08-25",
    taxStickerExpiry: "2027-01-15", lastInspection: "2026-05-20", odometerKm: 61340,
    statusHistory: [{ status: "Available", at: "2026-07-28 14:00" }],
    maintenanceLog: [],
    created: "2022-11-05 10:00", updated: "2026-07-28 14:00",
  },
  {
    id: "VEH-003", plateNumber: "3กง 7788", vehicleClass: "Pickup", brand: "Toyota", model: "Hilux Revo",
    year: 2024, capacityKg: 1000, homeDepot: "Nonthaburi", status: "On Rental", financed: true,
    registrationExpiry: "2027-06-01", insuranceExpiry: "2026-12-01", voluntaryInsuranceExpiry: "2026-12-01",
    taxStickerExpiry: "2027-06-01", lastInspection: "2026-07-01", odometerKm: 18500,
    statusHistory: [{ status: "On Rental", at: "2026-08-16 08:00", note: "Assigned to BK-2026-0006" }],
    maintenanceLog: [],
    created: "2024-01-20 10:00", updated: "2026-08-16 08:00",
  },
  {
    id: "VEH-004", plateNumber: "4กจ 1122", vehicleClass: "6-Wheel Truck", brand: "Hino", model: "300 Series",
    year: 2021, capacityKg: 3500, homeDepot: "Bangkok — Lat Krabang", status: "In Maintenance", financed: true,
    registrationExpiry: "2026-11-01", insuranceExpiry: "2026-08-20", voluntaryInsuranceExpiry: "2026-08-20",
    taxStickerExpiry: "2026-11-01", lastInspection: "2026-04-10", odometerKm: 92100,
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
    taxStickerExpiry: "2027-02-14", lastInspection: "2026-06-01", odometerKm: 35700,
    statusHistory: [{ status: "On Rental", at: "2026-07-15 08:00", note: "Assigned to BK-2026-0004" }],
    maintenanceLog: [],
    created: "2023-03-18 10:00", updated: "2026-07-15 08:00",
  },
  {
    id: "VEH-006", plateNumber: "6กช 9900", vehicleClass: "4-Wheel Truck", brand: "Isuzu", model: "D-Max Cab-4",
    year: 2020, capacityKg: 1500, homeDepot: "Nonthaburi", status: "On Rental", financed: false,
    registrationExpiry: "2026-09-01", insuranceExpiry: "2026-09-01", voluntaryInsuranceExpiry: "2026-09-01",
    taxStickerExpiry: "2026-09-01", lastInspection: "2026-03-01", odometerKm: 118400,
    statusHistory: [{ status: "On Rental", at: "2026-08-01 08:00", note: "Assigned to BK-2026-0016" }],
    maintenanceLog: [
      { date: "2026-03-01", type: "Scheduled service", cost: 2800, odometerKm: 112000, note: "Full service" },
    ],
    created: "2020-08-22 10:00", updated: "2026-08-01 08:00",
  },
  {
    id: "VEH-007", plateNumber: "7กซ 6677", vehicleClass: "Pickup", brand: "Isuzu", model: "D-Max",
    year: 2024, capacityKg: 1000, homeDepot: "Bangkok — Lat Krabang", status: "Available", financed: true,
    registrationExpiry: "2027-07-01", insuranceExpiry: "2027-01-01", voluntaryInsuranceExpiry: "2027-01-01",
    taxStickerExpiry: "2027-07-01", lastInspection: "2026-07-10", odometerKm: 9200,
    statusHistory: [{ status: "Available", at: "2026-08-11 09:00" }],
    maintenanceLog: [],
    created: "2024-06-01 10:00", updated: "2026-08-11 09:00",
  },
  {
    id: "VEH-008", vehicleClass: "Sedan", plateNumber: "8กฌ 4455", brand: "Toyota", model: "Camry",
    year: 2022, capacityKg: 450, homeDepot: "Chonburi", status: "Out of Service", financed: false,
    registrationExpiry: "2026-08-18", insuranceExpiry: "2026-08-18", voluntaryInsuranceExpiry: "2026-08-18",
    taxStickerExpiry: "2026-08-18", lastInspection: "2026-02-01", odometerKm: 74300,
    statusHistory: [{ status: "Out of Service", at: "2026-08-13 16:00", note: "Awaiting registration renewal" }],
    maintenanceLog: [],
    created: "2022-09-09 10:00", updated: "2026-08-13 16:00",
  },
];
