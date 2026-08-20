document.addEventListener("DOMContentLoaded", () => {
  fetchRecords();
});

// Fetch all records for the grid
async function fetchRecords() {
  const grid = document.getElementById("history-grid");
  grid.innerHTML =
    '<p style="text-align:center; grid-column: 1/-1;">መረጃ እየተጫነ ነው... (Loading data...)</p>';

  try {
    const response = await fetch("/api/records");
    if (!response.ok) throw new Error("Failed to fetch records");

    const records = await response.json();
    renderCards(records);
  } catch (error) {
    console.error("Error:", error);
    grid.innerHTML = `<p style="color:red; text-align:center; grid-column: 1/-1;">ስህተት ተከስቷል (Error loading records).</p>`;
  }
}

// Build the HTML cards dynamically
function renderCards(records) {
  const grid = document.getElementById("history-grid");
  grid.innerHTML = ""; // Clear loading text

  if (records.length === 0) {
    grid.innerHTML =
      '<p style="text-align:center; grid-column: 1/-1;">ምንም የተመዘገበ መረጃ የለም (No records found).</p>';
    return;
  }

  records.forEach((record) => {
    // Determine color based on health score
    let badgeColor = "#4caf50"; // Green
    if (record.health_score < 75) badgeColor = "#ffa000"; // Orange
    if (record.health_score < 40) badgeColor = "#d32f2f"; // Red

    const cardHTML = `
            <div class="card" onclick="openModal(${record.id})">
                <img src="${record.image_url}" alt="Plant Image" loading="lazy">
                <div class="card-content">
                    <div class="card-title">
                        <span>${record.plant_type}</span>
                        <span class="health-badge" style="background-color: ${badgeColor}">${record.health_score}% ጤና</span>
                    </div>
                    <p class="card-summary">${record.short_summary}</p>
                    <p class="card-date">${record.timestamp}</p>
                </div>
            </div>
        `;
    grid.insertAdjacentHTML("beforeend", cardHTML);
  });
}

// Fetch single record details and open modal
async function openModal(recordId) {
  try {
    const response = await fetch(`/api/record/${recordId}`);
    if (!response.ok) throw new Error("Failed to fetch details");

    const data = await response.json();

    // Populate Modal Fields
    document.getElementById("modal-img").src = data.image_url;
    document.getElementById("modal-plant-type").textContent = data.plant_type;
    document.getElementById("modal-timestamp").textContent = data.timestamp;

    document.getElementById(
      "modal-health"
    ).textContent = `${data.health_score}%`;
    document.getElementById(
      "modal-moisture"
    ).textContent = `${data.moisture_level}%`;

    document.getElementById("modal-symptoms").textContent =
      data.disease_or_symptoms || "ምንም (None)";
    document.getElementById("modal-advice").textContent =
      data.actionable_advice || "ምንም ምክር የለም (No advice)";
    document.getElementById("modal-analysis").textContent =
      data.full_analysis || "ዝርዝር የለም (No details)";

    // Show Modal
    document.getElementById("detail-modal").classList.remove("hidden");
  } catch (error) {
    console.error("Error opening modal:", error);
    alert("መረጃውን ማምጣት አልተቻለም (Could not load details).");
  }
}

// Close modal when clicking outside the content box
function closeModal(event) {
  if (event.target.id === "detail-modal") {
    forceCloseModal();
  }
}

// Close modal explicitly (button click)
function forceCloseModal() {
  document.getElementById("detail-modal").classList.add("hidden");
}
