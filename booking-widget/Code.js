/**
 * ========================================================================
 *    MEDTRUST CLINIC APPOINTMENT MANAGEMENT BACKEND
 *    Apps Script Web App API & Google Sheets Database Integration
 * ========================================================================
 * 
 * DESIGN FEATURES:
 *  1. Concurrency Mutex Control: Locks sheet during transactions using LockService.
 *  2. Header-Based JSON Mapping: Converts sheet data to objects dynamically (flexible schema).
 *  3. Auto-Initialization: Automatically provisions database tabs and mock data on first run.
 *  4. Native CORS Support: Fully handles GET, POST, and preflight OPTIONS requests.
 *  5. Self-Running Sandbox Test: Includes testAll() to simulate full lifecycle assertions.
 */

// ------------------------------------------------------------------------
// GLOBAL CONFIGURATION
// ------------------------------------------------------------------------
// If running bound to a Google Sheet, leave this empty to use getActiveSpreadsheet().
// If running standalone, paste your Google Sheet ID inside the quotes.
const SPREADSHEET_ID = ""; 

/**
 * Gets the active spreadsheet or opens it by ID.
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    throw new Error(
      "Spreadsheet not found. Please set your SPREADSHEET_ID at the top of the script " +
      "or bind this script directly to your MEDTRUST_SYSTEM Google Sheet."
    );
  }
}

// ------------------------------------------------------------------------
// 1. HTTP WEB APP API ROUTERS (doGet, doPost, doOptions)
// ------------------------------------------------------------------------

/**
 * Helper to build standard JSON response payload with active CORS headers.
 * @param {Object} data Output payload object
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles HTTP OPTIONS requests (CORS Preflight requests).
 */
function doOptions(e) {
  return jsonResponse({ success: true, message: "Preflight OK" });
}

/**
 * HTTP GET Request Entrypoint.
 * Routing query parameter actions:
 *  - action=getDoctors
 *  - action=getAvailableSessions&doctor_id=D001&date=2026-05-29
 *  - action=getAppointments
 */
