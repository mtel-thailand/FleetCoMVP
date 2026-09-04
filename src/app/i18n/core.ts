import { thCms } from "./th-cms";

export type Language = "en" | "th";

const LANGUAGE_KEY = "fleetco_language";

function readInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(LANGUAGE_KEY) === "th" ? "th" : "en";
}

let activeLanguage: Language = readInitialLanguage();
if (typeof document !== "undefined") document.documentElement.lang = activeLanguage;
const languageListeners = new Set<() => void>();

export function getLanguage(): Language {
  return activeLanguage;
}

export function setActiveLanguage(language: Language): void {
  activeLanguage = language;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language;
  }
  languageListeners.forEach((listener) => listener());
}

export function subscribeLanguage(listener: () => void): () => void {
  languageListeners.add(listener);
  return () => languageListeners.delete(listener);
}

// English source copy is intentionally used as the lookup key. This keeps
// translations next to the wording a product reviewer actually sees and
// gives every untranslated/new string a safe English fallback.
const th: Record<string, string> = {
  // App shell and authentication
  "Language": "ภาษา",
  "FleetCo Platform": "แพลตฟอร์ม FleetCo",
  "B2B Fleet Management": "ระบบบริหารจัดการฟลีทรถสำหรับธุรกิจ",
  "Client Self-Service Portal": "พอร์ทัลบริการตนเองสำหรับลูกค้า",
  "Username": "ชื่อผู้ใช้",
  "Password": "รหัสผ่าน",
  "Enter your username": "กรอกชื่อผู้ใช้",
  "Enter your password": "กรอกรหัสผ่าน",
  "Log in": "เข้าสู่ระบบ",
  "Invalid username or password": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
  "Demo Mode": "โหมดสาธิต",
  "Sign in as — FleetCo Team": "เข้าสู่ระบบในนาม — ทีม FleetCo",
  "Sign in as — Thailand Post": "เข้าสู่ระบบในนาม — ไปรษณีย์ไทย",
  "In production this comes from the account, not a picker.": "ในระบบจริง สิทธิ์นี้จะกำหนดจากบัญชีผู้ใช้โดยอัตโนมัติ",
  "Continue": "ดำเนินการต่อ",
  "Collapse navigation": "ย่อเมนูนำทาง",
  "Expand navigation": "ขยายเมนูนำทาง",
  "Close navigation": "ปิดเมนูนำทาง",
  "Open navigation": "เปิดเมนูนำทาง",
  "Notifications": "การแจ้งเตือน",
  "No notifications": "ไม่มีการแจ้งเตือน",
  "Mark all as read": "ทำเครื่องหมายว่าอ่านทั้งหมด",
  "View all notifications": "ดูการแจ้งเตือนทั้งหมด",
  "Notifications ({count} unread)": "การแจ้งเตือน (ยังไม่ได้อ่าน {count} รายการ)",
  "In-App": "ในแอป",
  "To:": "ถึง:",
  "Account Settings": "การตั้งค่าบัญชี",
  "Sign out": "ออกจากระบบ",
  "Log out": "ออกจากระบบ",
  "Logout": "ออกจากระบบ",
  "Reset Demo Data": "รีเซ็ตข้อมูลสาธิต",
  "Reset demo data": "รีเซ็ตข้อมูลสาธิต",
  "Cancel": "ยกเลิก",
  "Confirm": "ยืนยัน",
  "Save": "บันทึก",
  "Save Changes": "บันทึกการเปลี่ยนแปลง",
  "Close": "ปิด",
  "Back": "ย้อนกลับ",
  "Done": "เสร็จสิ้น",
  "Edit": "แก้ไข",
  "Delete": "ลบ",
  "Remove": "นำออก",
  "Add": "เพิ่ม",
  "Create": "สร้าง",
  "Update": "อัปเดต",
  "Submit": "ส่ง",
  "Search": "ค้นหา",
  "Clear": "ล้าง",
  "Clear all": "ล้างทั้งหมด",
  "Reset": "รีเซ็ต",
  "Apply": "นำไปใช้",
  "Download": "ดาวน์โหลด",
  "Print": "พิมพ์",
  "Print / Download PDF": "พิมพ์ / ดาวน์โหลด PDF",
  "Export": "ส่งออก",
  "Export CSV": "ส่งออก CSV",
  "Export Excel": "ส่งออก Excel",
  "Actions": "การดำเนินการ",
  "Action": "การดำเนินการ",
  "Details": "รายละเอียด",
  "View details": "ดูรายละเอียด",
  "View": "ดู",
  "Open": "เปิด",
  "Required": "จำเป็น",
  "Optional": "ไม่บังคับ",
  "Yes": "ใช่",
  "No": "ไม่ใช่",
  "All": "ทั้งหมด",
  "None": "ไม่มี",
  "Any": "ใดก็ได้",
  "Loading…": "กำลังโหลด…",
  "Try again": "ลองอีกครั้ง",
  "Something went wrong": "เกิดข้อผิดพลาด",
  "Soon": "เร็ว ๆ นี้",

  // Navigation and page headings
  "Dashboard": "แดชบอร์ด",
  "Overview": "ภาพรวม",
  "Revenue & Reports": "รายได้และรายงาน",
  "Bookings & Schedule": "การจองและตารางงาน",
  "All Requests": "คำขอทั้งหมด",
  "All Rentals": "การเช่าทั้งหมด",
  "Fleet Calendar": "ปฏิทินฟลีท",
  "Fleet": "ฟลีท",
  "Vehicles": "ยานพาหนะ",
  "Driver Roster": "รายชื่อพนักงานขับรถ",
  "Live Map": "แผนที่แบบเรียลไทม์",
  "Clients": "ลูกค้า",
  "Client Accounts": "บัญชีลูกค้า",
  "Billing": "การเรียกเก็บเงิน",
  "Invoices & Payments": "ใบแจ้งหนี้และการชำระเงิน",
  "Vehicle Financing": "สินเชื่อยานพาหนะ",
  "Portfolio": "พอร์ตสินเชื่อ",
  "Acquisition Simulator": "เครื่องมือจำลองการจัดซื้อ",
  "Admin": "ผู้ดูแลระบบ",
  "Roles & Permissions": "บทบาทและสิทธิ์",
  "Audit Log": "บันทึกการตรวจสอบ",
  "System": "ระบบ",
  "Rentals": "การเช่า",
  "My Requests": "คำขอของฉัน",
  "My Rentals": "การเช่าของฉัน",
  "Reports": "รายงาน",
  "Billing History": "ประวัติการเรียกเก็บเงิน",
  "Company Profile": "ข้อมูลบริษัท",
  "Quotations": "ใบเสนอราคา",
  "Tax Invoices": "ใบกำกับภาษี",
  "Payment Verification": "ตรวจสอบการชำระเงิน",
  "Request a Vehicle": "ขอใช้ยานพาหนะ",

  // Shared table, filters, pagination and empty states
  "Filter": "ตัวกรอง",
  "Filters": "ตัวกรอง",
  "Sort": "เรียงลำดับ",
  "Status": "สถานะ",
  "Date": "วันที่",
  "Data": "ข้อมูล",
  "From": "จาก",
  "To": "ถึง",
  "Start date": "วันที่เริ่มต้น",
  "End date": "วันที่สิ้นสุด",
  "Date range": "ช่วงวันที่",
  "Pick a date": "เลือกวันที่",
  "Select date": "เลือกวันที่",
  "pick end date": "เลือกวันที่สิ้นสุด",
  "Search…": "ค้นหา…",
  "Search by ID, client, or vehicle…": "ค้นหาด้วยรหัส ลูกค้า หรือยานพาหนะ…",
  "No results found": "ไม่พบผลลัพธ์",
  "No records found": "ไม่พบรายการ",
  "No data available": "ไม่มีข้อมูล",
  "Rows per page": "จำนวนแถวต่อหน้า",
  "Previous page": "หน้าก่อนหน้า",
  "Next page": "หน้าถัดไป",
  "Previous": "ก่อนหน้า",
  "Next": "ถัดไป",
  "Page": "หน้า",
  "of": "จาก",
  "Showing": "แสดง",
  "results": "ผลลัพธ์",
  "result": "ผลลัพธ์",
  "Newest first": "ใหม่สุดก่อน",
  "Oldest first": "เก่าสุดก่อน",
  "Name": "ชื่อ",
  "ID": "รหัส",
  "Created": "สร้างเมื่อ",
  "Updated": "อัปเดตเมื่อ",
  "Created at": "สร้างเมื่อ",
  "Last updated": "อัปเดตล่าสุด",
  "Type": "ประเภท",
  "Description": "รายละเอียด",
  "Notes": "หมายเหตุ",
  "Reason": "เหตุผล",
  "Reference": "เลขอ้างอิง",
  "Amount": "จำนวนเงิน",
  "Total": "รวม",
  "Client": "ลูกค้า",
  "Booking": "การจอง",
  "Vehicle": "ยานพาหนะ",
  "Driver": "พนักงานขับรถ",

  // Canonical statuses and workflow labels
  "Requested": "ส่งคำขอแล้ว",
  "Quoted": "เสนอราคาแล้ว",
  "Accepted": "ยอมรับแล้ว",
  "Assigned": "มอบหมายแล้ว",
  "Active": "ใช้งานอยู่",
  "Completed": "เสร็จสิ้น",
  "Declined": "ปฏิเสธแล้ว",
  "Cancelled": "ยกเลิกแล้ว",
  "Draft": "ฉบับร่าง",
  "Issued": "ออกเอกสารแล้ว",
  "Superseded": "แทนที่แล้ว",
  "Unpaid": "ยังไม่ชำระ",
  "Payment Submitted": "ส่งหลักฐานการชำระแล้ว",
  "Paid": "ชำระแล้ว",
  "Overdue": "เกินกำหนด",
  "Due": "ครบกำหนด",
  "Payment Issue": "มีปัญหาการชำระเงิน",
  "Resolved": "แก้ไขแล้ว",
  "Available": "พร้อมใช้งาน",
  "Reserved": "จองแล้ว",
  "Scheduled": "กำหนดการแล้ว",
  "Unavailable": "ไม่พร้อมใช้งาน",
  "On Rental": "อยู่ระหว่างเช่า",
  "In Maintenance": "อยู่ระหว่างซ่อมบำรุง",
  "Out of Service": "งดใช้งาน",
  "On Leave": "ลางาน",
  "Inactive": "ไม่ใช้งาน",
  "Deactivated": "ปิดใช้งาน",
  "Pending": "รอดำเนินการ",
  "Verified": "ตรวจสอบแล้ว",
  "Rejected": "ปฏิเสธแล้ว",
  "Upcoming": "กำลังจะมาถึง",
  "Current": "ปัจจุบัน",
  "Expired": "หมดอายุ",
  "Expiring": "ใกล้หมดอายุ",
  "Valid": "ใช้ได้",
  "Covered": "ครอบคลุม",
  "At Risk": "มีความเสี่ยง",
  "Not Covered": "ไม่ครอบคลุม",

  // Roles
  "Platform Admin": "ผู้ดูแลแพลตฟอร์ม",
  "Operations Manager": "ผู้จัดการฝ่ายปฏิบัติการ",
  "Account / BD Manager": "ผู้จัดการบัญชี / พัฒนาธุรกิจ",
  "Finance Officer": "เจ้าหน้าที่การเงิน",
  "Read-Only": "อ่านอย่างเดียว",
  "Client Admin": "ผู้ดูแลฝั่งลูกค้า",
  "Client Approver / Manager": "ผู้อนุมัติ / ผู้จัดการฝั่งลูกค้า",
  "Client Requester": "ผู้ส่งคำขอฝั่งลูกค้า",
  "Client Finance": "ฝ่ายการเงินฝั่งลูกค้า",

  // Fleet and rentals
  "Pickup": "รถกระบะ",
  "Van": "รถตู้",
  "4-Wheel Truck": "รถบรรทุก 4 ล้อ",
  "6-Wheel Truck": "รถบรรทุก 6 ล้อ",
  "Sedan": "รถเก๋ง",
  "Ad hoc / Daily": "รายครั้ง / รายวัน",
  "Short term": "ระยะสั้น",
  "Medium term": "ระยะกลาง",
  "Long term": "ระยะยาว",
  "Vehicle class": "ประเภทรถ",
  "Vehicle Class": "ประเภทรถ",
  "Rental type": "ประเภทการเช่า",
  "Rental Type": "ประเภทการเช่า",
  "Rental period": "ระยะเวลาเช่า",
  "Quantity": "จำนวน",
  "Plate Number": "ทะเบียนรถ",
  "Plate number": "ทะเบียนรถ",
  "Make & Model": "ยี่ห้อและรุ่น",
  "Brand": "ยี่ห้อ",
  "Model": "รุ่น",
  "Year": "ปี",
  "Capacity": "ความจุ",
  "Odometer": "เลขไมล์",
  "Fuel Type": "ประเภทเชื้อเพลิง",
  "Location": "ตำแหน่ง",
  "Current Location": "ตำแหน่งปัจจุบัน",
  "Pickup location": "จุดรับรถ",
  "Destination": "ปลายทาง",
  "Purpose": "วัตถุประสงค์",
  "Contact person": "ผู้ติดต่อ",
  "Phone": "โทรศัพท์",
  "Email": "อีเมล",
  "License Number": "เลขที่ใบขับขี่",
  "License Class": "ประเภทใบขับขี่",
  "License Expiry": "วันหมดอายุใบขับขี่",
  "Standard": "ทั่วไป",
  "Heavy Vehicle": "รถบรรทุกหนัก",
  "Employment Status": "สถานะการจ้างงาน",
  "Maintenance": "ซ่อมบำรุง",
  "Compliance": "การปฏิบัติตามข้อกำหนด",
  "Insurance": "ประกันภัย",
  "Registration": "ทะเบียน",
  "Inspection": "การตรวจสภาพ",
  "Add Vehicle": "เพิ่มยานพาหนะ",
  "Edit Vehicle": "แก้ไขยานพาหนะ",
  "Add Driver": "เพิ่มพนักงานขับรถ",
  "Edit Driver": "แก้ไขพนักงานขับรถ",
  "Assign vehicle & driver": "มอบหมายรถและพนักงานขับรถ",
  "Report an issue": "รายงานปัญหา",
  "Issue category": "หมวดหมู่ปัญหา",
  "Vehicle issue": "ปัญหายานพาหนะ",
  "Driver issue": "ปัญหาพนักงานขับรถ",
  "Schedule issue": "ปัญหาตารางงาน",
  "Billing issue": "ปัญหาการเรียกเก็บเงิน",
  "Other": "อื่น ๆ",

  // Clients and tax branches
  "Company": "บริษัท",
  "Tax ID": "เลขประจำตัวผู้เสียภาษี",
  "Registered Address": "ที่อยู่จดทะเบียน",
  "Payment Terms": "เงื่อนไขการชำระเงิน",
  "Branch": "สาขา",
  "Branches": "สาขา",
  "Branch Code": "รหัสสาขา",
  "Head Office": "สำนักงานใหญ่",
  "Head Office (สำนักงานใหญ่)": "สำนักงานใหญ่ (Head Office)",
  "Legal Name (Thai)": "ชื่อนิติบุคคล (ภาษาไทย)",
  "Legal Name (English)": "ชื่อนิติบุคคล (ภาษาอังกฤษ)",
  "Registered Address (Thai)": "ที่อยู่จดทะเบียน (ภาษาไทย)",
  "Registered Address (English)": "ที่อยู่จดทะเบียน (ภาษาอังกฤษ)",
  "Tax Branches": "สาขาภาษี",
  "Tax branch": "สาขาภาษี",
  "Add Tax Branch": "เพิ่มสาขาภาษี",
  "Edit Tax Branch": "แก้ไขสาขาภาษี",
  "Add Branch": "เพิ่มสาขา",
  "Deactivate": "ปิดใช้งาน",
  "Deactivate this branch?": "ปิดใช้งานสาขานี้หรือไม่",
  "Already has an active head office.": "มีสำนักงานใหญ่ที่ใช้งานอยู่แล้ว",
  "Branch Locations": "สถานที่สาขา",
  "Users": "ผู้ใช้",
  "Contract": "สัญญา",
  "Rate Card": "ตารางอัตราค่าบริการ",
  "Tax Information": "ข้อมูลภาษี",
  "Company Information": "ข้อมูลบริษัท",

  // Billing, documents and payments (UI outside the document sheets)
  "Quotation": "ใบเสนอราคา",
  "Invoice": "ใบแจ้งหนี้",
  "Tax Invoice": "ใบกำกับภาษี",
  "Document": "เอกสาร",
  "Documents": "เอกสาร",
  "Document No.": "เลขที่เอกสาร",
  "Invoice No.": "เลขที่ใบแจ้งหนี้",
  "Quotation No.": "เลขที่ใบเสนอราคา",
  "Issue Date": "วันที่ออกเอกสาร",
  "Due Date": "วันครบกำหนด",
  "Valid Until": "ใช้ได้ถึง",
  "Subtotal": "ยอดรวมก่อนภาษี",
  "Discount": "ส่วนลด",
  "VAT": "ภาษีมูลค่าเพิ่ม",
  "Grand Total": "ยอดรวมสุทธิ",
  "Amount Due": "ยอดที่ต้องชำระ",
  "Balance Due": "ยอดคงค้าง",
  "Payment": "การชำระเงิน",
  "Payment Date": "วันที่ชำระเงิน",
  "Payment Reference": "เลขอ้างอิงการชำระเงิน",
  "Payment Slip": "หลักฐานการชำระเงิน",
  "Mark as paid": "ทำเครื่องหมายว่าชำระแล้ว",
  "Submit payment": "ส่งข้อมูลการชำระเงิน",
  "Verify payment": "ตรวจสอบการชำระเงิน",
  "Accept quotation": "ยอมรับใบเสนอราคา",
  "Decline quotation": "ปฏิเสธใบเสนอราคา",
  "Issue quotation": "ออกใบเสนอราคา",
  "Issue invoice": "ออกใบแจ้งหนี้",
  "Issue tax invoice": "ออกใบกำกับภาษี",
  "Create quotation": "สร้างใบเสนอราคา",
  "Create invoice": "สร้างใบแจ้งหนี้",
  "Download PDF": "ดาวน์โหลด PDF",
  "PDF downloaded.": "ดาวน์โหลด PDF แล้ว",
  "Could not create the PDF. Please try again.": "ไม่สามารถสร้าง PDF ได้ โปรดลองอีกครั้ง",
  "Payment details": "รายละเอียดการชำระเงิน",
  "Payment information": "ข้อมูลการชำระเงิน",
  "Verification details": "รายละเอียดการตรวจสอบ",
  "No verification required": "ไม่จำเป็นต้องตรวจสอบ",
  "Authorized signature": "ลายมือชื่อผู้มีอำนาจ",
  "Signature": "ลายมือชื่อ",
  "Clear signature": "ล้างลายมือชื่อ",
  "Upload signature": "อัปโหลดลายมือชื่อ",
  "Please choose a PNG file.": "โปรดเลือกไฟล์ PNG",
  "Export ready — downloading...": "ไฟล์ส่งออกพร้อมแล้ว — กำลังดาวน์โหลด…",

  // Account and administration
  "Current Password": "รหัสผ่านปัจจุบัน",
  "New Password": "รหัสผ่านใหม่",
  "Confirm Password": "ยืนยันรหัสผ่าน",
  "Reset Password": "เปลี่ยนรหัสผ่าน",
  "Role": "บทบาท",
  "Permission": "สิทธิ์",
  "Permissions": "สิทธิ์",
  "Read": "อ่าน",
  "Write": "แก้ไข",
  "Date & Time": "วันที่และเวลา",
  "User": "ผู้ใช้",
  "Event": "เหตุการณ์",
  "Changes": "การเปลี่ยนแปลง",

  // Financing and reporting
  "Revenue": "รายได้",
  "Outstanding": "ค้างชำระ",
  "Utilization": "อัตราการใช้งาน",
  "Monthly Revenue": "รายได้รายเดือน",
  "Outstanding Invoices": "ใบแจ้งหนี้ค้างชำระ",
  "Financing Records": "รายการสินเชื่อ",
  "Lender": "ผู้ให้สินเชื่อ",
  "Principal": "เงินต้น",
  "Interest Rate": "อัตราดอกเบี้ย",
  "Term": "ระยะเวลา",
  "Monthly Installment": "ค่างวดรายเดือน",
  "Outstanding Principal": "เงินต้นคงเหลือ",
  "Next Payment": "การชำระครั้งถัดไป",
  "Coverage": "ความครอบคลุม",
  "Add Financing Record": "เพิ่มรายการสินเชื่อ",
  "Run Simulation": "เริ่มการจำลอง",
};

