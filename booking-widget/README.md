# 🔌 Clinic Intake Booking Widget

This folder contains a **completely self-contained, portable, and responsive** booking widget that is pre-configured and directly integrated with your **Google Sheets** database via your live Apps Script API!

You can easily copy this folder and integrate it into **any other website** in under 10 seconds.

---

## 🛠️ File Structure
* 📂 **`booking-widget/`**
  * 📄 **`index.html`** (The standalone wizard & receipt card layout)
  * 📄 **`Code.js`** (The complete, corrected Google Apps Script backend database logic)
  * 📂 **`css/`**
    * 🎨 **`widget.css`** (Clean, scoped CSS so it doesn't conflict with other site stylesheets)
  * 📂 **`js/`**
    * ⚙️ **`widget.js`** (Core interactive state machine & live Google Sheets API connectors)

---

## 🚀 How to Integrate it Into Any Website

There are **two very simple ways** to drop this booking wizard into any other website:

### Method 1: The `<iframe>` Embed (Easiest & Safest)
The absolute cleanest way is to copy the `booking-widget` folder, paste it into your new website's root folder, and embed it using an HTML `iframe` tag wherever you want the scheduler to appear:

```html
<iframe 
  src="booking-widget/index.html" 
  width="100%" 
  height="750px" 
  frameborder="0" 
  style="border: none; overflow: hidden; background: transparent;"
  scrolling="no">
</iframe>
```
* **Pros:** Complete styling isolation. The hosting website's styling will never conflict with the booking widget's layout, maintaining pixel-perfect premium HSL card styles!

---

### Method 2: Direct Code Integration
If you prefer a seamless embedded experience without an iframe:
1. **Copy the HTML Markup:** Copy the main `<div class="widget-container">` from [index.html](file:///c:/Users/HP/Documents/webclinic/booking-widget/index.html) and paste it into your new website's HTML body.
2. **Include Scripts & Styles:** Add the widget stylesheet and scripts to your HTML `<head>` and bottom body:
   ```html
   <!-- Scoped Widget Styles -->
   <link rel="stylesheet" href="booking-widget/css/widget.css">

   <!-- jsPDF and Widget Logic -->
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
   <script src="booking-widget/js/widget.js"></script>
   ```

---

## 📊 Live Pre-Configuration Detail
Your widget is **already 100% pre-configured** inside `js/widget.js` with your active live Google Sheets endpoint:
`https://script.google.com/macros/s/AKfycbw7j1z7mtr5B8B_akLT5WKOof0fxJA2Ahv54Fbb4cHO-DhZEWA6K0K8UBfpvi8ZlLDI/exec`

* **Dynamic Populating:** On page load, it will dynamically fetch active clinicians from your sheet.
* **Date Filters:** It will automatically enable/disable calendar days matching the selected clinician's working days.
* **Token Checks:** It will fetch remaining PM/AM slots live from your sheet.
* **PDF Downloads:** It will automatically print single-page vector A4 receipts under 30KB.

---

### 🎨 Customizing Styles & Branding
All design values (colors, sizing, curves, typography) are defined at the top of **`css/widget.css`** under `:root` variables:
* **Change Accent Color:** Replace `--w-color-teal-accent` and `--w-color-teal-dark` with your new website's primary theme colors.
* **Change Curves:** Update `--w-radius-md`, `--w-radius-lg` and `--w-radius-xl` to match the border curves of the hosting website.
