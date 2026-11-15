const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const startCamera = document.getElementById("startCamera");
const captureBtn = document.getElementById("captureBtn");
const fileInput = document.getElementById("fileInput");
const ingredientsBox = document.getElementById("ingredients");
const gradeBtn = document.getElementById("gradeBtn");
const resultSection = document.getElementById("resultSection");
const historySection = document.getElementById("historySection");
const cameraStatus = document.getElementById("cameraStatus");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const ocrStatus = document.getElementById("ocrStatus");

let stream = null;

const rules = {
  positive: [
    ["whole grain", 8, "Whole grains are a useful source of fiber."],
    ["oats", 8, "Oats are a minimally processed whole-food ingredient."],
    ["almonds", 6, "Nuts can provide beneficial fats and protein."],
    ["nuts", 5, "Nuts can provide beneficial fats and protein."],
    ["seeds", 5, "Seeds can provide fiber and unsaturated fats."],
    ["chickpeas", 7, "Legumes are nutrient-dense ingredients."],
    ["lentils", 7, "Legumes are nutrient-dense ingredients."],
    ["dates", 3, "Dates are a whole-food sweetening ingredient."],
    ["fruit", 4, "Fruit-based ingredients can add useful nutrients."],
    ["vegetables", 5, "Vegetable ingredients can add fiber and micronutrients."]
  ],
  negative: [
    ["high fructose corn syrup", -14, "Added syrup is a strong marker of a highly processed product."],
    ["corn syrup", -12, "Added syrup increases the processing/added-sugar penalty."],
    ["glucose syrup", -12, "Added syrup is a concentrated source of sugar."],
    ["sugar", -8, "Added sugar lowers the health score."],
    ["palm oil", -7, "Palm oil is treated as a less favorable fat marker in this prototype."],
    ["hydrogenated", -15, "Hydrogenated fats are a strong negative marker."],
    ["trans fat", -18, "Trans fat is a strong negative marker."],
    ["artificial flavor", -8, "Artificial flavor is treated as an additive marker."],
    ["artificial colour", -8, "Artificial coloring is treated as an additive marker."],
    ["artificial color", -8, "Artificial coloring is treated as an additive marker."],
    ["sodium benzoate", -7, "Preservative detected."],
    ["benzoate", -6, "Preservative detected."],
    ["bha", -8, "Synthetic antioxidant detected."],
    ["bht", -8, "Synthetic antioxidant detected."],
    ["msg", -5, "Flavor enhancer detected."],
    ["monosodium glutamate", -5, "Flavor enhancer detected."],
    ["maltodextrin", -7, "Refined carbohydrate/additive marker detected."],
    ["emulsifier", -4, "Emulsifier detected."],
    ["starch", -2, "Refined starch is treated as a mild negative marker."],
    ["refined flour", -6, "Refined flour is less nutrient-dense than whole grain flour."]
  ]
};

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIngredients(text) {
  return text
    .split(/[,;•\n]+/)
    .map(x => x.replace(/^ingredients?\s*:?\s*/i, "").trim())
    .filter(Boolean);
}

