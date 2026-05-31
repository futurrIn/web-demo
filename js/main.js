/*
========================================================================
   MEDTRUST PRIMARY INTERACTIVE SCRIPTS
   Responsive Handlers, Tickers, Filters, and Wizard State Machine
========================================================================
*/

// --- Google Sheets Deployed Apps Script Web App URL Endpoint ---
// Paste your deployed Google Apps Script Web App URL here to connect the frontend to Google Sheets!
// If left empty, the site automatically runs in offline/mock preview mode for styling/testing.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyHgeph01mhhRgIEKDAVZ6FCyU4A24NJ0ARbmuKwGo/exec";

document.addEventListener('DOMContentLoaded', () => {
  // Initialize general elements
  initHeaderScroll();
  initMobileMenu();
  initStatsCounters();
  initAccordions();
  initServiceFilters();
  initBookingWizard();
  initModals();
  initActiveBookingNavbarBadge(); // Initialize navbar booking indicator badge
});

/* ========================================================================
   1. HEADER SCROLL & SHADOW EFFECT
   ======================================================================== */
function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const checkScroll = () => {
    if (window.scrollY > 40) {
      header.classList.add('header-scrolled');
    } else {
      header.classList.remove('header-scrolled');
    }
  };

  window.addEventListener('scroll', checkScroll);
  checkScroll(); // Initial check
}

/* ========================================================================
   2. MOBILE NAV DRAWER TOGGLE
   ======================================================================== */
function initMobileMenu() {
  const toggleBtn = document.querySelector('.mobile-nav-toggle');
  const drawer = document.querySelector('.mobile-nav-drawer');

  if (!toggleBtn || !drawer) return;

  toggleBtn.addEventListener('click', () => {
    toggleBtn.classList.toggle('open');
    drawer.classList.toggle('active');

    // Prevent background scrolling when menu is open
    if (drawer.classList.contains('active')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  // Close drawer if a navigation link is clicked
  const drawerLinks = drawer.querySelectorAll('.mobile-nav-link');
  drawerLinks.forEach(link => {
    link.addEventListener('click', () => {
      toggleBtn.classList.remove('open');
      drawer.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

/* ========================================================================
   3. ANIMATED STATISTICS COUNTERS
   ======================================================================== */
function initStatsCounters() {
  const statsSection = document.querySelector('.hero-stats');
  if (!statsSection) return;

  const statNumbers = document.querySelectorAll('.stat-number-value');
  let started = false;

  const startCounting = () => {
    statNumbers.forEach(counter => {
      const target = parseInt(counter.getAttribute('data-target'), 10);
      const duration = 1500; // Total duration in ms
      const stepTime = 15; // Interval between steps
      const totalSteps = duration / stepTime;
      const increment = target / totalSteps;

      let currentVal = 0;
      let stepCount = 0;

      const timer = setInterval(() => {
        stepCount++;
        currentVal += increment;

        if (stepCount >= totalSteps) {
          counter.textContent = target;
          clearInterval(timer);
        } else {
          counter.textContent = Math.floor(currentVal);
        }
      }, stepTime);
    });
  };

  // Intersection Observer to fire counters when scrolled into view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !started) {
        started = true;
        startCounting();
      }
    });
  }, { threshold: 0.5 });

  observer.observe(statsSection);
}

/* ========================================================================
   4. INTERACTIVE FAQS ACCORDIONS
   ======================================================================== */
function initAccordions() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');

  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isActive = item.classList.contains('active');

      // Close all accordions first
      document.querySelectorAll('.accordion-item').forEach(accItem => {
        accItem.classList.remove('active');
      });

      // Toggle this item
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

/* ========================================================================
   5. SERVICES SEARCH & CATEGORY FILTERING
   ======================================================================== */
function initServiceFilters() {
  const filterTabs = document.querySelectorAll('.filter-tab');
  const searchInput = document.querySelector('.search-input');
  const serviceCards = document.querySelectorAll('.service-item-card');

  if (filterTabs.length === 0 && !searchInput) return;

  let activeCategory = 'all';
  let searchQuery = '';

  const filterCards = () => {
    serviceCards.forEach(card => {
      const category = card.getAttribute('data-category');
      const name = card.querySelector('.service-item-name').textContent.toLowerCase();
      const desc = card.querySelector('.service-item-description').textContent.toLowerCase();

      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const matchesSearch = name.includes(searchQuery) || desc.includes(searchQuery);

      if (matchesCategory && matchesSearch) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  };

  // Tab click listener
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.getAttribute('data-filter');
      filterCards();
    });
  });

  // Search input listener
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      filterCards();
    });
  }
}

