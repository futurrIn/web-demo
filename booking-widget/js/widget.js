/*
========================================================================
   PORTABLE CLINICAL SCHEDULER WIDGET JAVASCRIPT
   Clean, Scoped, Responsive State Machine Driven by Google Sheets
========================================================================
*/

// --- Deployed Apps Script Web App URL Endpoint ---
// Pre-configured with your live Google Sheets connection URL!
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw7j1z7mtr5B8B_akLT5WKOof0fxJA2Ahv54Fbb4cHO-DhZEWA6K0K8UBfpvi8ZlLDI/exec"; 

document.addEventListener('DOMContentLoaded', () => {
  initBookingWizardWidget();
});

/* ========================================================================
   CORE BOOKING WIZARD SYSTEM
   ======================================================================== */
function initBookingWizardWidget() {
  const wizard = document.getElementById('bookingWizard');
  if (!wizard) return;

  const panels = wizard.querySelectorAll('.wizard-step-panel');
  const nodes = wizard.querySelectorAll('.wizard-step-node');
  const prevBtn = wizard.querySelector('#wizardPrevBtn');
  const nextBtn = wizard.querySelector('#wizardNextBtn');
  
  let currentStep = 1;
  const totalSteps = 4;

  // Wizard state data
  const bookingData = {
    service: '',
    doctor: '',
    doctor_id: '',
    working_days: '',
    date: '',
    time: '',
    name: '',
    email: '',
    phone: '',
    reason: ''
  };

  // Panel selections
  const serviceOptions = wizard.querySelectorAll('.select-service-opt');
  const calendarDays = wizard.querySelectorAll('.calendar-day-node');
  const timeSlots = wizard.querySelectorAll('.select-session-opt');

  // Option selection logic: Service
  serviceOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      serviceOptions.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      bookingData.service = opt.getAttribute('data-value');
      validateCurrentStep();
    });
  });

  // --- Reset AM/PM Session Plate layouts ---
  const resetSessionPlates = () => {
    timeSlots.forEach(slot => {
      slot.classList.remove('selected');
      slot.style.pointerEvents = 'auto';
      slot.style.opacity = '1';
      const label = slot.querySelector('.badge-avail');
      if (label) {
        label.textContent = "✓ Session Available";
        label.style.color = '#16A34A';
        label.style.backgroundColor = 'rgba(22, 163, 74, 0.08)';
      }
    });
  };

  // --- Dynamic Day of Week Mapper for June 2026 ---
  const getDayOfWeekName = (dayNumber) => {
    // June 1, 2026 was a Monday (index 1)
    const startDayOffset = 1; 
    const dayIndex = (startDayOffset + (dayNumber - 1)) % 7;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sa"];
    return dayNames[dayIndex];
  };

  // --- Enable/Disable calendar days based on selected doctor working days ---
  const updateCalendarDisplayForDoctor = (workingDaysStr) => {
    const workingDaysList = workingDaysStr.split(',').map(d => d.trim().toLowerCase());

    calendarDays.forEach(day => {
      const dayNum = parseInt(day.textContent, 10);
      if (isNaN(dayNum)) return;

      const dayOfWeek = getDayOfWeekName(dayNum); 
      const isWorking = workingDaysList.includes(dayOfWeek.toLowerCase());

      if (isWorking) {
        day.classList.remove('disabled');
        day.style.opacity = '1';
        day.style.pointerEvents = 'auto';
      } else {
        day.classList.add('disabled');
        day.style.opacity = '0.25';
        day.style.pointerEvents = 'none';
        day.classList.remove('selected');
      }
    });
  };

  // --- Fetch live session token availability from Google Sheets ---
  const fetchSessionAvailability = async (doctorId, dateStr) => {
    const amLabel = document.querySelector('.select-session-opt[data-value="AM"] .badge-avail');
    const pmLabel = document.querySelector('.select-session-opt[data-value="PM"] .badge-avail');

    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === "") {
      if (amLabel) amLabel.textContent = "✓ Session Available";
      if (pmLabel) pmLabel.textContent = "✓ Session Available";
      return;
    }

    try {
      if (amLabel) amLabel.textContent = "Checking slots... ⏳";
      if (pmLabel) pmLabel.textContent = "Checking slots... ⏳";

      // Convert June 15, 2026 to 2026-06-15
      const parts = dateStr.replace(",", "").split(" ");
      const monthNum = "06"; 
      const dayNum = parts[1].padStart(2, '0');
      const yearNum = parts[2];
      const apiDate = `${yearNum}-${monthNum}-${dayNum}`;

      const response = await fetch(`${APPS_SCRIPT_URL}?action=getAvailableSessions&doctor_id=${doctorId}&date=${apiDate}`);
      const result = await response.json();

      if (result.success && result.sessions) {
        const returnedSessions = result.sessions.map(s => s.session.toUpperCase());

        ["AM", "PM"].forEach(sessionType => {
          const opt = wizard.querySelector(`.select-session-opt[data-value="${sessionType}"]`);
          const label = opt ? opt.querySelector('.badge-avail') : null;
          
          const sess = result.sessions.find(s => s.session.toUpperCase() === sessionType);

          if (!sess) {
            // Not configured / missing from Google Sheet for this doctor!
            if (label) {
              label.textContent = `❌ No slots available`;
              label.style.color = '#EF4444';
            }
            if (opt) {
              opt.style.pointerEvents = 'none';
              opt.style.opacity = '0.4';
              opt.classList.remove('selected');
              if (bookingData.time.includes(sessionType)) {
                bookingData.time = '';
              }
            }
          } else if (sess.available_tokens > 0) {
            if (label) {
              label.textContent = `✓ ${sess.available_tokens} slots left`;
              label.style.color = '#16A34A';
            }
            if (opt) {
              opt.style.pointerEvents = 'auto';
              opt.style.opacity = '1';
            }
          } else {
            if (label) {
              label.textContent = `❌ Session Full`;
              label.style.color = '#EF4444';
            }
            if (opt) {
              opt.style.pointerEvents = 'none';
              opt.style.opacity = '0.4';
              opt.classList.remove('selected');
              if (bookingData.time.includes(sess.session)) {
                bookingData.time = '';
              }
            }
          }
        });
        validateCurrentStep();
      }
    } catch (err) {
      console.error("Error fetching session capacity:", err);
      if (amLabel) amLabel.textContent = "✓ Session Available";
      if (pmLabel) pmLabel.textContent = "✓ Session Available";
    }
  };

  // --- Dynamic Doctor Card Renderer ---
  const renderDoctorOptions = (doctorsList) => {
    const grid = document.getElementById('doctorSelectGrid');
    if (!grid) return;

    grid.innerHTML = ''; 

    doctorsList.forEach(doc => {
      const card = document.createElement('div');
      card.className = 'select-card-option select-doctor-opt';
      card.setAttribute('data-value', doc.doctor_name);
      card.setAttribute('data-id', doc.doctor_id);
      
      card.innerHTML = `
        <h4 class="select-option-title">${doc.doctor_name}</h4>
        <span class="select-option-subtitle" style="font-size: 0.8125rem; opacity: 0.95;">${doc.specialization || doc.department}</span>
        <span style="display: block; font-size: 0.725rem; margin-top: 6px; font-weight: 700; color: var(--color-teal-accent); text-transform: uppercase; letter-spacing: 0.02em;">Works: ${doc.working_days}</span>
      `;

      card.addEventListener('click', () => {
        grid.querySelectorAll('.select-doctor-opt').forEach(o => o.classList.remove('selected'));
        card.classList.add('selected');

        bookingData.doctor = doc.doctor_name;
        bookingData.doctor_id = doc.doctor_id;
        bookingData.working_days = doc.working_days;

        bookingData.date = '';
        bookingData.time = '';
        calendarDays.forEach(d => d.classList.remove('selected'));
        resetSessionPlates();

        updateCalendarDisplayForDoctor(doc.working_days);
        validateCurrentStep();
      });

      grid.appendChild(card);
    });
  };

  // --- Load and Initialize Dynamic Doctors on Start ---
  const loadDynamicDoctors = async () => {
    let list = [];
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.trim() === "") {
      list = [
        { doctor_id: "D001", doctor_name: "Dr. Rajesh Sen", department: "Cardiology", specialization: "Cardiologist", working_days: "Mon,Tue,Wed,Fri" },
        { doctor_id: "D002", doctor_name: "Dr. Ananya Iyer", department: "Therapy", specialization: "Clinical Psychologist", working_days: "Mon,Tue,Thu" },
        { doctor_id: "D003", doctor_name: "Dr. Vikram Nair", department: "General", specialization: "General Practitioner", working_days: "Mon,Wed,Fri" },
        { doctor_id: "D004", doctor_name: "Dr. Sunita Sharma", department: "Pediatrics", specialization: "Pediatric Specialist", working_days: "Tue,Thu,Fri" }
      ];
      renderDoctorOptions(list);
      return;
    }

    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?action=getDoctors`);
      const result = await response.json();
      if (result.success && result.doctors) {
        const unique = {};
        result.doctors.forEach(doc => {
          if (!unique[doc.doctor_id]) {
            unique[doc.doctor_id] = doc;
          }
        });
        list = Object.values(unique);
        renderDoctorOptions(list);
      }
    } catch (e) {
      console.error("Failed to load clinicians dynamically from sheet:", e);
      list = [
        { doctor_id: "D001", doctor_name: "Dr. Rajesh Sen", department: "Cardiology", specialization: "Cardiologist", working_days: "Mon,Tue,Wed,Fri" },
        { doctor_id: "D002", doctor_name: "Dr. Ananya Iyer", department: "Therapy", specialization: "Clinical Psychologist", working_days: "Mon,Tue,Thu" },
        { doctor_id: "D003", doctor_name: "Dr. Vikram Nair", department: "General", specialization: "General Practitioner", working_days: "Mon,Wed,Fri" }
      ];
      renderDoctorOptions(list);
    }
  };

  loadDynamicDoctors();

  // Option selection logic: Calendar Day Node
  calendarDays.forEach(day => {
    day.addEventListener('click', () => {
      if (day.classList.contains('disabled')) return;

      calendarDays.forEach(d => d.classList.remove('selected'));
      day.classList.add('selected');
      bookingData.date = `June ${day.textContent}, 2026`;

      bookingData.time = '';
      resetSessionPlates();
      
      if (bookingData.doctor_id) {
        fetchSessionAvailability(bookingData.doctor_id, bookingData.date);
      }

      validateCurrentStep();
    });
  });

  // Option selection logic: AM/PM Session Plate
  timeSlots.forEach(slot => {
    slot.addEventListener('click', () => {
      if (slot.style.opacity === '0.4' || slot.style.pointerEvents === 'none') return;

      timeSlots.forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
      const sessionVal = slot.getAttribute('data-value');
      bookingData.time = sessionVal === 'AM' ? 'AM Session (10:00 AM - 1:00 PM)' : 'PM Session (3:00 PM - 6:00 PM)';
      validateCurrentStep();
    });
  });

  // Step validation
  const validateCurrentStep = () => {
    let isValid = false;

    if (currentStep === 1) {
      isValid = bookingData.service !== '' && bookingData.doctor !== '';
    } else if (currentStep === 2) {
      isValid = bookingData.date !== '' && bookingData.time !== '';
    } else if (currentStep === 3) {
      const nameInput = wizard.querySelector('#patientName');
      const emailInput = wizard.querySelector('#patientEmail');
      const phoneInput = wizard.querySelector('#patientPhone');
      const reasonInput = wizard.querySelector('#consultReason');

      if (nameInput && emailInput && phoneInput) {
        bookingData.name = nameInput.value.trim();
        bookingData.email = emailInput.value.trim();
        bookingData.phone = phoneInput.value.trim();
        bookingData.reason = reasonInput ? reasonInput.value.trim() : '';

        const emailVal = bookingData.email;
        const phoneVal = bookingData.phone;

        const isNameValid = bookingData.name.length > 1;

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const isEmailValid = emailRegex.test(emailVal);

        const cleanPhone = phoneVal.replace(/[\s\(\)\+-]/g, '');
        const isPhoneValid = /^[0-9]{10,12}$/.test(cleanPhone);

        const emailErrorSpan = wizard.querySelector('#emailError');
        const phoneErrorSpan = wizard.querySelector('#phoneError');

        if (emailErrorSpan) {
          if (emailVal.length > 0 && !isEmailValid) {
            emailErrorSpan.style.display = 'block';
            emailInput.style.borderColor = '#EF4444';
          } else {
            emailErrorSpan.style.display = 'none';
            emailInput.style.borderColor = '';
          }
        }

        if (phoneErrorSpan) {
          if (phoneVal.length > 0 && !isPhoneValid) {
            phoneErrorSpan.style.display = 'block';
            phoneInput.style.borderColor = '#EF4444';
          } else {
            phoneErrorSpan.style.display = 'none';
            phoneInput.style.borderColor = '';
          }
        }

        isValid = isNameValid && isEmailValid && isPhoneValid;
      }
    } else {
      isValid = true;
    }

    nextBtn.disabled = !isValid;
    return isValid;
  };

  // Helper to calculate approximate arrival time based on sequential token
  const calculateApproxTime = (sessionStr, token) => {
    const isAM = sessionStr.toUpperCase().includes("AM");
    const startHour = isAM ? 10 : 3;
    const startMinute = 0;
    
    const totalMinutes = (token - 1) * 15;
    const finalHour24 = startHour + Math.floor(totalMinutes / 60);
    const finalMinute = startMinute + (totalMinutes % 60);
    
    const amPm = isAM ? "AM" : "PM";
    const displayHour = finalHour24 > 12 ? finalHour24 - 12 : finalHour24;
    const formattedMinute = finalMinute === 0 ? "00" : finalMinute;
    return `${displayHour}:${formattedMinute} ${amPm}`;
  };

  // --- Active Booking Persistence Logic ---
  const checkActiveBooking = () => {
    const bookingJson = localStorage.getItem('medtrust_active_booking');
    const container = document.getElementById('activeBookingContainer');
    const wizardSection = document.getElementById('bookingSection');
    
    if (bookingJson && container) {
      const appt = JSON.parse(bookingJson);
      
      // Populate visual active booking card
      const greetingEl = document.getElementById('activeCardGreeting');
      if (greetingEl) greetingEl.textContent = `Welcome back, ${appt.name}!`;
      
      const tokenEl = document.getElementById('activeCardToken');
      if (tokenEl) tokenEl.textContent = `Token #${appt.token}`;
      
      const approxEl = document.getElementById('activeCardApproxTime');
      if (approxEl) approxEl.textContent = `Approx. ${appt.approxTime}`;
      
      const docEl = document.getElementById('activeCardDoctor');
      if (docEl) docEl.textContent = appt.doctor;
      
      const dateEl = document.getElementById('activeCardDate');
      if (dateEl) dateEl.textContent = appt.date;
      
      const timeEl = document.getElementById('activeCardTime');
      if (timeEl) timeEl.textContent = appt.time;
      
      const serviceEl = document.getElementById('activeCardService');
      if (serviceEl) serviceEl.textContent = appt.service;
      
      container.style.display = 'block';
      if (wizardSection) wizardSection.style.display = 'none';
    } else {
      if (container) container.style.display = 'none';
      if (wizardSection) wizardSection.style.display = 'block';
    }
  };

  const btnCancel = document.getElementById('btnCancelActiveBooking');
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      if (confirm("Are you sure you want to cancel your scheduled consultation? This will release your active token.")) {
        localStorage.removeItem('medtrust_active_booking');
        
        currentStep = 1;
        bookingData.service = '';
        bookingData.doctor = '';
        bookingData.doctor_id = '';
        bookingData.working_days = '';
        bookingData.date = '';
        bookingData.time = '';
        bookingData.name = '';
        bookingData.email = '';
        bookingData.phone = '';
        bookingData.reason = '';
        
        wizard.querySelectorAll('.select-card-option').forEach(o => o.classList.remove('selected'));
        wizard.querySelectorAll('.calendar-day-node').forEach(o => o.classList.remove('selected'));
        wizard.querySelectorAll('.wizard-step-panel input').forEach(i => i.value = '');
        if (wizard.querySelector('#consultReason')) wizard.querySelector('#consultReason').value = '';
        
        checkActiveBooking();
        updateWizardDisplay();
      }
    });
  }

  let isFirstLoad = true;

  // Update panels display
  const updateWizardDisplay = () => {
    panels.forEach(panel => {
      panel.classList.remove('active');
      if (parseInt(panel.getAttribute('data-step'), 10) === currentStep) {
        panel.classList.add('active');
      }
    });

    nodes.forEach(node => {
      const stepNum = parseInt(node.getAttribute('data-step'), 10);
      node.classList.remove('active', 'completed');
      if (stepNum === currentStep) {
        node.classList.add('active');
      } else if (stepNum < currentStep) {
        node.classList.add('completed');
      }
    });

    // Button states
    if (currentStep === 1) {
      prevBtn.style.visibility = 'hidden';
      nextBtn.textContent = 'Next Step';
    } else if (currentStep === totalSteps) {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
      wizard.querySelector('.wizard-header-steps').style.display = 'none';
    } else {
      prevBtn.style.visibility = 'visible';
      prevBtn.style.display = 'flex';
      nextBtn.style.display = 'flex';
      
      if (currentStep === 3) {
        nextBtn.textContent = 'Submit Booking';
      } else {
        nextBtn.textContent = 'Next Step';
      }
    }

    validateCurrentStep();

    // Smoothly scroll to the top of the wizard, compensating for the sticky header
    if (!isFirstLoad) {
      const headerOffset = 100;
      const wizardTop = wizard.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: wizardTop - headerOffset,
        behavior: 'smooth'
      });
    } else {
      isFirstLoad = false;
    }
  };

  // Button Click events
  nextBtn.addEventListener('click', async () => {
    if (!validateCurrentStep()) return;

    if (currentStep === 3) {
      nextBtn.disabled = true;
      const originalText = nextBtn.textContent;
      nextBtn.textContent = 'Scheduling Consultation... ⏳';

      let tokenVal = '';
      let approxVal = '';

      const mapDoctorId = (docName) => {
        if (docName.includes("Rajesh")) return "D003";
        if (docName.includes("Ananya")) return "D001";
        if (docName.includes("Vikram")) return "D004";
        if (docName.includes("Sunita")) return "D005";
        return "D001";
      };

      const formatDateForAPI = (dateStr) => {
        try {
          const parts = dateStr.replace(",", "").split(" ");
          const monthName = parts[0];
          const day = parts[1].padStart(2, '0');
          const year = parts[2];

          const months = {
            "January": "01", "February": "02", "March": "03", "April": "04",
            "May": "05", "June": "06", "July": "07", "August": "08",
            "September": "09", "October": "10", "November": "11", "December": "12"
          };
          const monthNum = months[monthName] || "06";
          return `${year}-${monthNum}-${day}`;
        } catch (e) {
          return "2026-06-15";
        }
      };

      if (APPS_SCRIPT_URL && APPS_SCRIPT_URL.trim() !== "") {
        try {
          const payload = {
            doctor_id: bookingData.doctor_id || mapDoctorId(bookingData.doctor),
            patient_name: bookingData.name,
            phone: bookingData.phone,
            email: bookingData.email,
            appointment_date: formatDateForAPI(bookingData.date),
            session: bookingData.time.includes("AM") ? "AM" : "PM",
            service: bookingData.service,
            notes: bookingData.reason || ''
          };

          const response = await fetch(`${APPS_SCRIPT_URL}?action=bookAppointment`, {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Content-Type': 'text/plain' 
            },
            body: JSON.stringify(payload)
          });

          const result = await response.json();

          if (result.success) {
            tokenVal = String(result.token);
            approxVal = calculateApproxTime(bookingData.time, result.token);
          } else {
            alert(`Booking reservation failed: ${result.message || 'Unknown clinical error'}`);
            nextBtn.disabled = false;
            nextBtn.textContent = originalText;
            return;
          }
        } catch (err) {
          console.error("Apps Script Connection Error: ", err);
          alert("Network error: Could not complete booking on Google Sheets. Verify your Apps Script Web App URL and Sheet permissions.");
          nextBtn.disabled = false;
          nextBtn.textContent = originalText;
          return;
        }
      }

      if (!tokenVal) {
        const tokenNum = Math.floor(Math.random() * 5) + 2;
        tokenVal = String(tokenNum);
        approxVal = calculateApproxTime(bookingData.time, tokenNum);
      }

      wizard.querySelector('#summaryService').textContent = bookingData.service;
      wizard.querySelector('#summaryDoctor').textContent = bookingData.doctor;
      wizard.querySelector('#summaryDate').textContent = bookingData.date;
      wizard.querySelector('#summaryTime').textContent = bookingData.time;
      wizard.querySelector('#summaryName').textContent = bookingData.name;
      wizard.querySelector('#summaryPhone').textContent = bookingData.phone;
      wizard.querySelector('#summaryEmail').textContent = bookingData.email;
      
      wizard.querySelector('#summaryToken').textContent = "Token #" + tokenVal;
      wizard.querySelector('#summaryApproxTime').textContent = "Approximate Consultation Time: " + approxVal;

      const activeBooking = {
        name: bookingData.name,
        email: bookingData.email,
        phone: bookingData.phone,
        service: bookingData.service,
        doctor: bookingData.doctor,
        date: bookingData.date,
        time: bookingData.time,
        token: tokenVal,
        approxTime: approxVal,
        reason: bookingData.reason || ''
      };
      localStorage.setItem('medtrust_active_booking', JSON.stringify(activeBooking));

      nextBtn.disabled = false;
      nextBtn.textContent = originalText;
    }

    if (currentStep < totalSteps) {
      currentStep++;
      updateWizardDisplay();
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateWizardDisplay();
    }
  });

  const infoInputs = wizard.querySelectorAll('.wizard-step-panel[data-step="3"] input');
  infoInputs.forEach(input => {
    input.addEventListener('input', validateCurrentStep);
  });

  // Bind Download active booking receipt (Pinnable active card)
  const btnDownloadActive = document.getElementById('btnDownloadActiveReceipt');
  if (btnDownloadActive) {
    btnDownloadActive.addEventListener('click', () => {
      const bookingJson = localStorage.getItem('medtrust_active_booking');
      if (bookingJson) {
        const appt = JSON.parse(bookingJson);
        downloadReceiptPDF(appt);
      }
    });
  }

  // Bind Download wizard booking receipt (Step 4 Success Screen)
  const btnDownloadWizard = document.getElementById('btnDownloadWizardReceipt');
  if (btnDownloadWizard) {
    btnDownloadWizard.addEventListener('click', () => {
      const activeBooking = {
        name: bookingData.name,
        email: bookingData.email,
        phone: bookingData.phone,
        service: bookingData.service,
        doctor: bookingData.doctor,
        date: bookingData.date,
        time: bookingData.time,
        token: wizard.querySelector('#summaryToken').textContent.replace('Token #', '').trim(),
        approxTime: wizard.querySelector('#summaryApproxTime').textContent.replace('Approximate Consultation Time:', '').replace('Approx.', '').trim(),
        reason: bookingData.reason || ''
      };
      downloadReceiptPDF(activeBooking);
    });
  }

  // Initialize
  checkActiveBooking();
  updateWizardDisplay();
}