function scoreProduct(text) {
  const normalized = normalize(text);
  let score = 72;
  const reasons = [];
  let positiveCount = 0;
  let negativeCount = 0;
  let additiveCount = 0;

  rules.positive.forEach(([term, points, reason]) => {
    if (normalized.includes(term)) {
      score += points;
      positiveCount++;
      reasons.push({ icon: "✓", title: term, text: reason, positive: true });
    }
  });

  rules.negative.forEach(([term, points, reason]) => {
    if (normalized.includes(term)) {
      score += points;
      negativeCount++;
      if (["sodium benzoate", "benzoate", "bha", "bht", "msg", "monosodium glutamate", "maltodextrin", "emulsifier", "artificial flavor", "artificial colour", "artificial color"].includes(term)) {
        additiveCount++;
      }
      reasons.push({ icon: "!", title: term, text: reason, positive: false });
    }
  });

  const ingredientCount = splitIngredients(text).length;

  // Simple complexity penalty for long ingredient lists.
  if (ingredientCount > 10) {
    score -= Math.min(14, (ingredientCount - 10) * 2);
    reasons.push({
      icon: "•",
      title: "Long ingredient list",
      text: "This prototype applies a small penalty to very long ingredient lists.",
      positive: false
    });
  }

  // Sugar-related extra penalty if repeated.
  const sugarMatches = (normalized.match(/\bsugar\b/g) || []).length;
  if (sugarMatches > 1) {
    score -= 5;
    reasons.push({
      icon: "!",
      title: "Repeated added sugar markers",
      text: "Multiple sugar references can indicate a more heavily sweetened formulation.",
      positive: false
    });
  }

  score = Math.max(0, Math.min(100, score));

  let grade;
  if (score >= 85) grade = "A";
  else if (score >= 72) grade = "B";
  else if (score >= 58) grade = "C";
  else if (score >= 43) grade = "D";
  else if (score >= 25) grade = "E";
  else grade = "F";

  const label = {
    A: "Excellent choice",
    B: "Good choice",
    C: "Average choice",
    D: "Poor choice",
    E: "Very poor choice",
    F: "Extremely poor choice"
  }[grade];

  const explanation = {
    A: "Mostly favorable ingredient signals with relatively few negative markers.",
    B: "A generally better option, although there are some ingredients to watch.",
    C: "A mixed profile. It may be fine occasionally, but there are several factors to consider.",
    D: "Multiple less-favorable ingredient or processing signals were detected.",
    E: "The ingredient profile contains several strong negative markers.",
    F: "A high concentration of negative markers was detected by this prototype."
  }[grade];

  const ingredientScore = positiveCount >= 2 && negativeCount <= 1 ? "A" :
    negativeCount <= 2 ? "B" : negativeCount <= 4 ? "C" : "D";

  const additiveScore = additiveCount === 0 ? "A" :
    additiveCount === 1 ? "B" :
    additiveCount === 2 ? "C" :
    additiveCount === 3 ? "D" : "E";

  const processingScore = ingredientCount <= 5 && negativeCount <= 1 ? "A" :
    ingredientCount <= 8 && negativeCount <= 2 ? "B" :
    ingredientCount <= 12 ? "C" :
    ingredientCount <= 16 ? "D" : "E";

  const nutritionScore = normalized.includes("whole grain") || normalized.includes("oats") ||
    normalized.includes("nuts") || normalized.includes("almonds") ? "B" :
    normalized.includes("sugar") || normalized.includes("syrup") ? "D" : "C";

  return {
    score, grade, label, explanation,
    ingredientScore, additiveScore, processingScore, nutritionScore,
    ingredients: splitIngredients(text),
    reasons: reasons.slice(0, 8)
  };
}

function setGradeColor(grade) {
  const colors = {
    A: ["#e8f7eb", "#167a34"],
    B: ["#edf8df", "#4e9b20"],
    C: ["#fff6d8", "#c98a00"],
    D: ["#fff0d9", "#e47d00"],
    E: ["#ffe6dc", "#dc4b22"],
    F: ["#ffe1e1", "#d92121"]
  };
  const [bg, fg] = colors[grade];
  document.getElementById("gradeCircle").style.background = bg;
  document.getElementById("gradeCircle").style.color = fg;
  document.getElementById("gradeLabel").style.color = fg;
}