/* ========================================================================
   6. INTERACTIVE MULTI-STEP APPOINTMENT SCHEDULER WIZARD
   ======================================================================== */
function initBookingWizard() {
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
    // June 1, 2026 is a Monday (index 1)
    // Days array mapping: Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6, Sunday=0
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

    grid.innerHTML = ''; // Clear hardcoded HTML options

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

        // Reset selected dates and plates upon changing clinical therapist
        bookingData.date = '';
        bookingData.time = '';
        calendarDays.forEach(d => d.classList.remove('selected'));
        resetSessionPlates();

        // Update active calendar node visual states
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
      // Mock Fallback
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
        // Group by doctor_id to represent distinct clinical profiles
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
      // Failover mock loading
      list = [
        { doctor_id: "D001", doctor_name: "Dr. Rajesh Sen", department: "Cardiology", specialization: "Cardiologist", working_days: "Mon,Tue,Wed,Fri" },
        { doctor_id: "D002", doctor_name: "Dr. Ananya Iyer", department: "Therapy", specialization: "Clinical Psychologist", working_days: "Mon,Tue,Thu" },
        { doctor_id: "D003", doctor_name: "Dr. Vikram Nair", department: "General", specialization: "General Practitioner", working_days: "Mon,Wed,Fri" }
      ];
      renderDoctorOptions(list);
    }
  };

  loadDynamicDoctors(); // Trigger dynamically on start!

  // Option selection logic: Calendar Day Node
  calendarDays.forEach(day => {
    day.addEventListener('click', () => {
      if (day.classList.contains('disabled')) return;

      calendarDays.forEach(d => d.classList.remove('selected'));
      day.classList.add('selected');
      bookingData.date = `June ${day.textContent}, 2026`;

      // Reset AM/PM selections and query real-time remaining tokens from Google Sheet
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

        // Strict high-fidelity Email regex check
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const isEmailValid = emailRegex.test(emailVal);

        // Strict Phone validation (strip common separators like spaces, brackets, hyphens, and leading +)
        const cleanPhone = phoneVal.replace(/[\s\(\)\+-]/g, '');
        const isPhoneValid = /^[0-9]{10,12}$/.test(cleanPhone);

        // Dynamic inline validation visual helpers
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

    // Format clean readable AM/PM time
    const amPm = isAM ? "AM" : "PM";
    const displayHour = finalHour24 > 12 ? finalHour24 - 12 : finalHour24;
    const formattedMinute = finalMinute === 0 ? "00" : finalMinute;
    return `${displayHour}:${formattedMinute} ${amPm}`;
  };

  // Populate summary page before showing it
  const updateBookingSummary = () => {
    // Generate a mock sequential token (between 2 and 6)
    const tokenNum = Math.floor(Math.random() * 5) + 2;
    const approxTime = calculateApproxTime(bookingData.time, tokenNum);

    wizard.querySelector('#summaryService').textContent = bookingData.service;
    wizard.querySelector('#summaryDoctor').textContent = bookingData.doctor;
    wizard.querySelector('#summaryDate').textContent = bookingData.date;
    wizard.querySelector('#summaryTime').textContent = bookingData.time;
    wizard.querySelector('#summaryName').textContent = bookingData.name;
    wizard.querySelector('#summaryPhone').textContent = bookingData.phone;
    wizard.querySelector('#summaryEmail').textContent = bookingData.email;

    // Populate Token Card details
    wizard.querySelector('#summaryToken').textContent = "Token #" + tokenNum;
    wizard.querySelector('#summaryApproxTime').textContent = "Approximate Consultation Time: " + approxTime;
  };

  // Update panels display
  const updateWizardDisplay = () => {
    // Toggle active panel
    panels.forEach(panel => {
      panel.classList.remove('active');
      if (parseInt(panel.getAttribute('data-step'), 10) === currentStep) {
        panel.classList.add('active');
      }
    });

    // Toggle active wizard headers
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
      // Form successfully finished!
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

      // Map display doctor to matching Google Sheets ID
      const mapDoctorId = (docName) => {
        if (docName.includes("Rajesh")) return "D003";
        if (docName.includes("Ananya")) return "D001";
        if (docName.includes("Vikram")) return "D004";
        if (docName.includes("Sunita")) return "D005";
        return "D001";
      };

      // Convert "June 15, 2026" to "2026-06-15"
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

      // If Apps Script Web App URL is configured, book in Google Sheets!
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
              'Content-Type': 'text/plain' // Use text/plain to avoid preflight issues in standard Apps Script configurations
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

      // If mock mode or fallback, use local mock token generator
      if (!tokenVal) {
        const tokenNum = Math.floor(Math.random() * 5) + 2;
        tokenVal = String(tokenNum);
        approxVal = calculateApproxTime(bookingData.time, tokenNum);
      }

      // Populate Step 4 Success summaries
      wizard.querySelector('#summaryService').textContent = bookingData.service;
      wizard.querySelector('#summaryDoctor').textContent = bookingData.doctor;
      wizard.querySelector('#summaryDate').textContent = bookingData.date;
      wizard.querySelector('#summaryTime').textContent = bookingData.time;
      wizard.querySelector('#summaryName').textContent = bookingData.name;
      wizard.querySelector('#summaryPhone').textContent = bookingData.phone;
      wizard.querySelector('#summaryEmail').textContent = bookingData.email;

      wizard.querySelector('#summaryToken').textContent = "Token #" + tokenVal;
      wizard.querySelector('#summaryApproxTime').textContent = "Approximate Consultation Time: " + approxVal;

      // Save to local storage for persistence and dashboard indicators
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

      // Proactively update any navbar badges on page
      if (typeof initActiveBookingNavbarBadge === 'function') {
        initActiveBookingNavbarBadge();
      }

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

  // Watch input changes for step 3
  const infoInputs = wizard.querySelectorAll('.wizard-step-panel[data-step="3"] input');
  infoInputs.forEach(input => {
    input.addEventListener('input', validateCurrentStep);
  });

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

      // Show container and hide booking wizard
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

        // Reset wizard back to step 1
        currentStep = 1;
        bookingData.service = '';
        bookingData.doctor = '';
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

        // Clear active booking navbar badge indicator immediately
        initActiveBookingNavbarBadge();
      }
    });
  }

  // Bind active booking check to dashboard link
  const homeBtn = wizard.querySelector('.btn-dark[href="index.html"]') || wizard.querySelector('.btn-dark[style*="margin-left: 16px"]');
  if (homeBtn) {
    homeBtn.removeAttribute('href');
    homeBtn.style.cursor = 'pointer';
    homeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      checkActiveBooking();
      updateWizardDisplay();
    });
  }

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
   6B. ACTIVE BOOKING NAVBAR BADGE INDICATOR
   ======================================================================== */