/* ========================================================================
   PREMIUM CLIENT-SIDE PDF RECEIPT GENERATOR (jspdf)
   ======================================================================== */
function downloadReceiptPDF(booking) {
  if (!window.jspdf) {
    alert("PDF library is still loading. Please try again in a moment.");
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const colorTeal = [13, 148, 136];      
    const colorCharcoal = [30, 41, 59];    
    const colorGreen = [22, 163, 74];      
    const colorLightGray = [248, 250, 252]; 
    const colorDarkGray = [71, 85, 105];   

    const drawDashedLine = (y) => {
      doc.setDrawColor(203, 213, 225); 
      doc.setLineDashPattern([2, 2], 0);
      doc.line(20, y, 190, y);
      doc.setLineDashPattern([], 0); 
    };

    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.8);
    doc.rect(10, 10, 190, 277);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.rect(12, 12, 186, 273);

    doc.setFillColor(13, 148, 136);
    doc.rect(20, 20, 10, 3, 'F');
    doc.rect(23.5, 16.5, 3, 10, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('MEDTRUST CLINIC', 35, 24);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(115, 115, 115);
    doc.text('PREMIUM MEDICAL CONSULTING & TRIAGE', 35, 29);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('RECEIPT NO:', 138, 22);
    doc.setFont('helvetica', 'normal');
    doc.text(`MT-${Math.floor(100000 + Math.random() * 900000)}`, 162, 22);

    doc.setFont('helvetica', 'bold');
    doc.text('DATE ISSUED:', 138, 26);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), 162, 26);

    doc.setFont('helvetica', 'bold');
    doc.text('STATUS:', 138, 30);
    doc.setTextColor(22, 163, 74);
    doc.text('CONFIRMED', 162, 30);

    drawDashedLine(36);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text('APPOINTMENT TICKET & CLINICAL RECEIPT', 20, 46);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Please hold onto this document on your device. Show it upon checking in at the reception desk.', 20, 51);

    doc.setFillColor(240, 253, 250); 
    doc.setDrawColor(13, 148, 136); 
    doc.setLineWidth(0.5);
    doc.rect(20, 58, 170, 48, 'FD');

    doc.setDrawColor(45, 212, 191);
    doc.setLineDashPattern([3, 3], 0);
    doc.rect(22, 60, 166, 44);
    doc.setLineDashPattern([], 0); 

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(13, 148, 136);
    doc.text('YOUR ASSIGNED QUEUE TOKEN', 105, 68, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    doc.setTextColor(30, 41, 59);
    doc.text(`Token #${booking.token}`, 105, 83, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(22, 163, 74);
    doc.text(`Approximate Arrival Time: ${booking.approxTime}`, 105, 93, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('*Triage times may vary slightly. Please arrive 10 minutes prior for consultation pre-checks.', 105, 99, { align: 'center' });

    drawDashedLine(114);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('CONFIRMED APPOINTMENT DETAILS', 20, 124);

    let currentY = 132;
    const drawDetailRow = (label1, val1, label2, val2) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(label1, 20, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(String(val1), 58, currentY);

      if (label2) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(label2, 110, currentY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(String(val2), 148, currentY);
      }
      
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.3);
      doc.line(20, currentY + 4, 190, currentY + 4);
      currentY += 12;
    };

    drawDetailRow('Patient Name:', booking.name, 'Contact Phone:', booking.phone);
    drawDetailRow('Registered Email:', booking.email, 'Scheduled Date:', booking.date);
    drawDetailRow('Specialist Doctor:', booking.doctor, 'Session Block:', booking.time);
    drawDetailRow('Department Care:', booking.service, 'Consultation Fee:', '$120.00 (Settled)');

    if (booking.reason) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('Reason for Visit:', 20, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      
      const splitReason = doc.splitTextToSize(booking.reason, 130);
      doc.text(splitReason, 58, currentY);
      
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.3);
      doc.line(20, currentY + (splitReason.length * 4) + 2, 190, currentY + (splitReason.length * 4) + 2);
      currentY += 16;
    }

    drawDashedLine(currentY + 2);

    currentY += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('IMPORTANT GUIDELINES FOR YOUR VISIT', 20, currentY);

    const guidelines = [
      '• Virtual Consultation: If scheduled for Telehealth, check your email for a direct secure session link.',
      '• Arrival & Intake Triage: Please check in with front-desk reception 10 mins prior to your scheduled time block.',
      '• Ticket Verification: You may show this PDF file directly on your smartphone screen to check in.',
      '• Rescheduling: Can be managed up to 24 hours prior to appointment time via the MedTrust Patient portal.'
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    guidelines.forEach(line => {
      currentY += 5.5;
      doc.text(line, 20, currentY);
    });

    let barcodeY = 245;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('*MEDTRUST-SYSTEM-SECURE-TICKET*', 105, barcodeY - 2, { align: 'center' });

    const barcodeXStart = 65;
    const stripePatterns = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 2, 3, 1, 4, 2, 1, 3, 1, 2];
    let stripeX = barcodeXStart;
    doc.setFillColor(30, 41, 59);
    stripePatterns.forEach((width, index) => {
      if (index % 2 === 0) {
        doc.rect(stripeX, barcodeY, width * 0.7, 10, 'F');
      }
      stripeX += width * 0.7 + 0.5;
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(13, 148, 136);
    doc.text('MEDTRUST HEALTHCARE SYSTEM', 105, barcodeY + 16, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Care You Can Believe In  |  www.medtrust.com', 105, barcodeY + 21, { align: 'center' });

    doc.save(`MedTrust_Receipt_${booking.name.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error("PDF generation error: ", err);
    alert("An error occurred while generating your receipt PDF. Please try again.");
  }
}
