// Driver roster — brief §4.3

export type DriverEmploymentStatus = "Active" | "On Leave" | "Inactive";
export type LicenseClass = "Standard" | "Heavy Vehicle";

export type Driver = {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  licenseClass: LicenseClass;
  licenseExpiry: string;
  employmentStatus: DriverEmploymentStatus;
  homeVehicleId?: string;
  leaveFrom?: string;
  leaveTo?: string;
  created: string;
  updated: string;
};

export const mockDrivers: Driver[] = [
  {
    id: "DRV-001", name: "Somchai Jaidee", phone: "+66-81-234-5671", licenseNumber: "TH-DL-88213",
    licenseClass: "Heavy Vehicle", licenseExpiry: "2028-04-10", employmentStatus: "Active",
    homeVehicleId: "VEH-001", created: "2023-02-10 10:00", updated: "2026-08-01 08:30",
  },
  {
    id: "DRV-002", name: "Wichai Suksawat", phone: "+66-81-234-5672", licenseNumber: "TH-DL-77104",
    licenseClass: "Standard", licenseExpiry: "2026-09-05", employmentStatus: "Active",
    homeVehicleId: "VEH-002", created: "2022-11-05 10:00", updated: "2026-07-28 14:00",
  },
  {
    id: "DRV-003", name: "Prasert Boonmee", phone: "+66-81-234-5673", licenseNumber: "TH-DL-65299",
    licenseClass: "Standard", licenseExpiry: "2027-11-20", employmentStatus: "Active",
    created: "2024-01-20 10:00", updated: "2026-08-10 11:00",
  },
  {
    id: "DRV-004", name: "Anan Chaiyaporn", phone: "+66-81-234-5674", licenseNumber: "TH-DL-54187",
    licenseClass: "Heavy Vehicle", licenseExpiry: "2027-06-30", employmentStatus: "On Leave",
    homeVehicleId: "VEH-004", leaveFrom: "2026-08-10", leaveTo: "2026-08-20",
    created: "2021-05-14 10:00", updated: "2026-08-09 09:00",
  },
  {
    id: "DRV-005", name: "Kittipong Rattana", phone: "+66-81-234-5675", licenseNumber: "TH-DL-43092",
    licenseClass: "Standard", licenseExpiry: "2028-01-15", employmentStatus: "Active",
    homeVehicleId: "VEH-005", created: "2023-03-18 10:00", updated: "2026-07-15 08:00",
  },
  {
    id: "DRV-006", name: "Niran Phetcharat", phone: "+66-81-234-5676", licenseNumber: "TH-DL-32981",
    licenseClass: "Heavy Vehicle", licenseExpiry: "2026-08-28", employmentStatus: "Active",
    created: "2020-08-22 10:00", updated: "2026-08-05 10:00",
  },
  {
    id: "DRV-007", name: "Somsak Intharat", phone: "+66-81-234-5677", licenseNumber: "TH-DL-21870",
    licenseClass: "Standard", licenseExpiry: "2027-03-12", employmentStatus: "Active",
    homeVehicleId: "VEH-007", created: "2024-06-01 10:00", updated: "2026-08-11 09:00",
  },
  {
    id: "DRV-008", name: "Thawatchai Ngamsri", phone: "+66-81-234-5678", licenseNumber: "TH-DL-10765",
    licenseClass: "Standard", licenseExpiry: "2025-12-01", employmentStatus: "Inactive",
    created: "2019-04-11 10:00", updated: "2026-01-05 10:00",
  },
  {
    id: "DRV-009", name: "Chaiwat Pradit", phone: "+66-81-234-5679", licenseNumber: "TH-DL-94621",
    licenseClass: "Heavy Vehicle", licenseExpiry: "2028-08-30", employmentStatus: "Active",
    homeVehicleId: "VEH-010", created: "2024-10-20 10:00", updated: "2026-08-19 09:00",
  },
  {
    id: "DRV-010", name: "Saran Khamdee", phone: "+66-81-234-5680", licenseNumber: "TH-DL-95742",
    licenseClass: "Standard", licenseExpiry: "2028-11-15", employmentStatus: "Active",
    homeVehicleId: "VEH-009", created: "2024-09-12 10:00", updated: "2026-08-18 09:00",
  },
];