const patterns: Array<[RegExp, (...parts: string[]) => string]> = [
  [/^(\d{1,2}) (ม.ค.|ก.พ.|มี.ค.|เม.ย.|พ.ค.|มิ.ย.|ก.ค.|ส.ค.|ก.ย.|ต.ค.|พ.ย.|ธ.ค.) (\d{4})(?: · (\d{2}:\d{2}))?$/, (day, month, year, time) => {
    const thaiMonths: Record<string, string> = { "ม.ค.": "Jan", "ก.พ.": "Feb", "มี.ค.": "Mar", "เม.ย.": "Apr", "พ.ค.": "May", "มิ.ย.": "Jun", "ก.ค.": "Jul", "ส.ค.": "Aug", "ก.ย.": "Sep", "ต.ค.": "Oct", "พ.ย.": "Nov", "ธ.ค.": "Dec" };
    return formatEnglishDisplayDate(day, thaiMonths[month] ?? month, String(Number(year) - 543), time);
  }],
  [/^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec) (\d{4})(?: · (\d{2}:\d{2}))?$/, (day, month, year, time) => formatEnglishDisplayDate(day, month, year, time)],
  [/^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec)$/, (day, month) => formatEnglishDisplayDate(day, month, String(new Date().getFullYear())) .replace(/\s+\d{4,}$/, "")],
  [/^Showing (\d+)–(\d+) of (\d+)$/, (from, to, total) => `แสดง ${from}–${to} จาก ${total}`],
  [/^Page (\d+) of (\d+)$/, (page, total) => `หน้า ${page} จาก ${total}`],
  [/^(\d+) results?$/, (count) => `${count} ผลลัพธ์`],
  [/^(\d+) sites?$/, (count) => `${count} สถานที่`],
  [/^Back to (.+)$/, (destination) => `กลับไปที่${translate(destination)}`],
  [/^Close (.+)$/, (label) => `ปิดหน้าต่าง${translate(label)}`],
  [/^Open rental details for (.+)$/, (booking) => `เปิดรายละเอียดการเช่า ${booking}`],
  [/^Open booking (.+)$/, (booking) => `เปิดการจอง ${booking}`],
  [/^(Select|Selected) vehicle (.+)$/, (action, plate) => `${translate(action)}ยานพาหนะ ${plate}`],
  [/^(Select|Selected) driver (.+)$/, (action, name) => `${translate(action)}พนักงานขับรถ ${name}`],
  [/^Edit (.+)$/, (label) => `แก้ไข ${label}`],
  [/^Remove (.+)$/, (label) => `นำออก ${label}`],
  [/^Deactivate (.+)$/, (label) => `ปิดใช้งาน ${label}`],
  [/^(\d+) days?$/, (count) => `${count} วัน`],
  [/^(\d+) days? selected$/, (count) => `เลือก ${count} วัน`],
  [/^(\d+) months?$/, (count) => `${count} เดือน`],
  [/^Starts today$/, () => "เริ่มวันนี้"],
  [/^Starts tomorrow$/, () => "เริ่มพรุ่งนี้"],
  [/^Starts in (\d+) days$/, (days) => `เริ่มในอีก ${days} วัน`],
  [/^Starts (\d+) days? ago$/, (days) => `เริ่มเมื่อ ${days} วันที่แล้ว`],
  [/^Ends today$/, () => "สิ้นสุดวันนี้"],
  [/^Ends tomorrow$/, () => "สิ้นสุดพรุ่งนี้"],
  [/^Ends in (\d+) days$/, (days) => `สิ้นสุดในอีก ${days} วัน`],
  [/^Ends (\d+) days? ago$/, (days) => `สิ้นสุดเมื่อ ${days} วันที่แล้ว`],
  [/^0 min ago$/, () => "เมื่อสักครู่"],
  [/^(\d+) min ago$/, (minutes) => `${minutes} นาทีที่แล้ว`],
  [/^(\d+)h ago$/, (hours) => `${hours} ชั่วโมงที่แล้ว`],
  [/^(\d+)d ago$/, (days) => `${days} วันที่แล้ว`],
  [/^Submitted (.+)$/, (date) => `ส่งเมื่อ ${translate(date)}`],
  [/^Ended (.+)$/, (date) => `สิ้นสุดเมื่อ ${translate(date)}`],
  [/^Requested (\d{1,2} .+)$/, (date) => `ส่งคำขอเมื่อ ${translate(date)}`],
  [/^(\d+) urgent$/, (count) => `เร่งด่วน ${count} รายการ`],
  [/^Upcoming \((\d+)d\)$/, (days) => `กำลังจะมาถึง (${days} วัน)`],
  [/^(\d+) unpaid invoices?$/, (count) => `ใบแจ้งหนี้ยังไม่ชำระ ${count} ฉบับ`],
  [/^(\d+) invoices?$/, (count) => `ใบแจ้งหนี้ ${count} ฉบับ`],
  [/^In (\d+) days$/, (days) => `ในอีก ${days} วัน`],
  [/^Capacity available — (\d+) found\.$/, (available) => `มีทรัพยากรเพียงพอ — พบ ${available} รายการ`],
  [/^Capacity available — (\d+) matching vehicles? and (\d+) compatible drivers? found\.$/, (vehicles, drivers) => `มีทรัพยากรเพียงพอ — พบยานพาหนะที่ตรงกัน ${vehicles} คัน และพนักงานขับรถที่มีคุณสมบัติตรง ${drivers} คน`],
  [/^(\d+) required; (\d+) available\.$/, (required, available) => `ต้องใช้ ${required} รายการ; พร้อมใช้งาน ${available} รายการ`],
  [/^(.+) — starts (.+)$/, (booking, date) => `${booking} — เริ่ม ${translate(date)}`],
  [/^(.+) — ends (.+)$/, (booking, date) => `${booking} — สิ้นสุด ${translate(date)}`],
  [/^(Ad hoc \/ Daily|Short term|Medium term|Long term) · (Pickup|Van|4-Wheel Truck|6-Wheel Truck|Sedan)$/, (rental, vehicle) => `${translate(rental)} · ${translate(vehicle)}`],
  [/^(.+) · (\d+)× (Pickup|Van|4-Wheel Truck|6-Wheel Truck|Sedan) · requested by (.+)$/, (booking, count, vehicle, name) => `${booking} · ${count}× ${translate(vehicle)} · ส่งคำขอโดย ${name}`],
  [/^(.+) · (\d+)× (Pickup|Van|4-Wheel Truck|6-Wheel Truck|Sedan) · (.+)$/, (booking, count, vehicle, location) => `${booking} · ${count}× ${translate(vehicle)} · ${location}`],
  [/^(.+) · (\d+) active units? · (.+)$/, (booking, count, location) => `${booking} · ใช้งานอยู่ ${count} คัน · ${location}`],
  [/^(.+) · (\d+) assigned units? · (.+)$/, (booking, count, location) => `${booking} · มอบหมายแล้ว ${count} คัน · ${location}`],
  [/^(.+) was cancelled by the client: (.+)$/, (booking, reason) => `${booking} ถูกลูกค้ายกเลิก: ${reason}`],
  [/^(.+) was cancelled by FleetCo: (.+)$/, (booking, reason) => `${booking} ถูก FleetCo ยกเลิก: ${reason}`],
  [/^Payment reference (.+), (.+)$/, (reference, amount) => `อ้างอิงการชำระเงิน ${reference}, ${amount}`],
  [/^(.+) — booking (.+) advanced to Accepted$/, (amount, booking) => `${amount} — การจอง ${booking} เปลี่ยนเป็นยอมรับแล้ว`],
  [/^Available → Out of Service \(awaiting registration renewal\)$/, () => "พร้อมใช้งาน → งดใช้งาน (รอต่ออายุทะเบียน)"],
  [/^Active → On Leave \((\d{1,2}) (\w+) – (\d{1,2}) (\w+) (\d{4})\)$/, (fromDay, fromMonth, toDay, toMonth, year) => `ใช้งานอยู่ → ลางาน (${formatEnglishDisplayDate(fromDay, fromMonth, year)} – ${formatEnglishDisplayDate(toDay, toMonth, year)})`],
  [/^Vehicle (.+), driver (.+)$/, (vehicle, driver) => `ยานพาหนะ ${vehicle}, พนักงานขับรถ ${driver}`],
  [/^(.+) subtotal, (.+) discount applied — booking (.+)$/, (amount, discount, booking) => `ยอดก่อนภาษี ${amount}, ใช้ส่วนลด ${discount} — การจอง ${booking}`],
  [/^Reference (.+), (.+) — status → Paid$/, (reference, amount) => `อ้างอิง ${reference}, ${amount} — สถานะ → ชำระแล้ว`],
  [/^Updated (Pickup|Van|4-Wheel Truck|6-Wheel Truck|Sedan) \/ (.+) to (.+) per day$/, (vehicle, rental, amount) => `อัปเดต ${translate(vehicle)} / ${translate(rental)} เป็น ${amount} ต่อวัน`],
  [/^(.+) — released after payment verification on (.+)$/, (amount, invoice) => `${amount} — ออกเอกสารหลังตรวจสอบการชำระเงินของ ${invoice}`],
  [/^(.+) due (\d{1,2}) (\w+) (\d{4}) — booking (.+)$/, (amount, day, month, year, booking) => `${amount} ครบกำหนด ${formatEnglishDisplayDate(day, month, year)} — การจอง ${booking}`],
  [/^(.+) subtotal, (.+) volume discount — booking (.+)$/, (amount, discount, booking) => `ยอดก่อนภาษี ${amount}, ส่วนลดตามปริมาณ ${discount} — การจอง ${booking}`],
  [/^Reason: (.+)$/, (reason) => `เหตุผล: ${reason}`],
  [/^Net (\d+) from invoice date$/, (days) => `ชำระภายใน ${days} วันนับจากวันที่ออกใบแจ้งหนี้`],
  [/^Requested by (.+)$/, (name) => `ส่งคำขอโดย ${name}`],
  [/^For (.+)$/, (value) => `สำหรับ ${value}`],
  [/^Due (.+)$/, (date) => `ครบกำหนด ${date}`],
  [/^(.+) doesn't exist or isn't visible to your account\.$/, (subject) => `ไม่พบข้อมูล${translate(subject)} หรือบัญชีของคุณไม่มีสิทธิ์ดูรายการนี้`],
  [/^(.+) doesn't exist\.$/, (subject) => `ไม่พบข้อมูล${translate(subject)}`],
  [/^(.+) cannot be reviewed\.$/, (subject) => `ไม่สามารถตรวจสอบ${translate(subject)}ได้`],
  [/^Tax invoice (.+) has already been issued\.$/, (taxInvoice) => `ออกใบกำกับภาษี ${taxInvoice} แล้ว`],
  [/^This invoice is currently (.+)\.$/, (status) => `ขณะนี้ใบแจ้งหนี้มีสถานะ${translate(status)}`],
  [/^Issued (.+)$/, (date) => `ออกเอกสาร ${date}`],
  [/^Received (.+)$/, (date) => `ได้รับ ${date}`],
  [/^Updated (.+)$/, (date) => `อัปเดต ${date}`],
  [/^Expiring in (\d+) days$/, (days) => `จะหมดอายุใน ${days} วัน`],
  [/^Expired · (.+)$/, (date) => `หมดอายุ · ${date}`],
  [/^Valid · (.+)$/, (date) => `ใช้ได้ · ${date}`],
  [/^Expiring in (\d+) days · (.+)$/, (days, date) => `จะหมดอายุใน ${days} วัน · ${date}`],
  [/^Thailand Post — (.+)$/, (name) => `ไปรษณีย์ไทย — ${name}`],
  [/^Thailand Post submitted payment for (.+) \((.+)\)\.$/, (invoice, reference) => `ไปรษณีย์ไทยส่งข้อมูลการชำระเงินสำหรับ ${invoice} (${reference})`],
  [/^Thailand Post accepted (.+) \((.+)\)\.$/, (quotation, amount) => `ไปรษณีย์ไทยยอมรับ ${quotation} (${amount})`],
  [/^Thailand Post accepted (.+) for booking (.+)\.$/, (quotation, booking) => `ไปรษณีย์ไทยยอมรับ ${quotation} สำหรับการจอง ${booking}`],
  [/^Thailand Post declined (.+) for booking (.+?)(?: — (.+))?\.$/, (quotation, booking, reason) => `ไปรษณีย์ไทยปฏิเสธ ${quotation} สำหรับการจอง ${booking}${reason ? ` — ${reason}` : ""}`],
  [/^Thailand Post declined (.+) — (.+)\.$/, (quotation, reason) => `ไปรษณีย์ไทยปฏิเสธ ${quotation} — ${reason}`],
  [/^New request (.+) — (\d+)× (.+), (.+), (.+)\.$/, (booking, quantity, vehicle, rental, date) => `คำขอใหม่ ${booking} — ${quantity}× ${translate(vehicle)}, ${translate(rental)}, ${translate(date)}`],
  [/^Vehicle (.+) — registration, insurance, and tax sticker all expire (.+)\.$/, (vehicle, date) => `ยานพาหนะ ${vehicle} — ทะเบียน ประกันภัย และป้ายภาษีจะหมดอายุ ${translate(date)}`],
  [/^Pickup truck (.+) and driver (.+) assigned to (.+)\.$/, (vehicle, driver, booking) => `มอบหมายรถกระบะ ${vehicle} และพนักงานขับรถ ${driver} ให้ ${booking} แล้ว`],
  [/^Vehicle and driver assigned to booking (.+)\.$/, (booking) => `มอบหมายรถและพนักงานขับรถให้การจอง ${booking} แล้ว`],
  [/^Invoice (.+) issued — (.+) due (.+)\.$/, (invoice, amount, date) => `ออกใบแจ้งหนี้ ${invoice} แล้ว — ยอด ${amount} ครบกำหนด ${translate(date)}`],
  [/^Invoice (.+) has been issued — (.+) due (.+)\.$/, (invoice, amount, date) => `ออกใบแจ้งหนี้ ${invoice} แล้ว — ยอด ${amount} ครบกำหนด ${translate(date)}`],
  [/^Payment verified for (.+) — tax invoice (.+) issued\.$/, (invoice, taxInvoice) => `ตรวจสอบการชำระเงินสำหรับ ${invoice} แล้ว — ออกใบกำกับภาษี ${taxInvoice} แล้ว`],
  [/^Payment verified — tax invoice (.+) is available for download\.$/, (taxInvoice) => `ตรวจสอบการชำระเงินแล้ว — ดาวน์โหลดใบกำกับภาษี ${taxInvoice} ได้แล้ว`],
  [/^Quotation (.+) is ready for your review(?: — (.+))?\.$/, (quotation, amount) => `ใบเสนอราคา ${quotation} พร้อมให้ตรวจสอบ${amount ? ` — ${amount}` : ""}`],
  [/^Thailand Post marked (.+) as paid \((.+), (.+)\) — verification needed\.$/, (invoice, reference, date) => `ไปรษณีย์ไทยส่งข้อมูลการชำระ ${invoice} (${reference}, ${date}) — รอการตรวจสอบ`],
  [/^Requested by (.+)\.$/, (name) => `ส่งคำขอโดย ${name}`],
  [/^(.+) quoted\.$/, (amount) => `เสนอราคา ${amount}`],
  [/^Accepted at (.+)\.$/, (amount) => `ยอมรับที่ยอด ${amount}`],
  [/^1 vehicle and driver assigned\.$/, () => "มอบหมายรถและพนักงานขับรถ 1 ชุด"],
  [/^(\d+) vehicles and drivers assigned\.$/, (count) => `มอบหมายรถและพนักงานขับรถ ${count} ชุด`],
  [/^in_app \+ email$/, () => "ในแอป + อีเมล"],
];