function initActiveBookingNavbarBadge() {
  const bookingJson = localStorage.getItem('medtrust_active_booking');
  const navLinks = document.querySelectorAll('.nav-link[href="patients.html"], .mobile-nav-link[href="patients.html"]');

  if (!bookingJson) {
    // Clean up indicator if it exists
    navLinks.forEach(link => {
      const indicator = link.querySelector('.nav-booking-indicator');
      if (indicator) {
        indicator.remove();
      }
    });
    return;
  }

  const appt = JSON.parse(bookingJson);
  navLinks.forEach(link => {
    if (!link.querySelector('.nav-booking-indicator')) {
      link.style.position = 'relative';
      link.style.display = 'inline-flex';
      link.style.alignItems = 'center';
      link.style.gap = '6px';

      const dot = document.createElement('span');
      dot.className = 'nav-booking-indicator';
      dot.style.width = '8px';
      dot.style.height = '8px';
      dot.style.backgroundColor = '#16A34A';
      dot.style.borderRadius = '50%';
      dot.style.display = 'inline-block';
      dot.title = `Active Booking: Token #${appt.token}`;
      dot.style.boxShadow = '0 0 0 0 rgba(22, 163, 74, 0.7)';
      dot.style.animation = 'pulse-green 2s infinite';

      link.appendChild(dot);
    }
  });
}