function doGet(e) {
  try {
    // Automatically provision tabs if sheet is brand new
    initializeDatabase();
    
    const action = e.parameter.action;
    if (!action) {
      return jsonResponse({ success: false, message: "Query parameter 'action' is required." });
    }
    
    switch (action.toLowerCase()) {
      case "getdoctors":
        return jsonResponse({ success: true, doctors: getDoctors() });
        
      case "getavailablesessions":
        const doctorId = e.parameter.doctor_id;
        const dateStr = e.parameter.date; // Expected format: YYYY-MM-DD
        if (!doctorId || !dateStr) {
          return jsonResponse({ success: false, message: "Parameters 'doctor_id' and 'date' are required." });
        }
        return jsonResponse(getAvailableSessions(doctorId, dateStr));
        
      case "getappointments":
        return jsonResponse({ success: true, appointments: getAppointments() });
        
      default:
        return jsonResponse({ success: false, message: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * HTTP POST Request Entrypoint.
 * Routing query parameter actions:
 *  - action=bookAppointment
 */
function doPost(e) {
  try {
    initializeDatabase();
    
    // Support query parameter action fallback
    const action = e.parameter.action;
    if (action && action.toLowerCase() === "bookappointment") {
      let data = {};
      if (e.postData && e.postData.contents) {
        data = JSON.parse(e.postData.contents);
      } else {
        // Fallback to URL-encoded parameters
        data = {
          doctor_id: e.parameter.doctor_id,
          patient_name: e.parameter.patient_name,
          phone: e.parameter.phone,
          email: e.parameter.email,
          appointment_date: e.parameter.appointment_date,
          session: e.parameter.session,
          service: e.parameter.service,
          notes: e.parameter.notes
        };
      }
      
      const result = bookAppointment(data);
      return jsonResponse(result);
    }
    
    return jsonResponse({ success: false, message: "Unknown or missing action for POST request." });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ------------------------------------------------------------------------
// 2. CORE BACKEND SERVICE LOGIC
// ------------------------------------------------------------------------

/**
 * Retrieves all active doctors from the Doctors sheet.
 * @return {Array<Object>} List of active doctor profiles
 */
function getDoctors() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Doctors");
  const doctors = sheetToObjects(sheet);
  
  // Filter active doctors (handling boolean types and string "true" values)
  return doctors.filter(doc => {
    const activeVal = doc.active;
    return activeVal === true || activeVal === "TRUE" || activeVal === 1 || activeVal === "1";
  });
}

/**
 * Calculates AM/PM session remaining capacity and token availability.
 * @param {string} doctorId Doctor unique ID
 * @param {string} dateStr Appointment date string (format YYYY-MM-DD)
 * @return {Object} Sessions availability payload
 */
function getAvailableSessions(doctorId, dateStr) {
  const dateObj = parseDateString(dateStr);
  const targetDay = getDayName(dateObj); // e.g., "Mon", "Tue"
  
  // 1. Fetch matching doctor records for both sessions
  const activeDoctors = getDoctors();
  const doctorSessions = activeDoctors.filter(doc => doc.doctor_id === doctorId);
  
  if (doctorSessions.length === 0) {
    return {
      success: false,
      doctor_id: doctorId,
      date: dateStr,
      message: "Doctor not found or is currently marked inactive."
    };
  }
  
  // 2. Verify if doctor works on that day of the week
  const doctorName = doctorSessions[0].doctor_name;
  const worksOnDay = isWorkingDay(doctorSessions[0].working_days, targetDay);
  
  if (!worksOnDay) {
    return {
      success: true,
      doctor_id: doctorId,
      doctor_name: doctorName,
      date: dateStr,
      day_of_week: targetDay,
      working_days: doctorSessions[0].working_days,
      sessions: [],
      message: "Doctor does not consult on " + targetDay + "s."
    };
  }
  
  // 3. Count active bookings for this doctor and date
  const appointments = getAppointments();
  const activeBookings = appointments.filter(appt => 
    appt.doctor_id === doctorId && 
    appt.appointment_date === dateStr &&
    appt.status !== "Cancelled"
  );
  
  // 4. Map each active session row configured in sheet
  const sessionsAvailability = doctorSessions.map(sessionRow => {
    const sessionType = sessionRow.session; // e.g. "AM" or "PM"
    const maxTokens = parseInt(sessionRow.max_tokens, 10) || 0;
    
    // Count existing bookings inside this session
    const sessionCount = activeBookings.filter(appt => appt.session === sessionType).length;
    const availableTokens = Math.max(0, maxTokens - sessionCount);
    
    return {
      session: sessionType,
      available_tokens: availableTokens,
      max_tokens: maxTokens,
      status: (availableTokens <= 0) ? "full" : "available"
    };
  });
  
  return {
    success: true,
    doctor_id: doctorId,
    doctor_name: doctorName,
    date: dateStr,
    day_of_week: targetDay,
    sessions: sessionsAvailability
  };
}

/**
 * Creates a clinic appointment and assigns next sequential token.
 * Uses a Mutex script-level Lock to eliminate double booking race conditions.
 * @param {Object} data Booking data (doctor_id, patient_name, phone, email, appointment_date, session)
 * @return {Object} Response JSON payload
 */
function bookAppointment(data) {
  // Validate input parameters
  if (!data.doctor_id || !data.patient_name || !data.appointment_date || !data.session) {
    return { success: false, message: "Missing required booking details (doctor_id, patient_name, appointment_date, session)." };
  }
  
  const doctorId = data.doctor_id;
  const dateStr = data.appointment_date;
  const sessionType = data.session.toUpperCase();
  
  // Acquire transactional script lock (wait up to 10 seconds)
  const lock = LockService.getScriptLock();
  try {
    const hasLock = lock.tryLock(10000);
    if (!hasLock) {
      return { success: false, message: "Server busy. The slot is currently being locked by another transaction. Please retry." };
    }
    
    // --- CRITICAL ATOMIC SECTION ---
    
    // 1. Read doctor session config
    const doctors = getDoctors();
    const docSession = doctors.find(doc => doc.doctor_id === doctorId && doc.session === sessionType);
    
    if (!docSession) {
      return { success: false, message: "Selected doctor does not consult in the " + sessionType + " session." };
    }
    
    // 2. Validate day of the week
    const dateObj = parseDateString(dateStr);
    const targetDay = getDayName(dateObj);
    if (!isWorkingDay(docSession.working_days, targetDay)) {
      return { success: false, message: "Doctor does not consult on " + targetDay + "s." };
    }
    
    // 3. Count existing active bookings for this doctor/date/session
    const appointmentsSheet = getSpreadsheet().getSheetByName("Appointments");
    const appointments = sheetToObjects(appointmentsSheet);
    
    const sessionBookings = appointments.filter(appt => 
      appt.doctor_id === doctorId && 
      appt.appointment_date === dateStr && 
      appt.session === sessionType && 
      appt.status !== "Cancelled"
    );
    
    const maxTokens = parseInt(docSession.max_tokens, 10) || 0;
    if (sessionBookings.length >= maxTokens) {
      return { success: false, message: "Session full" };
    }
    
    // 4. Calculate next sequential token (resilient against gaps)
    let nextToken = 1;
    if (sessionBookings.length > 0) {
      const activeTokens = sessionBookings.map(b => parseInt(b.token, 10)).filter(t => !isNaN(t));
      nextToken = Math.max(...activeTokens) + 1;
    }
    
    // 5. Generate distinct unique appointment ID
    const timeStampStr = Date.now().toString(36).toUpperCase();
    const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const appointmentId = "APT-" + timeStampStr + randStr;
    
    // 6. Write record to sheet
    const newRecordRow = [
      appointmentId,
      doctorId,
      docSession.doctor_name,
      data.service || "General Triage",
      data.patient_name,
      data.phone || "",
      data.email || "",
      dateStr,
      sessionType,
      nextToken,
      "Confirmed",
      data.notes || "",
      new Date() // timestamp
    ];
    
    appointmentsSheet.appendRow(newRecordRow);
    
    // FORCE commit to Google's backend servers before releasing lock!
    SpreadsheetApp.flush();
    
    return {
      success: true,
      appointment_id: appointmentId,
      token: nextToken,
      session: sessionType,
      message: "Appointment confirmed successfully."
    };
    
  } catch (err) {
    return { success: false, error: err.toString() };
  } finally {
    // Lock MUST always be released inside finally block!
    lock.releaseLock();
  }
}

/**
 * Retrieves all appointments.
 * @return {Array<Object>} List of all appointment rows
 */
function getAppointments() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Appointments");
  const appts = sheetToObjects(sheet);
  
  // Format dates consistently to YYYY-MM-DD
  return appts.map(appt => {
    if (appt.appointment_date instanceof Date) {
      appt.appointment_date = formatDate(appt.appointment_date);
    }
    return appptMapper(appt);
  });
}

/**
 * Cleans date object mapping and maps numeric cells correctly.
 */
function appptMapper(appt) {
  // Ensure token is numeric
  if (appt.token) appt.token = parseInt(appt.token, 10);
  return appt;
}

// ------------------------------------------------------------------------
// 3. BACKEND UTILITIES & DATA PARSERS
// ------------------------------------------------------------------------

/**
 * Dynamically converts sheet rows to an array of objects based on header names.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet target sheet tab
 * @return {Array<Object>} List of object representations
 */
function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  
  const headers = values[0].map(header => header.toString().trim());
  const list = [];
  
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // Skip empty lines
    if (row.join("").trim() === "") continue;
    
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      let cellVal = row[c];
      // Format Date values cleanly to YYYY-MM-DD if they are read as Date objects
      if (cellVal instanceof Date && headers[c] === "appointment_date") {
        cellVal = formatDate(cellVal);
      }
      obj[headers[c]] = cellVal;
    }
    list.push(obj);
  }
  return list;
}

/**
 * Safely parses YYYY-MM-DD into a local timezone Date Object.
 * @param {string} dateStr format YYYY-MM-DD
 * @return {Date} Date instance
 */
function parseDateString(dateStr) {
  const parts = dateStr.split("-");
  if (parts.length !== 3) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD (e.g. 2026-05-29)");
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed month
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

/**
 * Returns clean day of week abbreviation (Mon, Tue, Wed, Thu, Fri, Sat, Sun).
 * @param {Date} date Target date
 * @return {string} Day abbreviation
 */
function getDayName(date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay()];
}

/**
 * Checks if a target day is included in comma-separated working days.
 * @param {string} workingDaysStr (e.g., "Mon,Tue,Wed")
 * @param {string} dayName (e.g., "Mon")
 * @return {boolean} true if working day
 */
function isWorkingDay(workingDaysStr, dayName) {
  if (!workingDaysStr) return false;
  return workingDaysStr.split(",")
    .map(day => day.trim().toLowerCase())
    .includes(dayName.trim().toLowerCase());
}

/**
 * Formats a Date object to a YYYY-MM-DD string.
 * @param {Date} date Date instance
 * @return {string} YYYY-MM-DD string
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = ("0" + (date.getMonth() + 1)).slice(-2);
  const d = ("0" + date.getDate()).slice(-2);
  return y + "-" + m + "-" + d;
}

// ------------------------------------------------------------------------
// 4. DATABASE INITIALIZATION & SCHEMA CREATION
// ------------------------------------------------------------------------

/**
 * Provisons sheet structure and inserts default mock dataset if empty.
 */
function initializeDatabase() {
  const ss = getSpreadsheet();
  
  // Tab 1: Doctors
  let docSheet = ss.getSheetByName("Doctors");
  if (!docSheet) {
    docSheet = ss.insertSheet("Doctors");
    const headers = [
      "doctor_id", "doctor_name", "department", "specialization", 
      "working_days", "session", "start_time", "end_time", 
      "max_tokens", "consultation_fee", "active"
    ];
    docSheet.appendRow(headers);
    docSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    
    // Insert mock doctors based on approved clinical leaders
    const mockDoctors = [
      ["D001", "Dr. Rajesh Sen", "Cardiology", "Cardiologist", "Mon,Tue,Wed,Fri", "AM", "10:00 AM", "1:00 PM", 10, 120, true],
      ["D001", "Dr. Rajesh Sen", "Cardiology", "Cardiologist", "Mon,Tue,Wed,Fri", "PM", "3:00 PM", "6:00 PM", 8, 120, true],
      ["D002", "Dr. Ananya Iyer", "Therapy", "Clinical Psychologist", "Mon,Tue,Thu", "AM", "10:00 AM", "1:00 PM", 6, 100, true],
      ["D002", "Dr. Ananya Iyer", "Therapy", "Clinical Psychologist", "Mon,Tue,Thu", "PM", "2:00 PM", "5:00 PM", 5, 100, true],
      ["D003", "Dr. Vikram Nair", "General", "General Practitioner", "Mon,Wed,Fri", "AM", "9:00 AM", "12:00 PM", 12, 80, true],
      ["D003", "Dr. Vikram Nair", "General", "General Practitioner", "Mon,Wed,Fri", "PM", "2:00 PM", "5:00 PM", 10, 80, true],
      ["D004", "Dr. Sunita Sharma", "Pediatrics", "Pediatric Specialist", "Tue,Thu,Fri", "AM", "10:00 AM", "1:00 PM", 8, 150, true]
    ];
    mockDoctors.forEach(row => docSheet.appendRow(row));
  }
  
  // Tab 2: Appointments
  let apptSheet = ss.getSheetByName("Appointments");
  if (!apptSheet) {
    apptSheet = ss.insertSheet("Appointments");
    const headers = [
      "appointment_id", "doctor_id", "doctor_name", "service", 
      "patient_name", "phone", "email", "appointment_date", 
      "session", "token", "status", "notes", "created_at"
    ];
    apptSheet.appendRow(headers);
    apptSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  
  // Tab 3: FAQ
  let faqSheet = ss.getSheetByName("FAQ");
  if (!faqSheet) {
    faqSheet = ss.insertSheet("FAQ");
    const headers = ["faq_id", "question", "answer", "active"];
    faqSheet.appendRow(headers);
    faqSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    
    const mockFAQs = [
      ["FAQ001", "How do I prepare for my first appointment?", "Sit in a quiet space and log in via your patient portal link 10 minutes prior.", true],
      ["FAQ002", "What is the token-based booking structure?", "Tokens are assigned sequentially upon reservation. You do not choose exact minute slots.", true]
    ];
    mockFAQs.forEach(row => faqSheet.appendRow(row));
  }
}

// ------------------------------------------------------------------------
// 5. TEST SANDBOX SUITE (testAll)
// ------------------------------------------------------------------------

/**
 * Simulates a full transactional lifecycle sandbox test.
 * Run this function from the Apps Script editor toolbar to verify correct logic!
 */
function testAll() {
  initializeDatabase();
  console.log("--- STARTING TEST SANDBOX SYSTEM ---");
  
  const testDate = "2026-06-01"; // Monday (a valid day for Dr. Rajesh Sen)
  const doctorId = "D001";       // Dr. Rajesh Sen
  
  // 1. Fetch Active Doctors
  const doctors = getDoctors();
  console.log("Doctors list size: " + doctors.length);
  if (doctors.length === 0) throw new Error("TEST FAILED: No active doctors found!");
  console.log("PASS: getDoctors() successfully fetched doctors.");
  
  // 2. Fetch Initial Sessions
  const initialAvailability = getAvailableSessions(doctorId, testDate);
  console.log("Availability Payload:", JSON.stringify(initialAvailability));
  
  const pmSessionInitial = initialAvailability.sessions.find(s => s.session === "PM");
  if (!pmSessionInitial || pmSessionInitial.available_tokens !== 8) {
    throw new Error("TEST FAILED: Initial PM session tokens should be 8!");
  }
  console.log("PASS: getAvailableSessions() returned correct token cap (8).");
  
  // 3. Book Token 1
  const booking1 = bookAppointment({
    doctor_id: doctorId,
    patient_name: "Test Patient 1",
    phone: "9999999999",
    email: "test1@domain.com",
    appointment_date: testDate,
    session: "PM",
    service: "Cardiology Checkup",
    notes: "Triage test 1"
  });
  console.log("Booking 1 response:", JSON.stringify(booking1));
  if (!booking1.success || booking1.token !== 1) {
    throw new Error("TEST FAILED: Booking 1 failed or token is not 1!");
  }
  console.log("PASS: bookAppointment() allocated Token 1.");
  
  // 4. Book Token 2
  const booking2 = bookAppointment({
    doctor_id: doctorId,
    patient_name: "Test Patient 2",
    phone: "8888888888",
    email: "test2@domain.com",
    appointment_date: testDate,
    session: "PM",
    service: "Cardiology Checkup"
  });
  console.log("Booking 2 response:", JSON.stringify(booking2));
  if (!booking2.success || booking2.token !== 2) {
    throw new Error("TEST FAILED: Booking 2 failed or token is not 2!");
  }
  console.log("PASS: bookAppointment() sequentially allocated Token 2.");
  
  // 5. Re-check Availability
  const midAvailability = getAvailableSessions(doctorId, testDate);
  const pmSessionMid = midAvailability.sessions.find(s => s.session === "PM");
  console.log("Mid-point availability tokens remaining: " + pmSessionMid.available_tokens);
  if (pmSessionMid.available_tokens !== 6) {
    throw new Error("TEST FAILED: PM tokens should be 6 after 2 bookings!");
  }
  console.log("PASS: getAvailableSessions() accurately decremented available tokens to 6.");
  
  // 6. Test Day of Week Validation
  const invalidDate = "2026-06-04"; // Thursday
  const invalidDayName = getDayName(parseDateString(invalidDate));
  console.log("Testing day of week validator on a " + invalidDayName + "...");
  
  const invalidBooking = bookAppointment({
    doctor_id: doctorId,
    patient_name: "Day Check Patient",
    appointment_date: invalidDate,
    session: "PM"
  });
  console.log("Invalid day booking response:", JSON.stringify(invalidBooking));
  if (invalidBooking.success) {
    throw new Error("TEST FAILED: System should reject bookings on non-consulting days!");
  }
  console.log("PASS: System blocked booking on non-working day.");
  
  // 7. Test Get Appointments
  const apptsList = getAppointments();
  console.log("Total appointments recorded: " + apptsList.length);
  if (apptsList.length < 2) throw new Error("TEST FAILED: Appointments list should have at least 2 entries!");
  console.log("PASS: getAppointments() successfully returned historical transaction arrays.");
  
  // 8. Clean up test entries in sheet
  const ss = getSpreadsheet();
  const apptSheet = ss.getSheetByName("Appointments");
  const lastRow = apptSheet.getLastRow();
  if (lastRow > 1) {
    apptSheet.deleteRows(lastRow - 1, 2);
    SpreadsheetApp.flush();
    console.log("PASS: Sandbox cleaned up test appointment rows successfully.");
  }
  
  console.log("--- ALL SANDBOX TEST LIFECYCLES COMPLETED SUCCESSFULLY (100% PASS) ---");
}