function formatEnglishDisplayDate(day: string, month: string, year: string, time?: string): string {
  const date = new Date(`${month} ${day}, ${year}${time ? ` ${time}` : ""}`);
  if (Number.isNaN(date.getTime())) return `${day} ${month} ${year}${time ? ` · ${time}` : ""}`;
  const dateText = new Intl.DateTimeFormat(localeFor(), { day: "numeric", month: "short", year: "numeric" }).format(date);
  return time ? `${dateText} · ${time}` : dateText;
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function translate(source: string, values?: Record<string, string | number>, language = activeLanguage): string {
  const interpolated = interpolate(source, values);
  if (language === "en" || !interpolated) return interpolated;

  const leading = interpolated.match(/^\s*/)?.[0] ?? "";
  const trailing = interpolated.match(/\s*$/)?.[0] ?? "";
  const text = interpolated.trim();
  const sourceKey = source.trim();
  const exact = th[sourceKey] ?? thCms[sourceKey] ?? th[text] ?? thCms[text];
  if (exact) return `${leading}${interpolate(exact, values)}${trailing}`;

  for (const [pattern, replacement] of patterns) {
    const match = text.match(pattern);
    if (match) return `${leading}${replacement(...match.slice(1))}${trailing}`;
  }

  return interpolated;
}

export function translateUiValue(value: unknown): unknown {
  if (typeof value === "string") return translate(value);
  if (Array.isArray(value)) return value.map(translateUiValue);
  return value;
}

export function localeFor(language = activeLanguage): string {
  return language === "th" ? "th-TH" : "en-GB";
}

export function formatUiDate(value: string | null | undefined, includeTime = true): string {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized.length === 10 ? `${normalized}T00:00:00` : normalized);
  if (Number.isNaN(date.getTime())) return value;

  const dateText = new Intl.DateTimeFormat(localeFor(), { day: "numeric", month: "short", year: "numeric" }).format(date);
  const hasTime = includeTime && /[ T]\d{2}:\d{2}/.test(value);
  if (!hasTime) return dateText;
  return `${dateText} · ${new Intl.DateTimeFormat(localeFor(), { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)}`;
}

export function formatUiMonthYear(value: Date): string {
  return new Intl.DateTimeFormat(localeFor(), { month: "short", year: "numeric" }).format(value);
}

export function formatBilingualDocumentDate(value: string | null | undefined): string {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized.length === 10 ? `${normalized}T00:00:00` : normalized);
  if (Number.isNaN(date.getTime())) return value;
  const en = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  const thai = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(date);
  return `${en} / ${thai}`;
}

export function formatUiNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeFor(), options).format(value);
}