/* ========================================================================
   6C. PREMIUM CLIENT-SIDE PDF RECEIPT GENERATOR (jspdf)
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

    // Set brand colors (MEDTRUST corporate color tokens)
    const colorTeal = [13, 148, 136];      // #0D9488 Primary Accent
    const colorCharcoal = [30, 41, 59];    // #1E293B Primary Text
    const colorGreen = [22, 163, 74];      // #16A34A Success Indicator
    const colorLightGray = [248, 250, 252]; // #F8FAFC Card BG
    const colorDarkGray = [71, 85, 105];   // #475569 Secondary Text
    const colorBorder = [226, 232, 240];    // #E2E8F0 Grid Border

    // Helper to draw horizontal dashed line
    const drawDashedLine = (y) => {
      doc.setDrawColor(203, 213, 225); // #CBD5E1
      doc.setLineDashPattern([2, 2], 0);
      doc.line(20, y, 190, y);
      doc.setLineDashPattern([], 0); // Reset
    };

    // Draw Outer Teal Border
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.8);
    doc.rect(10, 10, 190, 277);

    // Draw Inner Subtle Border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.rect(12, 12, 186, 273);

    // Logo icon (Teal cross)
    doc.setFillColor(13, 148, 136);
    doc.rect(20, 20, 10, 3, 'F');
    doc.rect(23.5, 16.5, 3, 10, 'F');

    // Header Brand Name
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('MEDTRUST CLINIC', 35, 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(115, 115, 115);
    doc.text('PREMIUM MEDICAL CONSULTING & TRIAGE', 35, 29);

    // Right-aligned ticket meta
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

    // Divider
    drawDashedLine(36);

    // Section Header: Appointment Confirmation
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text('APPOINTMENT TICKET & CLINICAL RECEIPT', 20, 46);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Please hold onto this document on your device. Show it upon checking in at the reception desk.', 20, 51);

    // --- Hero Token Card block ---
    // Background card rect
    doc.setFillColor(240, 253, 250); // very soft teal/green tint
    doc.setDrawColor(13, 148, 136); // Teal outline
    doc.setLineWidth(0.5);
    doc.rect(20, 58, 170, 48, 'FD');

    // Dash decoration inside card
    doc.setDrawColor(45, 212, 191);
    doc.setLineDashPattern([3, 3], 0);
    doc.rect(22, 60, 166, 44);
    doc.setLineDashPattern([], 0); // Reset

    // Token Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(13, 148, 136);
    doc.text('YOUR ASSIGNED QUEUE TOKEN', 105, 68, { align: 'center' });

    // Big Token Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    doc.setTextColor(30, 41, 59);
    doc.text(`Token #${booking.token}`, 105, 83, { align: 'center' });

    // Approx Arrival Time
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(22, 163, 74);
    doc.text(`Approximate Arrival Time: ${booking.approxTime}`, 105, 93, { align: 'center' });

    // Brief note
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('*Triage times may vary slightly. Please arrive 10 minutes prior for consultation pre-checks.', 105, 99, { align: 'center' });

    // Divider
    drawDashedLine(114);

    // --- Patient & Consultation Details Grid ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('CONFIRMED APPOINTMENT DETAILS', 20, 124);

    // Grid details helper
    let currentY = 132;
    const drawDetailRow = (label1, val1, label2, val2) => {
      // Label 1
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(label1, 20, currentY);

      // Val 1
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(String(val1), 58, currentY);

      if (label2) {
        // Label 2
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(label2, 110, currentY);

        // Val 2
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(String(val2), 148, currentY);
      }

      // Bottom thin line divider
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

      // Wrap reason text
      const splitReason = doc.splitTextToSize(booking.reason, 130);
      doc.text(splitReason, 58, currentY);

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.3);
      doc.line(20, currentY + (splitReason.length * 4) + 2, 190, currentY + (splitReason.length * 4) + 2);
      currentY += 16;
    }

    // Divider
    drawDashedLine(currentY + 2);

    // --- Terms & Instructions Section ---
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

    // Draw a cool vector barcode at bottom
    let barcodeY = 245;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('*MEDTRUST-SYSTEM-SECURE-TICKET*', 105, barcodeY - 2, { align: 'center' });

    // Draw the barcode stripes
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

    // Footer Branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(13, 148, 136);
    doc.text('MEDTRUST HEALTHCARE SYSTEM', 105, barcodeY + 16, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Care You Can Believe In  |  www.medtrust.com', 105, barcodeY + 21, { align: 'center' });

    // Save the PDF
    doc.save(`MedTrust_Receipt_${booking.name.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error("PDF generation error: ", err);
    alert("An error occurred while generating your receipt PDF. Please try again.");
  }
}

/* ========================================================================
   7. DIALOGS MODALS SYSTEM
   ======================================================================== */
function initModals() {
  const openButtons = document.querySelectorAll('[data-open-modal]');
  const closeButtons = document.querySelectorAll('[data-close-modal]');
  const overlays = document.querySelectorAll('.modal-overlay');

  openButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = btn.getAttribute('data-open-modal');
      const targetModal = document.getElementById(modalId);
      if (targetModal) {
        targetModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      overlays.forEach(overlay => overlay.classList.remove('active'));
      document.body.style.overflow = '';
    });
  });

  // Click on background overlay to close
  overlays.forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
}