function renderResult(result) {
  document.getElementById("productName").textContent = "Scanned Product";
  document.getElementById("ingredientCount").textContent =
    `${result.ingredients.length} ingredient${result.ingredients.length === 1 ? "" : "s"} detected`;

  document.getElementById("gradeCircle").textContent = result.grade;
  document.getElementById("gradeLabel").textContent = `${result.grade} — ${result.label}`;
  document.getElementById("gradeExplanation").textContent = result.explanation;

  document.getElementById("ingredientScore").textContent = result.ingredientScore;
  document.getElementById("additiveScore").textContent = result.additiveScore;
  document.getElementById("processingScore").textContent = result.processingScore;
  document.getElementById("nutritionScore").textContent = result.nutritionScore;

  document.getElementById("detectedIngredients").textContent =
    result.ingredients.join(", ") || "No ingredients detected.";

  const list = document.getElementById("reasonList");
  list.innerHTML = "";

  if (result.reasons.length === 0) {
    list.innerHTML = `
      <div class="reason">
        <div class="reason-icon">✓</div>
        <div><strong>No strong markers found</strong><span>The prototype did not find any of its predefined ingredient markers.</span></div>
      </div>`;
  } else {
    result.reasons.forEach(r => {
      const div = document.createElement("div");
      div.className = "reason";
      div.innerHTML = `
        <div class="reason-icon">${r.icon}</div>
        <div><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml(r.text)}</span></div>`;
      list.appendChild(div);
    });
  }

  setGradeColor(result.grade);
  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

  saveHistory(result);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

gradeBtn.addEventListener("click", () => {
  const text = ingredientsBox.value.trim();

  if (!text) {
    ingredientsBox.focus();
    ocrStatus.textContent = "Please enter ingredients, upload an image, or scan with the camera first.";
    return;
  }

  ocrStatus.textContent = "Analyzing ingredient profile...";
  const result = scoreProduct(text);
  renderResult(result);
  ocrStatus.textContent = `Analysis complete • internal prototype score: ${result.score}/100`;
});

document.querySelectorAll(".sample").forEach(button => {
  button.addEventListener("click", () => {
    ingredientsBox.value = button.dataset.sample;
    gradeBtn.click();
  });
});

async function startCameraStream() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    video.srcObject = stream;
    video.style.display = "block";
    cameraPlaceholder.style.display = "none";
    captureBtn.disabled = false;
    cameraStatus.textContent = "Camera on";
    cameraStatus.classList.add("on");
    startCamera.textContent = "Close Camera";
  } catch (error) {
    ocrStatus.textContent = "Camera access was blocked. Use Upload Image or paste the ingredient list.";
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  video.srcObject = null;
  video.style.display = "none";
  cameraPlaceholder.style.display = "grid";
  captureBtn.disabled = true;
  cameraStatus.textContent = "Camera off";
  cameraStatus.classList.remove("on");
  startCamera.textContent = "Open Camera";
}

startCamera.addEventListener("click", () => {
  if (stream) stopCamera();
  else startCameraStream();
});

captureBtn.addEventListener("click", async () => {
  if (!stream) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    if (blob) runOCR(blob);
  }, "image/jpeg", 0.92);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) runOCR(file);
});

async function runOCR(imageSource) {
  if (!window.Tesseract) {
    ocrStatus.textContent = "OCR library could not load. Paste the ingredient list manually.";
    return;
  }

  try {
    ocrStatus.textContent = "Reading the ingredient label... this can take a few seconds.";
    gradeBtn.disabled = true;

    const result = await Tesseract.recognize(imageSource, "eng", {
      logger: message => {
        if (message.status === "recognizing text" && message.progress) {
          ocrStatus.textContent = `Reading label... ${Math.round(message.progress * 100)}%`;
        }
      }
    });

    const text = result.data.text
      .replace(/\n+/g, ", ")
      .replace(/\s+/g, " ")
      .trim();

    ingredientsBox.value = text;
    ocrStatus.textContent = text
      ? "Text detected. Review it for accuracy, then analyze."
      : "No readable text detected. Try a clearer photo.";
  } catch (error) {
    console.error(error);
    ocrStatus.textContent = "Could not read the image. Try a brighter, closer photo.";
  } finally {
    gradeBtn.disabled = false;
  }
}

document.getElementById("scanAgain").addEventListener("click", () => {
  resultSection.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.getElementById("historyBtn").addEventListener("click", () => {
  historySection.classList.toggle("hidden");
  if (!historySection.classList.contains("hidden")) {
    renderHistory();
    historySection.scrollIntoView({ behavior: "smooth" });
  }
});

document.getElementById("clearHistory").addEventListener("click", () => {
  localStorage.removeItem("healthgrade_history");
  renderHistory();
});

function saveHistory(result) {
  const history = JSON.parse(localStorage.getItem("healthgrade_history") || "[]");
  history.unshift({
    grade: result.grade,
    score: result.score,
    ingredients: result.ingredients.join(", "),
    date: new Date().toLocaleString()
  });
  localStorage.setItem("healthgrade_history", JSON.stringify(history.slice(0, 20)));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem("healthgrade_history") || "[]");
  const list = document.getElementById("historyList");

  if (!history.length) {
    list.innerHTML = `<p style="color:#69736b;font-size:13px;">No scans yet.</p>`;
    return;
  }

  list.innerHTML = history.map(item => `
    <div class="history-entry">
      <div class="history-grade">${escapeHtml(item.grade)}</div>
      <div class="history-info" style="flex:1">
        <strong>Health score ${item.score}/100</strong>
        <span>${escapeHtml(item.date)} • ${escapeHtml(item.ingredients.slice(0, 90))}</span>
      </div>
    </div>
  `).join("");
}

renderHistory();
